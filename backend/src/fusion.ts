/**
 * Fusion engine.
 *
 * Flow (IMPLEMENTATION_PLAN §2 Day 2):
 *   1. Call every panel member in parallel through the unified gateway.
 *   2. Build a judge prompt from the panel answers.
 *   3. Call the judge with `response_format: json_schema` (strict) using the
 *      shared FUSION_RESULT_JSON_SCHEMA, so the JSON is guaranteed to match
 *      FusionResult when the gateway forwards strict mode.
 *   4. Parse into FusionResult. If a gateway does NOT forward json_schema, fall
 *      back to robust parsing; on failure do one retry with a hardened prompt
 *      (R6). If it still fails, throw — we never fabricate a result (A.4).
 *
 * On any error this throws. Callers surface an honest error state and must not
 * charge the agent.
 */

import { FUSION_RESULT_JSON_SCHEMA, type FusionResult } from "@0xrecipe/shared";
import { callModel, labelForChannel } from "./gateway.js";
import type { Recipe } from "./recipes.js";

const FUSION_RESULT_FIELDS: ReadonlyArray<keyof FusionResult> = [
  "consensus",
  "contradictions",
  "partial_coverage",
  "unique_insights",
  "blind_spots",
  "synthesized_answer",
];

/** A single panel member's answer, tagged with its user-safe quality label. */
interface PanelAnswer {
  /** User-safe label only ("standard source" / "official source"). */
  label: string;
  answer: string;
}

/**
 * Run a panel member, returning its answer tagged with a user-safe label.
 * Errors propagate so a failed panel member fails the whole call honestly.
 */
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

/** Compose the judge user message from the panel answers. */
function buildJudgePrompt(answers: PanelAnswer[], userMessage: string): string {
  const reviews = answers
    .map((a, i) => `--- Review ${i + 1} (${a.label}) ---\n${a.answer}`)
    .join("\n\n");
  return (
    `The reader's request:\n${userMessage}\n\n` +
    `Below are ${answers.length} independent reviews of the same material.\n\n` +
    `${reviews}\n\n` +
    `Synthesize them into a single result that matches the required structure.`
  );
}

/** Strip Markdown code fences a gateway may wrap JSON in. */
function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fence?.[1]?.trim() ?? trimmed;
}

/** Validate that an arbitrary value is a complete FusionResult. */
function asFusionResult(value: unknown): FusionResult | null {
  if (typeof value !== "object" || value === null) return null;
  const obj = value as Record<string, unknown>;

  if (typeof obj.consensus !== "string") return null;
  if (typeof obj.synthesized_answer !== "string") return null;
  for (const field of [
    "contradictions",
    "partial_coverage",
    "unique_insights",
    "blind_spots",
  ] as const) {
    const arr = obj[field];
    if (!Array.isArray(arr) || !arr.every((x) => typeof x === "string")) {
      return null;
    }
  }

  return {
    consensus: obj.consensus,
    contradictions: obj.contradictions as string[],
    partial_coverage: obj.partial_coverage as string[],
    unique_insights: obj.unique_insights as string[],
    blind_spots: obj.blind_spots as string[],
    synthesized_answer: obj.synthesized_answer,
  };
}

/** Parse judge output into a FusionResult, tolerating code fences. */
function parseJudgeOutput(raw: string): FusionResult | null {
  const candidate = stripCodeFence(raw);
  try {
    return asFusionResult(JSON.parse(candidate));
  } catch {
    return null;
  }
}

/** Call the judge once and parse; returns null on any parse failure. */
async function callJudgeOnce(
  recipe: Recipe,
  judgePrompt: string,
  hardened: boolean,
): Promise<FusionResult | null> {
  const fieldList = FUSION_RESULT_FIELDS.join(", ");
  const systemContent = hardened
    ? `${recipe.judge.instruction}\n\n` +
      `Return ONLY a single JSON object with exactly these keys: ${fieldList}. ` +
      `String fields are strings; the rest are arrays of strings. ` +
      `No prose, no Markdown, no code fence.`
    : recipe.judge.instruction;

  const raw = await callModel({
    channel: recipe.judge.channel,
    model: recipe.judge.model,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: judgePrompt },
    ],
    responseFormat: {
      type: "json_schema",
      json_schema: {
        name: "fusion_result",
        schema: FUSION_RESULT_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
  });

  return parseJudgeOutput(raw);
}

/**
 * Run a full Fusion: parallel panel -> judge -> FusionResult.
 *
 * Throws on transport/auth errors or if the judge output cannot be parsed after
 * one retry. Never returns fabricated data.
 */
export async function runFusion(
  recipe: Recipe,
  userMessage: string,
): Promise<FusionResult> {
  const panelAnswers = await Promise.all(
    recipe.panel.map((member) => runPanelMember(member, userMessage)),
  );

  const judgePrompt = buildJudgePrompt(panelAnswers, userMessage);

  // First attempt: rely on strict json_schema pass-through.
  const first = await callJudgeOnce(recipe, judgePrompt, false);
  if (first) return first;

  // Fallback (R6): gateway did not enforce the schema. Retry once with a
  // hardened, explicit-JSON instruction.
  const second = await callJudgeOnce(recipe, judgePrompt, true);
  if (second) return second;

  throw new Error(
    "Fusion judge did not return a parseable structured result after one retry.",
  );
}
