/**
 * Fusion engine — mixture-of-agents in three stages.
 *
 *   1. PANEL (parallel):  every recipe panel member answers the same request.
 *      A member that errors out is isolated and dropped; the run proceeds as
 *      long as at least one member succeeds.
 *   2. JUDGE (compare, do NOT merge):  one model COMPARES the panel answers and
 *      emits a structured analysis — consensus / contradictions / partial
 *      coverage / unique insights / blind spots. It takes the UNION of every
 *      genuinely-supported point and filters a single member's false positives.
 *      Strict `json_schema`; robust parse + one hardened retry (R6).
 *   3. SYNTHESIZER:  a model writes the final reader-facing answer using the
 *      ORIGINAL request, the RAW panel answers, and the judge's analysis. Giving
 *      the synthesizer the raw answers (not just the judge's compressed view)
 *      means a finding raised by one strong member is never lost in synthesis.
 *
 * Splitting compare (judge) from write (synthesizer) is what makes the ensemble
 * beat its members: the judge focuses purely on accurate structured comparison,
 * and the synthesizer reasons over everything to produce the final answer.
 *
 * On unrecoverable errors this throws. Callers surface an honest error state and
 * must not charge the agent (A.4 — never fabricate a result).
 */

import { type FusionResult } from "@0xrecipe/shared";
import { callModel, labelForChannel } from "./gateway.js";
import type { Recipe } from "./recipes.js";

/** The judge's structured comparison — every FusionResult field except the prose answer. */
type Analysis = Omit<FusionResult, "synthesized_answer">;

const ANALYSIS_FIELDS: ReadonlyArray<keyof Analysis> = [
  "consensus",
  "contradictions",
  "partial_coverage",
  "unique_insights",
  "blind_spots",
];

/** JSON Schema for {@link Analysis} (FUSION_RESULT minus synthesized_answer). */
const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    consensus: { type: "string" },
    contradictions: { type: "array", items: { type: "string" } },
    partial_coverage: { type: "array", items: { type: "string" } },
    unique_insights: { type: "array", items: { type: "string" } },
    blind_spots: { type: "array", items: { type: "string" } },
  },
  required: ["consensus", "contradictions", "partial_coverage", "unique_insights", "blind_spots"],
} as const;

const SYNTH_SYSTEM =
  "You write the single best possible final answer for the reader. You are given " +
  "the original request, several independent expert reviews, and a structured " +
  "comparison of them. Lead with what the reviews agree on, resolve any " +
  "disagreement by reasoning from the source material rather than splitting the " +
  "difference, fold in the strongest unique insights, and address the noted blind " +
  "spots. Be clear, accurate, and actionable. Do not mention that multiple models " +
  "or reviews were involved.";

/** A single panel member's answer, tagged with its user-safe quality label. */
interface PanelAnswer {
  /** User-safe label only ("standard source" / "official source"). */
  label: string;
  answer: string;
}

/** Run a panel member, tagging its answer with a user-safe label. */
async function runPanelMember(
  member: Recipe["panel"][number],
  userMessage: string,
): Promise<PanelAnswer> {
  const answer = await callModel({
    channel: member.channel,
    model: member.model,
    messages: [
      { role: "system", content: member.systemPrompt },
      { role: "user", content: userMessage },
    ],
  });
  return { label: labelForChannel(member.channel), answer };
}

/** Render the raw panel answers into labeled blocks for the judge / synthesizer. */
function renderReviews(answers: PanelAnswer[]): string {
  return answers
    .map((a, i) => `--- Review ${i + 1} (${a.label}) ---\n${a.answer}`)
    .join("\n\n");
}

/** Compose the judge's COMPARISON prompt (compare, do not merge). */
function buildComparisonPrompt(answers: PanelAnswer[], userMessage: string): string {
  return (
    `The reader's request:\n${userMessage}\n\n` +
    `Below are ${answers.length} independent reviews of the same material.\n\n` +
    `${renderReviews(answers)}\n\n` +
    `Compare them and produce the structured comparison. Take the UNION of every ` +
    `point that is genuinely supported by the material; never drop a real point ` +
    `just because only one review raised it, and exclude any point the material ` +
    `does not support.`
  );
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

/** Validate an arbitrary value is a complete Analysis (5 fields). */
function asAnalysis(value: unknown): Analysis | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.consensus !== "string") return null;
  for (const field of ["contradictions", "partial_coverage", "unique_insights", "blind_spots"] as const) {
    const arr = obj[field];
    if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) return null;
  }
  return {
    consensus: obj.consensus,
    contradictions: obj.contradictions as string[],
    partial_coverage: obj.partial_coverage as string[],
    unique_insights: obj.unique_insights as string[],
    blind_spots: obj.blind_spots as string[],
  };
}

function parseAnalysis(raw: string): Analysis | null {
  try {
    return asAnalysis(JSON.parse(stripCodeFence(raw)));
  } catch {
    return null;
  }
}

/** Stage 2: judge compares the reviews into a structured Analysis. */
async function runJudge(recipe: Recipe, comparisonPrompt: string, hardened: boolean): Promise<Analysis | null> {
  const fieldList = ANALYSIS_FIELDS.join(", ");
  const system = hardened
    ? `${recipe.judge.instruction}\n\nReturn ONLY a single JSON object with exactly these keys: ${fieldList}. ` +
      `consensus is a string; the rest are arrays of strings. No prose, no Markdown, no code fence.`
    : recipe.judge.instruction;

  const raw = await callModel({
    channel: recipe.judge.channel,
    model: recipe.judge.model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: comparisonPrompt },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "fusion_analysis",
        schema: ANALYSIS_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });
  return parseAnalysis(raw);
}

/** Stage 3: synthesizer writes the final answer from raw answers + analysis. */
async function runSynthesizer(
  recipe: Recipe,
  userMessage: string,
  answers: PanelAnswer[],
  analysis: Analysis,
): Promise<string> {
  const prompt =
    `Original request:\n${userMessage}\n\n` +
    `Independent reviews:\n${renderReviews(answers)}\n\n` +
    `Structured comparison:\n${JSON.stringify(analysis, null, 2)}\n\n` +
    `Now write the final answer for the reader.`;
  // The synthesizer runs on the judge's model/channel (a strong model); no recipe
  // schema change needed. It produces prose, not JSON.
  const answer = await callModel({
    channel: recipe.judge.channel,
    model: recipe.judge.model,
    messages: [
      { role: "system", content: SYNTH_SYSTEM },
      { role: "user", content: prompt },
    ],
  });
  return answer.trim();
}

/**
 * Run a full Fusion: parallel panel -> judge (compare) -> synthesizer (write).
 *
 * Throws on transport/auth errors, if every panel member fails, or if the judge
 * output cannot be parsed after one hardened retry. Never returns fabricated data.
 */
export async function runFusion(recipe: Recipe, userMessage: string): Promise<FusionResult> {
  // Stage 1 — panel, with per-member failure isolation.
  const settled = await Promise.allSettled(
    recipe.panel.map((member) => runPanelMember(member, userMessage)),
  );
  const panelAnswers = settled
    .filter((s): s is PromiseFulfilledResult<PanelAnswer> => s.status === "fulfilled")
    .map((s) => s.value);
  if (panelAnswers.length === 0) {
    throw new Error("All panel members failed; nothing to compare.");
  }

  // Stage 2 — judge compares into a structured analysis (strict, then hardened retry).
  const comparisonPrompt = buildComparisonPrompt(panelAnswers, userMessage);
  const analysis =
    (await runJudge(recipe, comparisonPrompt, false)) ??
    (await runJudge(recipe, comparisonPrompt, true));
  if (!analysis) {
    throw new Error("Fusion judge did not return a parseable comparison after one retry.");
  }

  // Stage 3 — synthesizer writes the final answer from raw answers + analysis.
  const synthesized_answer = await runSynthesizer(recipe, userMessage, panelAnswers, analysis);
  if (!synthesized_answer) {
    throw new Error("Fusion synthesizer returned an empty answer.");
  }

  return { ...analysis, synthesized_answer };
}
