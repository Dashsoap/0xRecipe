/**
 * Hard-coded recipe for the MVP (single recipe only; the publish form and a
 * multi-recipe market are out of scope for this build).
 *
 * A recipe = N (model, channel) members on the panel + 1 (model, channel) judge.
 * The panel runs in parallel; the judge synthesizes their answers into a
 * structured result.
 *
 * The `systemPrompt` / judge `instruction` strings are sent to the models and
 * may surface to the end user, so they are written as a professional,
 * contract-review prompt. They contain no internal terms, no real person names,
 * and no gateway/product names. Model quality tiers are referenced only as
 * "channel" in code; nothing here exposes a channel name to the reader.
 */

import type { Channel } from "./gateway.js";
import { config } from "./config.js";

export interface PanelMember {
  model: string;
  channel: Channel;
  /** Persona/system prompt for this panel member (user-visible, tier 2). */
  systemPrompt: string;
}

export interface JudgeSpec {
  model: string;
  channel: Channel;
  /** Synthesis instruction for the judge (user-visible, tier 2). */
  instruction: string;
}

export interface Recipe {
  id: string;
  name: string;
  /** Per-call price in USDC, decimal string (e.g. "0.05"). */
  pricePerCallUsdc: string;
  /** Per-call price in USDC 6-decimal base units, validated + parsed at boot. */
  priceUnits: bigint;
  /** Creator payout address; placeholder here, overridable via env. */
  creatorAddress: string;
  panel: PanelMember[];
  judge: JudgeSpec;
}

/**
 * Obvious demo placeholder. Not a real payout address — must be overridden by
 * HARDCODED_CREATOR_ADDR in the environment before any real settlement.
 */
const PLACEHOLDER_CREATOR_ADDRESS =
  "0x000000000000000000000000000000000000dEaD";

/** Decimal-string price for the demo recipe; overridable via RECIPE_PRICE_USDC. */
const DEFAULT_PRICE_USDC = "0.05";

/**
 * Strict USDC decimal-string -> 6-decimal base units. Rejects anything that is
 * not a non-negative decimal with at most 6 fractional digits, so a malformed
 * RECIPE_PRICE_USDC fails fast at startup rather than 500-ing every paid call
 * or silently truncating sub-micro precision.
 */
export function parseUsdcAmount(decimal: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(decimal)) {
    throw new Error(
      `Invalid USDC amount "${decimal}": expected a non-negative decimal with ` +
        `at most 6 fractional digits (e.g. "0.05").`,
    );
  }
  const [whole = "0", frac = ""] = decimal.split(".");
  const fracPadded = (frac + "000000").slice(0, 6);
  return BigInt(whole) * 1_000_000n + BigInt(fracPadded);
}

/** Resolved per-call price string for the single demo recipe. */
const PRICE_USDC = config.recipePriceUsdc ?? DEFAULT_PRICE_USDC;

export const LEGAL_REVIEWER_RECIPE: Recipe = {
  id: "legal-reviewer-v1",
  name: "Legal Contract Reviewer",
  pricePerCallUsdc: PRICE_USDC,
  priceUnits: parseUsdcAmount(PRICE_USDC),
  creatorAddress: config.hardcodedCreatorAddr ?? PLACEHOLDER_CREATOR_ADDRESS,
  panel: [
    {
      model: "gpt-5.5",
      channel: "standard",
      systemPrompt:
        "You are a meticulous contracts attorney reviewing the agreement below. " +
        "Examine payment and rent terms, deposits, fees and penalties, renewal and " +
        "termination conditions, liability and indemnity, and any clause that shifts " +
        "risk onto one party. Quote the exact clause text you rely on. Flag anything " +
        "ambiguous, internally inconsistent, or unusually one-sided. Be precise and " +
        "concise; do not invent facts that are not in the document.",
    },
    {
      model: "claude-opus-4-8",
      channel: "official",
      systemPrompt:
        "You are reviewing the agreement below on behalf of the party with the weaker " +
        "bargaining position. Identify obligations, costs, and risks that fall on that " +
        "party, and call out clauses that limit their rights or remedies. Note any term " +
        "that appears to conflict with another term elsewhere in the document. Cite the " +
        "specific clause text. Stay factual and grounded in the document.",
    },
  ],
  judge: {
    model: "gpt-5.5",
    channel: "standard",
    instruction:
      "You are given several independent reviews of the same contract, each written " +
      "from a different perspective. Synthesize them into a single structured result. " +
      "Identify points the reviewers agree on, direct contradictions between clauses " +
      "or between reviewers, areas only partially covered, unique insights raised by a " +
      "single reviewer, and blind spots none of them addressed. Then write one clear, " +
      "actionable summary for the reader. Ground every point in the contract text; do " +
      "not add facts that are not supported by the reviews or the document.",
  },
};

/** All recipes available in this build. */
export const RECIPES: Record<string, Recipe> = {
  [LEGAL_REVIEWER_RECIPE.id]: LEGAL_REVIEWER_RECIPE,
};

export function getRecipe(id: string): Recipe | undefined {
  return RECIPES[id];
}
