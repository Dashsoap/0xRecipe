#!/usr/bin/env node
/**
 * Recipe admin CLI — the runtime price-change path (no server restart).
 *
 * The backend reads each recipe's price from the SQLite `recipes` table on every
 * request (see backend/src/recipes.ts getRecipe), so a price changed here takes
 * effect on the next request without restarting the process.
 *
 * Usage:
 *   node backend/scripts/recipe-admin.mjs list
 *   node backend/scripts/recipe-admin.mjs set-price <recipeId> <priceUsdc>
 *
 * DB location: env DATABASE_PATH, default `${repoRoot}/data/0xrecipe.db` — the
 * same file the server uses. Point both at the same path in production.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "../..");
const DEFAULT_DB_PATH = resolve(REPO_ROOT, "data", "0xrecipe.db");

const fromEnv = process.env.DATABASE_PATH?.trim();
const DB_PATH = fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_DB_PATH;

/** Same strict rule as backend/src/recipes.ts parseUsdcAmount. */
function isValidUsdc(decimal) {
  return /^\d+(\.\d{1,6})?$/.test(decimal);
}

function openDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  // Idempotent; mirrors the CREATE in backend/src/db.ts so the CLI is safe to
  // run against a path the server has not initialised yet (prints "(no recipes)"
  // rather than crashing). It never seeds — seeding is the server's job.
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
  return db;
}

function cmdList(db) {
  const rows = db
    .prepare(
      "SELECT id, name, price_usdc, creator_address FROM recipes ORDER BY created_at ASC, id ASC",
    )
    .all();
  if (rows.length === 0) {
    console.log("(no recipes)");
    return;
  }
  for (const r of rows) {
    console.log(`${r.id}\t${r.name}\t${r.price_usdc} USDC\t${r.creator_address}`);
  }
}

function cmdSetPrice(db, id, price) {
  if (!id || !price) {
    console.error("usage: recipe-admin.mjs set-price <recipeId> <priceUsdc>");
    process.exit(1);
  }
  if (!isValidUsdc(price)) {
    console.error(
      `Invalid USDC amount "${price}": expected a non-negative decimal with at ` +
        `most 6 fractional digits (e.g. 0.05).`,
    );
    process.exit(1);
  }
  const existing = db
    .prepare("SELECT price_usdc FROM recipes WHERE id = ?")
    .get(id);
  if (!existing) {
    console.error(`No recipe with id "${id}".`);
    process.exit(1);
  }
  const info = db
    .prepare("UPDATE recipes SET price_usdc = ? WHERE id = ?")
    .run(price, id);
  if (info.changes < 1) {
    console.error(`Update did not modify any row for "${id}".`);
    process.exit(1);
  }
  console.log(
    `${id}: price ${existing.price_usdc} -> ${price} USDC ` +
      `(updated; the next request uses the new price, no restart)`,
  );
}

function usage() {
  console.error(
    "usage:\n" +
      "  recipe-admin.mjs list\n" +
      "  recipe-admin.mjs set-price <recipeId> <priceUsdc>",
  );
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const db = openDb();
try {
  if (cmd === "list") cmdList(db);
  else if (cmd === "set-price") cmdSetPrice(db, args[0], args[1]);
  else usage();
} finally {
  db.close();
}
