/**
 * Fusion-vs-singles benchmark.
 *
 * Core product principle (the qualification gate for a recipe):
 *   A Fusion recipe MUST score higher than EVERY single model it is built from.
 *   If the panel + judge cannot beat its own best constituent model, the recipe
 *   has no reason to exist (or to cost more) — so it does not qualify.
 *
 * Method (honest, ground-truth):
 *   For each benchmark contract (with a known answer key of planted
 *   contradictions), we run:
 *     - each DISTINCT constituent model SOLO (same neutral reviewer prompt), and
 *     - the full Fusion pipeline (the recipe's panel + judge),
 *   then a NEUTRAL grader model (not in the recipe) marks, against the answer
 *   key, which planted contradictions each output actually found (recall) and how
 *   many extra/unsupported contradictions it asserted (hallucinations).
 *
 * Verdict = Fusion recall must STRICTLY exceed the best single model's recall.
 * We never fudge the result; if Fusion does not beat the singles, we say so.
 *
 * Run:  cd backend && node --env-file=../.env --import tsx scripts/benchmark-recipe.ts [recipeId]
 */
import { getRecipe, type Recipe } from "../src/recipes.js";
import { callModel, type Channel } from "../src/gateway.js";
import { runFusion } from "../src/fusion.js";
import { CASES, type BenchCase } from "../test/fixtures/benchmark/index.js";

const RECIPE_ID = process.argv[2] ?? "legal-reviewer-v1";

// Neutral grader: a strong model that is NOT part of the recipe, so it never
// grades its own output. Falls back to gpt-5.5 if the primary errors/!JSON.
const GRADER_PRIMARY = { model: "gemini-3-pro-preview", channel: "standard" as Channel };
const GRADER_FALLBACK = { model: "gpt-5.5", channel: "standard" as Channel };

const REVIEW_PROMPT =
  "Identify every internal contradiction in the agreement below — clauses that " +
  "conflict on a number, term, definition, cross-reference, deadline, or " +
  "permission. Be specific about which sections conflict. Do not invent " +
  "contradictions that are not actually in the document.\n\n=== AGREEMENT ===\n";

const SINGLE_SYSTEM =
  "You are a meticulous contracts attorney. Find conflicts between clauses, " +
  "including subtle ones that require connecting two distant sections. Quote the " +
  "clause text you rely on. Stay grounded in the document.";

const distinctModels = (r: Recipe): { model: string; channel: Channel }[] => {
  const seen = new Set<string>();
  const out: { model: string; channel: Channel }[] = [];
  for (const m of [...r.panel, r.judge]) {
    const key = `${m.model}|${m.channel}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ model: m.model, channel: m.channel });
    }
  }
  return out;
};

function stripFence(t: string): string {
  const m = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t.trim());
  return (m?.[1] ?? t).trim();
}

interface Grade {
  recall: number; // 0..1
  found: number; // count of planted contradictions found
  total: number;
  hallucinations: number;
}

/** Grade one output against a case's answer key with a neutral model. */
async function grade(c: BenchCase, outputText: string): Promise<Grade> {
  const expectedList = c.expected
    .map((e, i) => `${i + 1}. [${e.id}] ${e.conflict} (${e.clauseRefs})`)
    .join("\n");
  const prompt =
    `EXPECTED contradictions (the answer key) for "${c.name}":\n${expectedList}\n\n` +
    `A reviewer produced this output:\n"""${outputText}"""\n\n` +
    `For each EXPECTED item (in order), decide if the reviewer's output correctly ` +
    `identified that specific contradiction (the same two clauses / same conflict). ` +
    `Then count how many DISTINCT contradictions the output asserts that are NOT in ` +
    `the expected list (likely false positives). ` +
    `Return ONLY JSON: {"found":[true/false x ${c.expected.length}],"hallucinations":<int>}`;

  for (const g of [GRADER_PRIMARY, GRADER_FALLBACK]) {
    try {
      const raw = await callModel({
        channel: g.channel,
        model: g.model,
        messages: [
          { role: "system", content: "You are a precise grader. Output only the requested JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0,
      });
      // Validate the grader's structured response before trusting its shape.
      // A malformed/empty/non-JSON `found` would otherwise produce a phantom
      // recall of 0 (silently incorrect) or a TypeError that aborts the whole
      // benchmark run. We treat schema breaks as grader failure and fall back.
      const parsed = JSON.parse(stripFence(raw)) as Partial<{
        found: unknown;
        hallucinations: unknown;
      }>;
      if (!parsed || !Array.isArray(parsed.found)) {
        throw new Error("grader response missing `found` array");
      }
      if (parsed.found.length !== c.expected.length) {
        throw new Error(
          `grader returned ${parsed.found.length} verdicts, expected ${c.expected.length}`,
        );
      }
      const found = parsed.found.filter(Boolean).length;
      return {
        recall: found / c.expected.length,
        found,
        total: c.expected.length,
        hallucinations: Math.max(0, Number(parsed.hallucinations) || 0),
      };
    } catch {
      /* try fallback grader */
    }
  }
  throw new Error(`grader failed for case ${c.id}`);
}

interface Contestant {
  label: string;
  run: (c: BenchCase) => Promise<string>;
}

async function main() {
  const recipe = getRecipe(RECIPE_ID);
  if (!recipe) throw new Error(`no recipe "${RECIPE_ID}"`);

  const singles = distinctModels(recipe);
  const contestants: Contestant[] = [
    ...singles.map((s) => ({
      label: `single:${s.model}`,
      run: (c: BenchCase) =>
        callModel({
          channel: s.channel,
          model: s.model,
          messages: [
            { role: "system", content: SINGLE_SYSTEM },
            { role: "user", content: REVIEW_PROMPT + c.text },
          ],
        }),
    })),
    {
      label: "FUSION (panel+judge)",
      run: async (c: BenchCase) => {
        const r = await runFusion(recipe, REVIEW_PROMPT + c.text);
        return r.contradictions.join("\n") + "\n\n" + r.synthesized_answer;
      },
    },
  ];

  console.log(`Benchmark: recipe "${RECIPE_ID}"`);
  console.log(`Cases: ${CASES.map((c) => `${c.name}(${c.expected.length})`).join(", ")}`);
  console.log(`Singles under test: ${singles.map((s) => s.model).join(", ")}`);
  console.log(`Grader: ${GRADER_PRIMARY.model} (fallback ${GRADER_FALLBACK.model})\n`);

  // Run every (contestant x case) and grade. Limit concurrency so we don't
  // overload the gateway (which causes timeouts), and retry each job a few times
  // since a single transient timeout shouldn't sink the whole benchmark.
  const withRetry = async <T,>(fn: () => Promise<T>, tries = 4): Promise<T> => {
    let last: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
      }
    }
    throw last;
  };

  const descriptors = contestants.flatMap((ct) => CASES.map((c) => ({ ct, c })));
  const results: { contestant: string; grade: Grade }[] = new Array(descriptors.length);
  let next = 0;
  const LIMIT = 4;
  const worker = async () => {
    while (next < descriptors.length) {
      const idx = next++;
      const { ct, c } = descriptors[idx];
      const g = await withRetry(async () => grade(c, await ct.run(c)));
      console.log(`  ✓ ${ct.label.padEnd(26)} · ${c.name.padEnd(28)} recall ${g.found}/${g.total}  (+${g.hallucinations} extra)`);
      results[idx] = { contestant: ct.label, grade: g };
    }
  };
  await Promise.all(Array.from({ length: LIMIT }, () => worker()));

  // Aggregate per contestant.
  const agg = new Map<string, { found: number; total: number; hall: number }>();
  for (const r of results) {
    const a = agg.get(r.contestant) ?? { found: 0, total: 0, hall: 0 };
    a.found += r.grade.found;
    a.total += r.grade.total;
    a.hall += r.grade.hallucinations;
    agg.set(r.contestant, a);
  }

  // Quality score = F1 of (recall, precision). Recall = planted found / planted
  // total. Precision = found / (found + hallucinations): a model that invents
  // extra "contradictions" is penalized, which recall alone ignores. F1 stays
  // discriminating even when recall saturates near 100% on strong models.
  const pct = (x: number) => `${(x * 100).toFixed(0)}%`;
  const rows = [...agg.entries()].map(([label, a]) => {
    const recall = a.found / a.total;
    const precision = a.found + a.hall > 0 ? a.found / (a.found + a.hall) : 1;
    const f1 = recall + precision > 0 ? (2 * recall * precision) / (recall + precision) : 0;
    return { label, recall, precision, f1, found: a.found, total: a.total, hall: a.hall, isFusion: label.startsWith("FUSION") };
  });
  rows.sort((x, y) => y.f1 - x.f1);

  console.log(`\n=== SCORECARD (across ${CASES.length} cases, ${rows[0].total} planted contradictions) ===`);
  console.log(`  ${"".padEnd(28)} ${"F1".padStart(5)}  ${"recall".padStart(8)}  ${"precision".padStart(9)}  extra`);
  for (const r of rows) {
    console.log(
      `  ${r.label.padEnd(28)} ${pct(r.f1).padStart(5)}  ${(`${r.found}/${r.total}`).padStart(8)}  ${pct(r.precision).padStart(9)}  ${r.hall}`,
    );
  }

  const fusion = rows.find((r) => r.isFusion)!;
  const bestSingle = rows.filter((r) => !r.isFusion).reduce((a, b) => (b.f1 > a.f1 ? b : a));
  const beats = fusion.f1 > bestSingle.f1;

  console.log(`\n=== VERDICT (Fusion must exceed every single model on F1) ===`);
  console.log(`  Fusion:               F1 ${pct(fusion.f1)}  (recall ${pct(fusion.recall)}, precision ${pct(fusion.precision)})`);
  console.log(`  Best single (${bestSingle.label.replace("single:", "")}):  F1 ${pct(bestSingle.f1)}  (recall ${pct(bestSingle.recall)}, precision ${pct(bestSingle.precision)})`);
  if (beats) {
    console.log(`  ✅ QUALIFIES — Fusion scores higher than every single model it uses.`);
  } else {
    console.log(`  ❌ DOES NOT QUALIFY — Fusion does not exceed its best single model.`);
    console.log(`     (Tune the panel/judge, or the task is saturated for single models.)`);
  }
  process.exit(beats ? 0 : 2);
}

void main().catch((e) => {
  console.error("benchmark error:", e.message);
  process.exit(1);
});
