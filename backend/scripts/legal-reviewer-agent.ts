/**
 * Stage 3 — autonomous Legal-Review agent demo.
 *
 * A self-driving agent that operates the prepaid escrow with NO human in the
 * loop. It:
 *   1. has a prepaid on-chain budget (set up beforehand via setup-budget-wall);
 *   2. signs a fresh per-call payment voucher for each paid review;
 *   3. is LLM-driven — after each review it reasons about what to ask next;
 *   4. when its prepaid budget runs out, the service answers HTTP 403
 *      (insufficient balance, NOT a 402 payment-required challenge). The agent
 *      RECOGNISES the difference, does not blindly re-sign, and reasons about
 *      topping up — the demo's climax.
 *
 * The agent's "brain" is a model reached through the gateway for its own
 * planning/decisions; the paid `reviewContract` calls go to the 0xRecipe
 * backend. Boots its own backend so the script runs standalone:
 *
 *   node --env-file=../.env --import tsx scripts/legal-reviewer-agent.ts
 *
 * Reads MNEMONIC; prints no secret. User-facing narration avoids internal model
 * / gateway names (CLAUDE.md): quality tiers only surface as the backend's own
 * "standard source" / "official source" labels.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mnemonicToAccount } from "viem/accounts";
import { formatUnits } from "viem";
import { LEASE_TEXT } from "../test/fixtures/lease.js";

// Connect to an already-running backend (so a browser dashboard can watch the
// same settlements) by setting AGENT_API_BASE; otherwise the agent boots its
// own backend on AGENT_PORT for a standalone run.
const EXTERNAL_BASE = process.env.AGENT_API_BASE;
const PORT = Number(process.env.AGENT_PORT ?? "3021");
const BASE = EXTERNAL_BASE ?? `http://localhost:${PORT}`;
const RECIPE_ID = "legal-reviewer-v1";
const CHAIN_ID = 1439;
const EXPLORER = "https://testnet.blockscout.injective.network";

const M = process.env.MNEMONIC;
const KEY = process.env.LLM_GATEWAY_KEY;
const GW = (process.env.LLM_GATEWAY_URL ?? "").replace(/\/$/, "");
if (!M || !KEY || !GW) {
  console.error("MNEMONIC / LLM_GATEWAY_KEY / LLM_GATEWAY_URL must be set");
  process.exit(1);
}

const agent = mnemonicToAccount(M, { addressIndex: 1 });

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// --- agent "brain": a planning/decision model reached via the gateway --------
async function think(system: string, user: string): Promise<string> {
  const res = await fetch(`${GW}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-5.5",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: 320,
    }),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`brain call failed ${res.status}`);
  return j.choices[0].message.content.trim();
}

const BRAIN_SYSTEM =
  "You are an autonomous paralegal agent reviewing a residential lease for your " +
  "principal. You pay per review out of a prepaid budget. Be concise, practical, " +
  "and decisive. Never mention model names, vendors, or internal system details — " +
  "speak as a careful paralegal. Keep replies under 90 words.";

// --- paid tool: reviewContract -> 0xRecipe backend ---------------------------
async function reviewContract(
  question: string,
): Promise<{ status: number; body: any }> {
  const nonce = BigInt("0x" + randomBytes(8).toString("hex"));
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 300);
  const maxPrice = 1_000_000n;
  const signature = await agent.signTypedData({
    domain: VOUCHER_DOMAIN,
    types: PAYMENT_VOUCHER_TYPES,
    primaryType: "PaymentVoucher",
    message: { agent: agent.address, recipeId: RECIPE_ID, maxPrice, nonce, expiry },
  });
  const header = JSON.stringify({
    voucher: {
      agent: agent.address,
      recipeId: RECIPE_ID,
      maxPrice: maxPrice.toString(),
      nonce: nonce.toString(),
      expiry: expiry.toString(),
    },
    signature,
  });
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "PAYMENT-SIGNATURE": header },
    body: JSON.stringify({
      messages: [{ role: "user", content: `${question}\n\n=== LEASE ===\n${LEASE_TEXT}` }],
    }),
  });
  return { status: res.status, body: await res.json() };
}

async function balance(): Promise<bigint> {
  const r = await fetch(`${BASE}/v1/balance/${agent.address}`);
  const j = (await r.json()) as { balanceUnits: string };
  return BigInt(j.balanceUnits);
}

async function waitHealthy(timeoutMs = 40_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      /* not up */
    }
    await sleep(500);
  }
  throw new Error("backend not healthy");
}

function rule(s: string) {
  console.log(`\n${"─".repeat(72)}\n${s}\n${"─".repeat(72)}`);
}

async function main() {
  let server: ChildProcess | null = null;
  const serverErr: string[] = [];
  if (!EXTERNAL_BASE) {
    server = spawn(
      process.execPath,
      ["--env-file=../.env", "--import", "tsx", "src/index.ts"],
      { cwd: new URL("..", import.meta.url).pathname, env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "ignore", "pipe"] },
    );
    server.stderr?.on("data", (d) => serverErr.push(d.toString()));
  } else {
    console.log(`(using running backend at ${BASE})`);
  }

  let code = 0;
  try {
    await waitHealthy();

    rule("AGENT ONLINE — autonomous legal review on a prepaid on-chain budget");
    const start = await balance();
    console.log(`Agent wallet: ${agent.address}`);
    console.log(`Prepaid escrow budget: ${formatUnits(start, 6)} USDC`);

    const plan = await think(
      BRAIN_SYSTEM,
      `You have a prepaid budget of ${formatUnits(start, 6)} USDC and each contract review costs a small fixed fee. ` +
        `Your task: review a residential lease and surface any internal contradictions for your principal, then drill ` +
        `into the most material one. In 2-3 sentences, state your plan.`,
    );
    console.log(`\n🧠 Agent plan:\n${plan}`);

    let step = 0;
    let lastFindings = "";
    let nextQuestion =
      "Review this residential lease and list every internal contradiction (clauses that conflict on a number, term, or permission). Be specific about which sections conflict.";
    let pricePerCall = 0n;

    // The agent keeps reviewing until the budget wall stops it.
    for (;;) {
      step += 1;
      const before = await balance();
      rule(`STEP ${step} — paid review (signing a fresh voucher)`);
      console.log(`Question: ${nextQuestion}`);
      console.log(`Budget before: ${formatUnits(before, 6)} USDC`);

      const { status, body } = await reviewContract(nextQuestion);

      if (status === 403 && body?.error === "insufficient_balance") {
        // --- DEMO CLIMAX: budget wall ---
        console.log(`\n⛔ Backend returned HTTP 403 insufficient_balance.`);
        console.log(`   available=${formatUnits(BigInt(body.available), 6)} USDC  required=${formatUnits(BigInt(body.required), 6)} USDC`);
        const reaction = await think(
          BRAIN_SYSTEM,
          `You tried to run another paid review, but the service answered HTTP 403 "insufficient_balance" ` +
            `(available ${formatUnits(BigInt(body.available), 6)} USDC, required ${formatUnits(BigInt(body.required), 6)} USDC). ` +
            `Note: 403 here means your PREPAID BUDGET is exhausted — it is NOT a 402 "payment required" challenge that a ` +
            `new signature would satisfy. Explain in 2-3 sentences what this means for you and what you will do next ` +
            `(do not pretend you can retry the same way).`,
        );
        console.log(`\n🧠 Agent reasoning:\n${reaction}`);
        console.log(`\n✅ Agent stopped cleanly at the budget wall — no blind retry, no overspend.`);
        break;
      }

      if (status !== 200) {
        throw new Error(`unexpected ${status}: ${JSON.stringify(body).slice(0, 200)}`);
      }

      const after = await balance();
      pricePerCall = before - after;
      const contradictions: string[] = body.contradictions ?? [];
      console.log(`\n💸 Settled on-chain: charged ${formatUnits(pricePerCall, 6)} USDC (creator 20% / platform 80%)`);
      console.log(`   tx ${EXPLORER}/tx/${body.txHash}`);
      console.log(`   Budget after: ${formatUnits(after, 6)} USDC`);
      console.log(`\n📋 Found ${contradictions.length} contradiction(s):`);
      contradictions.slice(0, 6).forEach((c, i) => console.log(`   ${i + 1}. ${c}`));

      lastFindings = contradictions.join("\n");

      // Brain decides the next, more focused question.
      nextQuestion = await think(
        BRAIN_SYSTEM,
        `Your last review surfaced these contradictions:\n${lastFindings}\n\n` +
          `Pick the single most financially material one and write ONE focused follow-up question ` +
          `(a single sentence) asking the reviewer to determine which clause should govern and the risk to your principal. ` +
          `Reply with ONLY the question text.`,
      );
    }

    rule("DEMO COMPLETE");
    console.log(`Final budget: ${formatUnits(await balance(), 6)} USDC`);
    console.log(`Reviews paid for this session: ${step - 1} · per-call price ~${formatUnits(pricePerCall, 6)} USDC`);
  } catch (err) {
    console.error("\n[agent] error:", (err as Error).message);
    if (serverErr.length) console.error("[server stderr]\n" + serverErr.join("").slice(-1200));
    code = 1;
  } finally {
    server?.kill("SIGTERM");
    await sleep(300);
  }
  process.exit(code);
}

void main();
