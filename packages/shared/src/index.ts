/**
 * @0xrecipe/shared — cross-service contracts (C6).
 *
 * One source of truth for the shapes the backend produces, the judge model is
 * constrained to, and the web app renders. Importing these types in all three
 * places prevents schema drift between the Fusion engine, the judge response
 * format, and the UI.
 */

/**
 * Structured output of a Fusion run, as produced by the judge model.
 *
 * The field set is mirrored exactly by {@link FUSION_RESULT_JSON_SCHEMA}, which
 * is handed to the judge via `response_format` so the returned JSON is
 * guaranteed to match this type.
 */
export interface FusionResult {
  /** Points where the panel answers agree. */
  consensus: string;
  /** Direct conflicts between panel answers. */
  contradictions: string[];
  /** Aspects only some panel members addressed. */
  partial_coverage: string[];
  /** Observations a single panel member surfaced that others missed. */
  unique_insights: string[];
  /** Gaps no panel member covered. */
  blind_spots: string[];
  /** The reconciled, final answer the user reads. */
  synthesized_answer: string;
}

/**
 * Real-time settlement event broadcast over SSE after a successful charge.
 *
 * Amounts are decimal strings (smallest-unit or human-readable per producer
 * convention) to avoid float/precision loss across the wire.
 */
export interface SettlementEvent {
  type: "settlement";
  /** Paying agent address. */
  agent: string;
  /** Recipe creator (payout recipient) address. */
  creator: string;
  /** Charged amount as a string to preserve precision. */
  amount: string;
  /** On-chain transaction hash for the atomic charge + split. */
  txHash: string;
  /** Recipe that was invoked. */
  recipeId: string;
  /** Unix epoch milliseconds when the event was emitted. */
  ts: number;
}

/** Listing-level summary of a recipe shown in the marketplace. */
export interface RecipeSummary {
  id: string;
  name: string;
  /** Price per call as a decimal string to preserve precision. */
  pricePerCall: string;
  /** Price per call in USDC base units (6 decimals), as a decimal string. */
  priceUnits: string;
  /** Number of panel models in this recipe. */
  panelSize: number;
}

/** A single panel model's answer, labeled by its quality tier / display name. */
export interface PanelModelResult {
  label: string;
  answer: string;
}

/**
 * JSON Schema for {@link FusionResult}.
 *
 * Passed to the judge model as `response_format.json_schema` with
 * `strict: true`. `additionalProperties` is false and every field is required,
 * so the gateway's strict-JSON pass-through yields output that always satisfies
 * {@link FusionResult}.
 */
export const FUSION_RESULT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    consensus: { type: "string" },
    contradictions: { type: "array", items: { type: "string" } },
    partial_coverage: { type: "array", items: { type: "string" } },
    unique_insights: { type: "array", items: { type: "string" } },
    blind_spots: { type: "array", items: { type: "string" } },
    synthesized_answer: { type: "string" },
  },
  required: [
    "consensus",
    "contradictions",
    "partial_coverage",
    "unique_insights",
    "blind_spots",
    "synthesized_answer",
  ],
} as const;
