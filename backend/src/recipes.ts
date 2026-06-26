/**
 * Recipe access layer.
 *
 * A recipe = N (model, channel) members on the panel + 1 (model, channel) judge.
 * The panel runs in parallel; the judge synthesizes their answers into a
 * structured result.
 *
 * Recipes — including price, panel, judge, and creator address — are now DATA in
 * the SQLite store (see db.ts), read fresh on every call. Price therefore lives
 * in the `recipes` table and is editable at runtime (see scripts/recipe-admin.mjs)
 * without restarting the server. This module just maps a stored row to the typed
 * Recipe the route and Fusion engine consume; the demo recipe's literal panel /
 * judge definition is the initial seed in db.ts, not the runtime source of truth.
 *
 * The `systemPrompt` / judge `instruction` strings may surface to the end user,
 * so they are written as a professional, contract-review prompt: no internal
 * terms, no real person names, and no gateway / product names.
 */

import type { Channel } from "./gateway.js";
import { getRecipeRow, listRecipeRows, type RecipeRow } from "./db.js";

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
  /** Per-call price in USDC 6-decimal base units, validated + parsed per call. */
  priceUnits: bigint;
  /** Creator payout address. */
  creatorAddress: string;
  panel: PanelMember[];
  judge: JudgeSpec;
}

/**
 * Strict USDC decimal-string -> 6-decimal base units. Rejects anything that is
 * not a non-negative decimal with at most 6 fractional digits, so a malformed
 * stored price fails fast on read rather than 500-ing every paid call or
 * silently truncating sub-micro precision.
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

/** Map a stored row to the typed Recipe, validating + parsing the price. */
function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    pricePerCallUsdc: row.price_usdc,
    priceUnits: parseUsdcAmount(row.price_usdc),
    creatorAddress: row.creator_address,
    panel: JSON.parse(row.panel_json) as PanelMember[],
    judge: JSON.parse(row.judge_json) as JudgeSpec,
  };
}

/**
 * Resolve a recipe by id from the store. Reads the row on EACH call, so a price
 * (or any field) changed via the admin CLI is reflected on the next request with
 * no restart. Returns undefined for an unknown id.
 */
export function getRecipe(id: string): Recipe | undefined {
  const row = getRecipeRow(id);
  return row ? rowToRecipe(row) : undefined;
}

/** All recipes in the store (for the future market listing). */
export function listRecipes(): Recipe[] {
  return listRecipeRows().map(rowToRecipe);
}
