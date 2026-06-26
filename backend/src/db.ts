/**
 * SQLite-backed recipe store (better-sqlite3, synchronous).
 *
 * Recipes — including price, panel, judge, and creator payout address — are DATA
 * here, not code. Each call reads the row fresh, so a recipe's price can change
 * at runtime WITHOUT restarting the server (see backend/scripts/recipe-admin.mjs
 * and `updatePrice`). The schema is shaped for many recipes / many creators; the
 * single demo recipe below is only the initial seed on a fresh database.
 *
 * Price source of truth: the `recipes.price_usdc` column (a decimal string). The
 * env RECIPE_PRICE_USDC now only SEEDS a fresh database — it is not read per call.
 *
 * The seed's panel `systemPrompt` / judge `instruction` strings are sent to the
 * models and may surface to the end user, so they are written as a professional,
 * contract-review prompt: no internal terms, no real person names, no gateway or
 * product names. They are copied verbatim from the prior in-code recipe.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { config } from "./config.js";
import type { PanelMember, JudgeSpec } from "./recipes.js";

// --- Paths -------------------------------------------------------------------

const HERE = dirname(fileURLToPath(import.meta.url));
/** Repo root: two levels up from both `backend/src` and `backend/dist`. */
const REPO_ROOT = resolve(HERE, "../..");
const DEFAULT_DB_PATH = resolve(REPO_ROOT, "data", "0xrecipe.db");

/**
 * Resolve the database location. Under NODE_ENV=test we use an in-memory
 * database so tests are isolated and need no fixture files; otherwise
 * DATABASE_PATH (default `${repoRoot}/data/0xrecipe.db`).
 */
function resolveDbPath(): string {
  if (process.env.NODE_ENV === "test") return ":memory:";
  const fromEnv = process.env.DATABASE_PATH?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DB_PATH;
}

// --- Row shape ---------------------------------------------------------------

/** One persisted recipe row. Mirrors the `recipes` table columns 1:1. */
export interface RecipeRow {
  id: string;
  name: string;
  /** Decimal USDC string, the source of truth for price (e.g. "0.05"). */
  price_usdc: string;
  creator_address: string;
  /** JSON array of {model, channel, systemPrompt}. */
  panel_json: string;
  /** JSON object {model, channel, instruction}. */
  judge_json: string;
  created_at: number;
}

// --- Seed (initial fresh-DB contents only; not the runtime source of truth) --

/**
 * Obvious demo placeholder. Not a real payout address — overridden by
 * HARDCODED_CREATOR_ADDR in the environment before any real settlement.
 */
const PLACEHOLDER_CREATOR_ADDRESS =
  "0x000000000000000000000000000000000000dEaD";

/**
 * Decimal-string price used only to seed a fresh DB; overridable at runtime via
 * recipe-admin without a restart. $1.00 is the D6-justified price: measured
 * upstream cost is ~$0.39 per fusion call (panel + judge through the gateway),
 * and price must be >= 2x cost (here ~2.6x). See backend/scripts/measure-cost.ts.
 */
const DEFAULT_PRICE_USDC = "1.00";

/** Stable id of the demo recipe seeded on a fresh database. */
export const SEED_RECIPE_ID = "legal-reviewer-v1";

const SEED_PANEL: PanelMember[] = [
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
];

const SEED_JUDGE: JudgeSpec = {
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
};

// --- Connection + schema (run once on module init) ---------------------------

function openDatabase(): Database.Database {
  const dbPath = resolveDbPath();
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const database = new Database(dbPath);
  if (dbPath !== ":memory:") {
    // WAL: concurrent readers (the running server) are not blocked by a writer
    // (the admin CLI changing a price), so runtime price edits land cleanly.
    database.pragma("journal_mode = WAL");
  }
  return database;
}

const db = openDatabase();

// Idempotent: safe to run on every boot. Keep this CREATE in sync with the
// identical statement in backend/scripts/recipe-admin.mjs.
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    price_usdc      TEXT NOT NULL,
    creator_address TEXT NOT NULL,
    panel_json      TEXT NOT NULL,
    judge_json      TEXT NOT NULL,
    created_at      INTEGER NOT NULL
  );
`);

// Append-only billing ledger. Every settled charge and confirmed deposit is
// recorded here so an agent can query its own bill / usage with no human or
// external system involved. The agent address is stored LOWERCASED so lookups
// are case-insensitive (callers may pass a checksummed or lowercased address).
db.exec(`
  CREATE TABLE IF NOT EXISTS ledger (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ts            INTEGER NOT NULL,
    agent         TEXT NOT NULL,
    type          TEXT NOT NULL,
    amount_units  TEXT NOT NULL,
    amount_usdc   TEXT NOT NULL,
    recipe_id     TEXT,
    counterparty  TEXT,
    tx_hash       TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_agent ON ledger(agent);
`);

// --- Prepared statements -----------------------------------------------------

const RECIPE_COLUMNS =
  "id, name, price_usdc, creator_address, panel_json, judge_json, created_at";

const selectByIdStmt = db.prepare(
  `SELECT ${RECIPE_COLUMNS} FROM recipes WHERE id = ?`,
);
const selectAllStmt = db.prepare(
  `SELECT ${RECIPE_COLUMNS} FROM recipes ORDER BY created_at ASC, id ASC`,
);
const upsertStmt = db.prepare(
  `INSERT INTO recipes (${RECIPE_COLUMNS})
   VALUES (@id, @name, @price_usdc, @creator_address, @panel_json, @judge_json, @created_at)
   ON CONFLICT(id) DO UPDATE SET
     name            = excluded.name,
     price_usdc      = excluded.price_usdc,
     creator_address = excluded.creator_address,
     panel_json      = excluded.panel_json,
     judge_json      = excluded.judge_json`,
);
const countStmt = db.prepare("SELECT COUNT(*) AS n FROM recipes");
const updatePriceStmt = db.prepare(
  "UPDATE recipes SET price_usdc = ? WHERE id = ?",
);

const insertLedgerStmt = db.prepare(
  `INSERT INTO ledger
     (ts, agent, type, amount_units, amount_usdc, recipe_id, counterparty, tx_hash)
   VALUES
     (@ts, @agent, @type, @amount_units, @amount_usdc, @recipe_id, @counterparty, @tx_hash)`,
);
const selectLedgerByAgentStmt = db.prepare(
  `SELECT ts, type, amount_units, amount_usdc, recipe_id, counterparty, tx_hash
   FROM ledger WHERE agent = ? ORDER BY id DESC LIMIT ?`,
);

// --- Public helpers (synchronous; better-sqlite3 is sync) --------------------

/** Read one recipe row by id, or undefined if absent. */
export function getRecipeRow(id: string): RecipeRow | undefined {
  return selectByIdStmt.get(id) as RecipeRow | undefined;
}

/** All recipe rows, oldest first (for the future market listing). */
export function listRecipeRows(): RecipeRow[] {
  return selectAllStmt.all() as RecipeRow[];
}

/** Insert or fully replace (except created_at) a recipe row. */
export function upsertRecipe(row: RecipeRow): void {
  upsertStmt.run(row);
}

/**
 * Update only the price of an existing recipe. Returns whether a row was
 * actually changed (false if no recipe has that id). This is the runtime
 * price-change path that takes effect on the next request, no restart.
 */
export function updatePrice(id: string, priceUsdc: string): boolean {
  const info = updatePriceStmt.run(priceUsdc, id);
  return info.changes > 0;
}

// --- Ledger (billing log) ----------------------------------------------------

/** A ledger row records either a settled charge or a confirmed deposit. */
export type LedgerEntryType = "deposit" | "charge";

/** Shape accepted by {@link insertLedgerEntry}. Agent is lowercased on write. */
export interface LedgerEntryInput {
  /** Epoch milliseconds (Date.now()). */
  ts: number;
  /** Agent address; stored lowercased for case-insensitive lookup. */
  agent: string;
  type: LedgerEntryType;
  /** Amount in USDC smallest units, as a decimal string (e.g. "50000"). */
  amountUnits: string;
  /** Amount in USDC, as a display decimal string (e.g. "0.05"). */
  amountUsdc: string;
  /** Recipe id for a charge; null for a deposit. */
  recipeId: string | null;
  /** Creator paid for a charge; null for a deposit. */
  counterparty: string | null;
  txHash: string;
}

/** One ledger row as returned to an agent by {@link listLedgerByAgent}. */
export interface LedgerEntry {
  ts: number;
  type: LedgerEntryType;
  amountUnits: string;
  amountUsdc: string;
  recipeId: string | null;
  counterparty: string | null;
  txHash: string;
}

/** Raw ledger row shape (snake_case columns). */
interface LedgerRow {
  ts: number;
  type: string;
  amount_units: string;
  amount_usdc: string;
  recipe_id: string | null;
  counterparty: string | null;
  tx_hash: string;
}

/** Append one entry to the billing ledger. Agent is stored lowercased. */
export function insertLedgerEntry(entry: LedgerEntryInput): void {
  insertLedgerStmt.run({
    ts: entry.ts,
    agent: entry.agent.toLowerCase(),
    type: entry.type,
    amount_units: entry.amountUnits,
    amount_usdc: entry.amountUsdc,
    recipe_id: entry.recipeId,
    counterparty: entry.counterparty,
    tx_hash: entry.txHash,
  });
}

/**
 * An agent's ledger entries, newest first, capped at `limit`. The caller passes
 * an already-lowercased address (matching how rows are stored).
 */
export function listLedgerByAgent(
  agentLower: string,
  limit: number,
): LedgerEntry[] {
  const rows = selectLedgerByAgentStmt.all(agentLower, limit) as LedgerRow[];
  return rows.map((r) => ({
    ts: r.ts,
    type: r.type as LedgerEntryType,
    amountUnits: r.amount_units,
    amountUsdc: r.amount_usdc,
    recipeId: r.recipe_id,
    counterparty: r.counterparty,
    txHash: r.tx_hash,
  }));
}

// --- Seed --------------------------------------------------------------------

/**
 * Seed the demo recipe on a fresh (empty) database so current behavior is
 * preserved without a restart or any fixture file. Price/creator come from env
 * if set, otherwise the historical defaults.
 */
function seedIfEmpty(): void {
  const { n } = countStmt.get() as { n: number };
  if (n > 0) return;
  upsertRecipe({
    id: SEED_RECIPE_ID,
    name: "Legal Contract Reviewer",
    price_usdc: config.recipePriceUsdc ?? DEFAULT_PRICE_USDC,
    creator_address: config.hardcodedCreatorAddr ?? PLACEHOLDER_CREATOR_ADDRESS,
    panel_json: JSON.stringify(SEED_PANEL),
    judge_json: JSON.stringify(SEED_JUDGE),
    created_at: Date.now(),
  });
}

seedIfEmpty();
