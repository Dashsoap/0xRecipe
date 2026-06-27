/**
 * Per-call voucher nonce replay guard (IMPLEMENTATION_PLAN §1.5 C10).
 *
 * A voucher authorizes exactly one paid call. Without tracking used nonces a
 * captured PAYMENT-SIGNATURE header could be replayed within its expiry window
 * to charge the agent repeatedly (draining the prepaid escrow). We claim each
 * (agent, nonce) the moment it is presented and reject any repeat, so one signed
 * voucher settles at most once.
 *
 * Lifecycle: a nonce is claimed synchronously before the solvency reserve, so
 * two identical submissions cannot both proceed. If the call fails BEFORE a
 * charge settles, the nonce is freed so the agent can legitimately retry the
 * same voucher — only a settled charge marks a nonce permanently spent (kept
 * until its voucher expiry, after which the expiry check rejects it anyway and
 * the record can be pruned).
 *
 * Storage: SQLite-backed (better-sqlite3 prepared statements, synchronous).
 * Persisting the table means a process restart no longer opens a replay window
 * for any voucher captured within its (at most 120 s) expiry. The handle is the
 * same database used for recipes + the ledger, so no extra dependency.
 */
import type { Address } from "viem";
import { db } from "./db.js";

// Idempotent schema. Safe to run on every boot.
db.exec(`
  CREATE TABLE IF NOT EXISTS voucher_nonces (
    agent    TEXT    NOT NULL,
    nonce    TEXT    NOT NULL,
    expiry   INTEGER NOT NULL,
    settled  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (agent, nonce)
  );
  CREATE INDEX IF NOT EXISTS idx_voucher_nonces_expiry ON voucher_nonces(expiry);
`);

// --- Prepared statements -----------------------------------------------------

const pruneStmt = db.prepare(
  "DELETE FROM voucher_nonces WHERE expiry <= ?",
);
const claimStmt = db.prepare(
  "INSERT OR IGNORE INTO voucher_nonces (agent, nonce, expiry) VALUES (?, ?, ?)",
);
const settleStmt = db.prepare(
  "UPDATE voucher_nonces SET settled = 1 WHERE agent = ? AND nonce = ?",
);
const releaseStmt = db.prepare(
  "DELETE FROM voucher_nonces WHERE agent = ? AND nonce = ? AND settled = 0",
);
const countStmt = db.prepare(
  "SELECT COUNT(*) AS n FROM voucher_nonces",
);

// --- Public API --------------------------------------------------------------

/**
 * Atomically claim a voucher nonce for an in-flight call. Returns true if the
 * nonce was free (caller may proceed), false if it was already claimed/settled
 * (caller must reject the request as a replay).
 *
 * Atomic via `INSERT OR IGNORE` — SQLite's primary-key conflict resolution
 * serializes concurrent inserts, so two identical submissions cannot both
 * observe a free slot. Expired records on the same key are pruned first so a
 * fresh claim past expiry succeeds (matches the prior in-memory semantics).
 */
export function claimNonce(
  agent: Address,
  nonce: bigint,
  expiry: bigint,
  nowSec: bigint,
): boolean {
  // Drop dead records first so this nonce can be re-claimed past its old expiry.
  // Cheap because of the expiry index; a separate background sweep also runs.
  pruneStmt.run(Number(nowSec));
  const result = claimStmt.run(
    agent.toLowerCase(),
    nonce.toString(),
    Number(expiry),
  );
  return result.changes === 1; // 0 means a row already existed.
}

/** Mark a claimed nonce permanently spent — call only after a charge settles. */
export function settleNonce(agent: Address, nonce: bigint): void {
  settleStmt.run(agent.toLowerCase(), nonce.toString());
}

/**
 * Free a claimed-but-unsettled nonce so a legitimate retry can reuse the same
 * voucher. The WHERE clause guards `settled = 0`, so a nonce already marked
 * settled is left spent (never reopened post-charge).
 */
export function releaseNonce(agent: Address, nonce: bigint): void {
  releaseStmt.run(agent.toLowerCase(), nonce.toString());
}

/** Test / diagnostic helper: number of live claim records. */
export function claimedCount(): number {
  const row = countStmt.get() as { n: number };
  return row.n;
}

// Background prune: trim stale rows every 60 s under a fresh `nowSec`. Keeps
// the table small on an idle server even if no claimNonce calls arrive. .unref()
// so the timer never holds the process open at shutdown.
const pruneInterval = setInterval(
  () => pruneStmt.run(Math.floor(Date.now() / 1000)),
  60_000,
);
pruneInterval.unref();
