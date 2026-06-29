/**
 * Upstream cost measurement (IMPLEMENTATION_PLAN D6 / R8).
 *
 * Faithfully replays ONE Fusion run's gateway calls for the demo recipe
 * (gpt-5.5 panel + claude-opus-4-8 panel + gpt-5.5 judge) on the lease fixture,
 * captures each call's token usage, and computes the upstream USD cost two ways:
 *
 *   1. new-api formula: USD = model_ratio × group_ratio
 *        × (prompt + completion × completion_ratio) / QuotaPerUnit (500000)
 *      using the gateway's own /api/pricing ratios.
 *   2. Ground truth: the gateway billing delta over /dashboard/billing/usage
 *      around the three calls (run this with NO other traffic on the key).
 *
 * Then recommends a recipe price >= 2× cost (D6). Prints no secret.
 *
 * Run from backend/:  node --env-file=../.env --import tsx scripts/measure-cost.ts
 */
import { LEASE_TEXT } from "../test/fixtures/lease.js";
import { FUSION_RESULT_JSON_SCHEMA } from "@0xrecipe/shared";

const KEY = process.env.LLM_GATEWAY_KEY;
const BASE = (process.env.LLM_GATEWAY_URL ?? "").replace(/\/v1\/?$/, ""); // origin
const V1 = `${BASE}/v1`;
if (!KEY || !BASE) {
  console.error("LLM_GATEWAY_KEY / LLM_GATEWAY_URL not set");
  process.exit(1);
}
const QUOTA_PER_UNIT = 500_000; // new-api default: 500000 quota = $1

// Recipe lineup (mirrors backend/src/db.ts SEED_PANEL / SEED_JUDGE).
const PANEL = [
  {
    model: "gpt-5.5",
    system:
      "You are a meticulous contracts attorney reviewing the agreement below. " +
      "Examine payment and rent terms, deposits, fees and penalties, renewal and " +
      "termination conditions, liability and indemnity, and any clause that shifts " +
      "risk onto one party. Quote the exact clause text you rely on. Flag anything " +
      "ambiguous, internally inconsistent, or unusually one-sided. Be precise and " +
      "concise; do not invent facts that are not in the document.",
  },
  {
    model: "claude-opus-4-8",
    system:
      "You are reviewing the agreement below on behalf of the party with the weaker " +
      "bargaining position. Identify obligations, costs, and risks that fall on that " +
      "party, and call out clauses that limit their rights or remedies. Note any term " +
      "that appears to conflict with another term elsewhere in the document. Cite the " +
      "specific clause text. Stay factual and grounded in the document.",
  },
];
const JUDGE = {
  model: "gpt-5.5",
  system:
    "You are given several independent reviews of the same contract, each written " +
    "from a different perspective. Synthesize them into a single structured result. " +
    "Identify points the reviewers agree on, direct contradictions between clauses " +
    "or between reviewers, areas only partially covered, unique insights raised by a " +
    "single reviewer, and blind spots none of them addressed. Then write one clear, " +
    "actionable summary for the reader. Ground every point in the contract text; do " +
    "not add facts that are not supported by the reviews or the document.",
};
const REVIEW_PROMPT =
  "You are reviewing the residential lease below. Identify any internal " +
  "contradictions — clauses that conflict with each other (e.g. a number, term, " +
  "or permission stated one way in one section and differently in another). " +
  "List each contradiction explicitly.\n\n=== LEASE ===\n";

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
}

async function call(
  model: string,
  system: string,
  user: string,
  json = false,
): Promise<{ content: string; usage: Usage }> {
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (json) {
    body.response_format = {
      type: "json_schema",
      json_schema: {
        name: "fusion_result",
        strict: true,
        schema: FUSION_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
      },
    };
  }
  const res = await fetch(`${V1}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j: any = await res.json();
  if (!res.ok) throw new Error(`${model} -> ${res.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return {
    content: j.choices[0].message.content,
    usage: { prompt_tokens: j.usage.prompt_tokens, completion_tokens: j.usage.completion_tokens },
  };
}

async function pricing(): Promise<Record<string, { ratio: number; completion: number }>> {
  const res = await fetch(`${BASE}/api/pricing`, { headers: { Authorization: `Bearer ${KEY}` } });
  const j: any = await res.json();
  const out: Record<string, { ratio: number; completion: number }> = {};
  for (const r of j.data ?? []) {
    if (r.model_name === "gpt-5.5" || r.model_name === "claude-opus-4-8") {
      out[r.model_name] = { ratio: Number(r.model_ratio), completion: Number(r.completion_ratio) };
    }
  }
  return out;
}

async function billingUsd(): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/dashboard/billing/usage`, {
      headers: { Authorization: `Bearer ${KEY}` },
    });
    const j: any = await res.json();
    return typeof j.total_usage === "number" ? j.total_usage : null;
  } catch {
    return null;
  }
}

function formulaUsd(u: Usage, ratio: number, completionRatio: number, groupRatio = 1): number {
  const quota = ratio * groupRatio * (u.prompt_tokens + u.completion_tokens * completionRatio);
  return quota / QUOTA_PER_UNIT;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const prices = await pricing();
  console.log("gateway ratios:", JSON.stringify(prices));
  const user = REVIEW_PROMPT + LEASE_TEXT;

  // Let any prior traffic settle into the meter, then take an isolated baseline.
  await sleep(5000);
  const billBefore = await billingUsd();

  // 1+2: panel (parallel, like fusion.ts)
  const [p0, p1] = await Promise.all([
    call(PANEL[0].model, PANEL[0].system, user),
    call(PANEL[1].model, PANEL[1].system, user),
  ]);

  // 3: judge (mirror buildJudgePrompt)
  const reviews = [p0, p1]
    .map((a, i) => `--- Review ${i + 1} ---\n${a.content}`)
    .join("\n\n");
  const judgeUser =
    `The reader's request:\n${user}\n\n` +
    `Below are 2 independent reviews of the same material.\n\n` +
    `${reviews}\n\n` +
    `Synthesize them into a single result that matches the required structure.`;
  const j = await call(JUDGE.model, JUDGE.system, judgeUser, true);

  await sleep(6000); // let the gateway meter catch up before reading
  const billAfter = await billingUsd();

  const calls = [
    { name: "panel gpt-5.5", model: "gpt-5.5", u: p0.usage },
    { name: "panel claude-opus-4-8", model: "claude-opus-4-8", u: p1.usage },
    { name: "judge gpt-5.5", model: "gpt-5.5", u: j.usage },
  ];

  console.log("\n=== per-call token usage + formula cost ===");
  let total = 0;
  for (const c of calls) {
    const pr = prices[c.model];
    const usd = formulaUsd(c.u, pr.ratio, pr.completion);
    total += usd;
    console.log(
      `  ${c.name.padEnd(26)} prompt=${String(c.u.prompt_tokens).padStart(6)} completion=${String(
        c.u.completion_tokens,
      ).padStart(5)}  ratio=${pr.ratio} compRatio=${pr.completion}  => $${usd.toFixed(6)}`,
    );
  }
  console.log(`  ${"".padEnd(26)} ${"".padStart(40)} formula TOTAL => $${total.toFixed(6)}`);

  // Ground truth: new-api / OpenAI-compatible /dashboard/billing/usage reports
  // total_usage in US CENTS, so the per-recipe-call cost is delta / 100 USD.
  let billingUsdCost: number | null = null;
  if (billBefore != null && billAfter != null) {
    const deltaCents = billAfter - billBefore;
    billingUsdCost = deltaCents / 100;
    console.log(`\n=== gateway billing delta (ground truth, total_usage in cents) ===`);
    console.log(`  before=${billBefore.toFixed(4)}  after=${billAfter.toFixed(4)}  delta=${deltaCents.toFixed(4)} cents`);
    console.log(`  => real upstream cost / recipe call: $${billingUsdCost.toFixed(5)}`);
  }

  // Price off the more conservative (higher) of formula vs measured billing, so
  // the platform never prices below true cost (D6 honesty).
  const cost = Math.max(total, billingUsdCost ?? 0);
  const basis = billingUsdCost != null && billingUsdCost >= total ? "gateway billing" : "new-api formula";
  const price2x = cost * 2;
  console.log(`\n=== pricing recommendation (D6: price >= 2× cost) ===`);
  console.log(`  formula cost:  $${total.toFixed(5)}`);
  console.log(`  billing cost:  ${billingUsdCost != null ? "$" + billingUsdCost.toFixed(5) : "n/a"}`);
  console.log(`  cost basis (conservative): $${cost.toFixed(5)} (${basis})`);
  console.log(`  2× floor: $${price2x.toFixed(5)}`);
  const candidates = [0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1.0, 1.25, 1.5];
  const rec = candidates.find((p) => p >= price2x) ?? Math.ceil(price2x * 20) / 20;
  console.log(`  suggested round price: $${rec.toFixed(2)}  (margin ${(rec / cost).toFixed(1)}× cost)`);
}

void main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
