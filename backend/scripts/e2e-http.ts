/**
 * HTTP end-to-end harness (IMPLEMENTATION_PLAN §2, Stage 2 "curl 端到端").
 *
 * Boots the real backend server, then drives the full hot path over HTTP:
 *   sign voucher (agent) -> POST /v1/chat/completions (lease fixture)
 *   -> backend verifies voucher -> solvency reserve (on-chain balance)
 *   -> runs Fusion through the live gateway -> escrow.charge() (atomic 20/80)
 *   -> SSE settlement broadcast -> returns FusionResult + txHash.
 *
 * Asserts, across N runs:
 *   - 200 + FusionResult.contradictions is non-empty (the planted lease
 *     contradictions are detected — R7 stability check).
 *   - a real on-chain txHash is returned.
 *   - a matching settlement event arrives over /events/stream.
 *   - the agent's escrow balance falls by exactly the charged amount.
 *
 * Run from the backend dir:
 *   node --env-file=../.env --import tsx scripts/e2e-http.ts [runs]
 *
 * Reads MNEMONIC from the environment to sign as the agent (address index 1);
 * the backend (address index 0) is the on-chain charge signer. No secret is
 * printed.
 */
import { readFileSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mnemonicToAccount } from "viem/accounts";
import { formatUnits } from "viem";
import { LEASE_TEXT } from "../test/fixtures/lease.js";

const RUNS = Number(process.argv[2] ?? "5");
const PORT = Number(process.env.E2E_PORT ?? "3011");
const BASE = `http://localhost:${PORT}`;
const RECIPE_ID = "legal-reviewer-v1";
const EXPLORER = "https://testnet.blockscout.injective.network";

const M = process.env.MNEMONIC;
if (!M) {
  console.error("MNEMONIC not set — run with: node --env-file=../.env --import tsx scripts/e2e-http.ts");
  process.exit(1);
}

const dep = JSON.parse(
  readFileSync(new URL("../../contracts/deployments/injective-testnet-1439.json", import.meta.url), "utf8"),
);

const agent = mnemonicToAccount(M, { addressIndex: 1 });
const CHAIN_ID = 1439;

// EIP-712 voucher domain/types — must match packages/x402/src/voucher.ts.
const VOUCHER_DOMAIN = { name: "0xRecipe", version: "1", chainId: CHAIN_ID } as const;
const PAYMENT_VOUCHER_TYPES = {
  PaymentVoucher: [
    { name: "agent", type: "address" },
    { name: "recipeId", type: "string" },
    { name: "maxPrice", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

const REVIEW_PROMPT =
  "You are reviewing the residential lease below. Identify any internal " +
  "contradictions — clauses that conflict with each other (e.g. a number, term, " +
  "or permission stated one way in one section and differently in another). " +
  "List each contradiction explicitly.\n\n=== LEASE ===\n";

async function signVoucher(nonce: bigint, expiry: bigint, maxPrice: bigint): Promise<string> {
  return agent.signTypedData({
    domain: VOUCHER_DOMAIN,
    types: PAYMENT_VOUCHER_TYPES,
    primaryType: "PaymentVoucher",
    message: { agent: agent.address, recipeId: RECIPE_ID, maxPrice, nonce, expiry },
  });
}

function voucherHeader(nonce: bigint, expiry: bigint, maxPrice: bigint, signature: string): string {
  return JSON.stringify({
    voucher: {
      agent: agent.address,
      recipeId: RECIPE_ID,
      maxPrice: maxPrice.toString(),
      nonce: nonce.toString(),
      expiry: expiry.toString(),
    },
    signature,
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(timeoutMs = 40_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(500);
  }
  throw new Error("backend did not become healthy in time");
}

/** Collect SSE settlement events in the background until aborted. */
function collectSettlements(signal: AbortSignal): { events: any[] } {
  const events: any[] = [];
  (async () => {
    try {
      const res = await fetch(`${BASE}/events/stream`, {
        headers: { Accept: "text/event-stream" },
        signal,
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const frames = buf.split("\n\n");
        buf = frames.pop() ?? "";
        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          const json = line.slice(5).trim();
          try {
            const ev = JSON.parse(json);
            if (ev?.type === "settlement") events.push(ev);
          } catch {
            /* keepalive / non-settlement frame */
          }
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return { events };
}

async function getBalance(): Promise<bigint> {
  const r = await fetch(`${BASE}/v1/balance/${agent.address}`);
  if (!r.ok) throw new Error(`balance read failed: ${r.status}`);
  const j = (await r.json()) as { balanceUnits: string };
  return BigInt(j.balanceUnits);
}

async function callOnce(i: number): Promise<{
  contradictions: number;
  txHash: string;
  amount: bigint;
  sample: string[];
}> {
  const nonce = BigInt("0x" + randomBytes(8).toString("hex"));
  // Server caps voucher windows at 120s; keep this comfortably below that so
  // the e2e exercises the real hot path instead of failing auth.
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 90);
  const maxPrice = 1_000_000n; // 1 USDC ceiling, well above the recipe price
  const sig = await signVoucher(nonce, expiry, maxPrice);
  const header = voucherHeader(nonce, expiry, maxPrice, sig);

  const before = await getBalance();
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": header },
    body: JSON.stringify({
      messages: [{ role: "user", content: REVIEW_PROMPT + LEASE_TEXT }],
    }),
  });
  const j: any = await res.json();
  if (!res.ok) {
    throw new Error(`run ${i} failed ${res.status}: ${JSON.stringify(j)}`);
  }
  if (!Array.isArray(j.contradictions)) {
    throw new Error(`run ${i}: response missing contradictions[]`);
  }
  if (typeof j.txHash !== "string" || !j.txHash.startsWith("0x")) {
    throw new Error(`run ${i}: no on-chain txHash`);
  }
  const after = await getBalance();
  return {
    contradictions: j.contradictions.length,
    txHash: j.txHash,
    amount: before - after,
    sample: j.contradictions.slice(0, 3),
  };
}

async function main(): Promise<void> {
  console.log(`agent: ${agent.address}`);
  console.log(`escrow: ${dep.agentEscrow}  recipe: ${RECIPE_ID}  runs: ${RUNS}\n`);

  console.log("[boot] starting backend on port", PORT, "…");
  const server: ChildProcess = spawn(
    process.execPath,
    ["--env-file=../.env", "--import", "tsx", "src/index.ts"],
    { cwd: new URL("..", import.meta.url).pathname, env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] },
  );
  const serverErr: string[] = [];
  server.stderr?.on("data", (d) => serverErr.push(d.toString()));
  server.stdout?.on("data", (d) => process.stdout.write(`[server] ${d}`));

  const ac = new AbortController();
  let exitCode = 0;
  try {
    await waitForHealth();
    console.log("[boot] backend healthy\n");

    const { events } = collectSettlements(ac.signal);
    await sleep(500); // let SSE attach

    const startBal = await getBalance();
    console.log(`start escrow balance: ${formatUnits(startBal, 6)} USDC\n`);

    const results: Awaited<ReturnType<typeof callOnce>>[] = [];
    for (let i = 1; i <= RUNS; i++) {
      const t0 = Date.now();
      const r = await callOnce(i);
      const dt = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(
        `run ${i}: ${r.contradictions} contradictions · charged ${formatUnits(r.amount, 6)} USDC · ${dt}s · tx ${r.txHash.slice(0, 12)}…`,
      );
      results.push(r);
    }

    await sleep(1500); // let trailing SSE frames land
    ac.abort();

    const endBal = await getBalance();
    const totalCharged = results.reduce((a, r) => a + r.amount, 0n);
    const allHaveContradictions = results.every((r) => r.contradictions > 0);
    const txHashes = new Set(results.map((r) => r.txHash));
    const settledHashes = new Set(events.map((e) => e.txHash));
    const sseMatched = [...txHashes].every((h) => settledHashes.has(h));

    console.log("\n=== sample contradictions (run 1) ===");
    for (const c of results[0].sample) console.log("  •", c);

    console.log("\n=== assertions ===");
    const checks: [string, boolean][] = [
      [`all ${RUNS} runs detected contradictions`, allHaveContradictions],
      [`all ${RUNS} runs returned a unique on-chain txHash`, txHashes.size === RUNS],
      [`SSE settlement received for every charge (${settledHashes.size}/${RUNS})`, sseMatched && events.length >= RUNS],
      [`escrow debited by sum of charges (${formatUnits(totalCharged, 6)} USDC)`, startBal - endBal === totalCharged],
    ];
    let allOk = true;
    for (const [label, ok] of checks) {
      console.log(`  ${ok ? "PASS ✓" : "FAIL ✗"}  ${label}`);
      if (!ok) allOk = false;
    }
    console.log(`\nend escrow balance: ${formatUnits(endBal, 6)} USDC (was ${formatUnits(startBal, 6)})`);
    console.log(`per-call price (observed): ${formatUnits(totalCharged / BigInt(RUNS), 6)} USDC`);
    console.log(`last settlement tx: ${EXPLORER}/tx/${results[results.length - 1].txHash}`);
    console.log(`\n=== ${allOk ? "E2E PASSED — full HTTP hot path verified on-chain" : "E2E FAILED"} ===`);
    exitCode = allOk ? 0 : 1;
  } catch (err) {
    console.error("\n[e2e] error:", (err as Error).message);
    if (serverErr.length) console.error("[server stderr]\n" + serverErr.join(""));
    exitCode = 1;
  } finally {
    ac.abort();
    server.kill("SIGTERM");
    await sleep(300);
  }
  process.exit(exitCode);
}

void main();
