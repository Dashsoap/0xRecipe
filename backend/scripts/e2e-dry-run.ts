/**
 * Dry-run the paid route when Fusion is intentionally unavailable.
 *
 * It verifies: voucher -> solvency reserve succeeds -> Fusion fails honestly ->
 * HTTP 502 -> escrow balance is unchanged -> no settlement SSE is emitted.
 *
 * Run:
 *   cd backend && node --env-file=../.env --import tsx scripts/e2e-dry-run.ts
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mnemonicToAccount } from "viem/accounts";
import { formatUnits } from "viem";

const PORT = Number(process.env.E2E_DRY_PORT ?? "3012");
const BASE = `http://localhost:${PORT}`;
const RECIPE_ID = "legal-reviewer-v1";
const M = process.env.MNEMONIC;
if (!M) {
  console.error("MNEMONIC not set.");
  process.exit(1);
}

const agent = mnemonicToAccount(M, { addressIndex: 1 });
const VOUCHER_DOMAIN = { name: "0xRecipe", version: "1", chainId: 1439 } as const;
const PAYMENT_VOUCHER_TYPES = {
  PaymentVoucher: [
    { name: "agent", type: "address" },
    { name: "recipeId", type: "string" },
    { name: "maxPrice", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "expiry", type: "uint256" },
  ],
} as const;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForHealth(timeoutMs = 40_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return;
    } catch {}
    await sleep(500);
  }
  throw new Error("backend did not become healthy in time");
}

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
          try {
            const ev = JSON.parse(line.slice(5).trim());
            if (ev?.type === "settlement") events.push(ev);
          } catch {}
        }
      }
    } catch {}
  })();
  return { events };
}

async function balance(): Promise<bigint> {
  const r = await fetch(`${BASE}/v1/balance/${agent.address}`);
  if (!r.ok) throw new Error(`balance failed ${r.status}`);
  const j = (await r.json()) as { balanceUnits: string };
  return BigInt(j.balanceUnits);
}

async function header(): Promise<string> {
  const nonce = BigInt("0x" + randomBytes(8).toString("hex"));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 60);
  const maxPrice = 1_000_000n;
  const signature = await agent.signTypedData({
    domain: VOUCHER_DOMAIN,
    types: PAYMENT_VOUCHER_TYPES,
    primaryType: "PaymentVoucher",
    message: { agent: agent.address, recipeId: RECIPE_ID, maxPrice, nonce, expiry },
  });
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

async function main(): Promise<void> {
  console.log(`agent: ${agent.address}`);
  console.log("[boot] starting dry-run backend with intentionally missing LLM keys");
  const server: ChildProcess = spawn(
    process.execPath,
    ["--env-file=../.env", "--import", "tsx", "src/index.ts"],
    {
      cwd: new URL("..", import.meta.url).pathname,
      env: {
        ...process.env,
        PORT: String(PORT),
        MOCK_CHAIN: "0",
        MOCK_FUSION: "0",
        LLM_GATEWAY_KEY: "",
        LLM_GATEWAY_KEY_PURE: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const err: string[] = [];
  server.stderr?.on("data", (d) => err.push(d.toString()));
  server.stdout?.on("data", (d) => process.stdout.write(`[server] ${d}`));
  const ac = new AbortController();
  let exitCode = 0;
  try {
    await waitForHealth();
    const { events } = collectSettlements(ac.signal);
    await sleep(500);

    const before = await balance();
    console.log(`balance before: ${formatUnits(before, 6)} USDC`);
    const res = await fetch(`${BASE}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": await header() },
      body: JSON.stringify({ messages: [{ role: "user", content: "Dry run lease review." }] }),
    });
    const body = await res.json();
    const after = await balance();
    await sleep(500);
    ac.abort();

    const checks: [string, boolean][] = [
      ["route returns 502 fusion_failed", res.status === 502 && body?.error === "fusion_failed"],
      ["escrow balance unchanged", before === after],
      ["no settlement event emitted", events.length === 0],
    ];
    for (const [label, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"} ${label}`);
    console.log(`balance after : ${formatUnits(after, 6)} USDC`);
    exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
  } catch (e) {
    console.error("[dry-run] error:", (e as Error).message);
    if (err.length) console.error(err.join("").slice(-1200));
    exitCode = 1;
  } finally {
    server.kill("SIGTERM");
    await sleep(300);
  }
  process.exit(exitCode);
}

void main();
