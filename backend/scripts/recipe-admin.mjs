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
 *   node backend/scripts/recipe-admin.mjs show <recipeId>
 *   node backend/scripts/recipe-admin.mjs set-price <recipeId> <priceUsdc>
 *   node backend/scripts/recipe-admin.mjs set-creator <recipeId> <address>
 *   node backend/scripts/recipe-admin.mjs reset-demo [priceUsdc]
 *
 * DB location: env DATABASE_PATH, default `${repoRoot}/data/0xrecipe.db` — the
 * same file the server uses. Point both at the same path in production.
 */

import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { getAddress } from "viem";
import { mnemonicToAccount } from "viem/accounts";

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

function cmdShow(db, id) {
  if (!id) {
    console.error("usage: recipe-admin.mjs show <recipeId>");
    process.exit(1);
  }
  const row = db
    .prepare(
      "SELECT id, name, price_usdc, creator_address, panel_json, judge_json, created_at FROM recipes WHERE id = ?",
    )
    .get(id);
  if (!row) {
    console.error(`No recipe with id "${id}".`);
    process.exit(1);
  }
  console.log(JSON.stringify({
    id: row.id,
    name: row.name,
    priceUsdc: row.price_usdc,
    creatorAddress: row.creator_address,
    panel: JSON.parse(row.panel_json),
    judge: JSON.parse(row.judge_json),
    createdAt: row.created_at,
  }, null, 2));
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

function cmdSetCreator(db, id, address) {
  if (!id || !address) {
    console.error("usage: recipe-admin.mjs set-creator <recipeId> <address>");
    process.exit(1);
  }
  let checksummed;
  try {
    checksummed = getAddress(address);
  } catch {
    console.error(`Invalid creator address "${address}".`);
    process.exit(1);
  }
  const existing = db
    .prepare("SELECT creator_address FROM recipes WHERE id = ?")
    .get(id);
  if (!existing) {
    console.error(`No recipe with id "${id}".`);
    process.exit(1);
  }
  const info = db
    .prepare("UPDATE recipes SET creator_address = ? WHERE id = ?")
    .run(checksummed, id);
  if (info.changes < 1) {
    console.error(`Update did not modify any row for "${id}".`);
    process.exit(1);
  }
  console.log(
    `${id}: creator ${existing.creator_address} -> ${checksummed} ` +
      `(updated; the next request uses the new creator, no restart)`,
  );
}

function cmdResetDemo(db, price = "0.05") {
  if (!isValidUsdc(price)) {
    console.error(
      `Invalid USDC amount "${price}": expected a non-negative decimal with at ` +
        `most 6 fractional digits (e.g. 0.05).`,
    );
    process.exit(1);
  }
  const mnemonic = process.env.MNEMONIC?.trim();
  const creator = process.env.HARDCODED_CREATOR_ADDR?.trim() ||
    (mnemonic ? mnemonicToAccount(mnemonic, { addressIndex: 2 }).address : "");
  if (!creator) {
    console.error(
      "No creator configured. Set HARDCODED_CREATOR_ADDR or MNEMONIC before reset-demo.",
    );
    process.exit(1);
  }
  const checksummed = getAddress(creator);
  const existing = db
    .prepare("SELECT id FROM recipes WHERE id = ?")
    .get("legal-reviewer-v1");
  if (!existing) {
    console.error(
      'No recipe with id "legal-reviewer-v1". Start the backend once to seed the DB.',
    );
    process.exit(1);
  }
  db.prepare("UPDATE recipes SET price_usdc = ?, creator_address = ? WHERE id = ?")
    .run(price, checksummed, "legal-reviewer-v1");
  console.log(
    `legal-reviewer-v1 reset: price=${price} USDC creator=${checksummed}`,
  );
}

function usage() {
  console.error(
      "usage:\n" +
      "  recipe-admin.mjs list\n" +
      "  recipe-admin.mjs show <recipeId>\n" +
      "  recipe-admin.mjs set-price <recipeId> <priceUsdc>\n" +
      "  recipe-admin.mjs set-creator <recipeId> <address>\n" +
      "  recipe-admin.mjs reset-demo [priceUsdc]",
  );
  process.exit(1);
}

const [cmd, ...args] = process.argv.slice(2);
const db = openDb();
try {
  if (cmd === "list") cmdList(db);
  else if (cmd === "show") cmdShow(db, args[0]);
  else if (cmd === "set-price") cmdSetPrice(db, args[0], args[1]);
  else if (cmd === "set-creator") cmdSetCreator(db, args[0], args[1]);
  else if (cmd === "reset-demo") cmdResetDemo(db, args[0]);
  else usage();
} finally {
  db.close();
}
