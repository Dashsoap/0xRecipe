/**
 * Solvency / hold management (IMPLEMENTATION_PLAN §1.5 steps 2-3).
 *
 * Before running a (paid) Fusion call we confirm the agent's on-chain escrow
 * balance, minus any amount currently held for in-flight calls, still covers
 * the price. The hold guards against a withdraw racing an in-flight call during
 * the few-second window between solvency check and charge.
 *
 * Holds live in process memory only — fine for the single-process MVP. All
 * amounts are USDC smallest units (bigint).
 */

import type { Address } from "viem";
import { readBalance } from "./escrow.js";

/** agent (lowercased) -> total amount currently held for in-flight calls. */
const held = new Map<string, bigint>();

function key(agent: Address): string {
  return agent.toLowerCase();
}

/** Amount currently held for an agent (0 if none). */
export function heldFor(agent: Address): bigint {
  return held.get(key(agent)) ?? 0n;
}

/** Place a hold for `amount` on an agent. */
export function hold(agent: Address, amount: bigint): void {
  const k = key(agent);
  held.set(k, (held.get(k) ?? 0n) + amount);
}

/**
 * Release a previously placed hold. Never goes negative; releasing more than is
 * held simply clears the entry.
 */
export function release(agent: Address, amount: bigint): void {
  const k = key(agent);
  const current = held.get(k) ?? 0n;
  const next = current - amount;
  if (next <= 0n) {
    held.delete(k);
  } else {
    held.set(k, next);
  }
}

export interface SolvencyResult {
  /** True when balance minus existing holds covers the price. */
  ok: boolean;
  /** On-chain escrow balance read this check (USDC smallest units). */
  balance: bigint;
  /** Amount already held for in-flight calls. */
  held: bigint;
  /** Spendable = balance - held. */
  available: bigint;
}

/**
 * Atomically reserve `price` for an in-flight call.
 *
 * Concurrency guarantee: the hold is placed SYNCHRONOUSLY before the async
 * balance read, so two requests from the same agent both observe each other's
 * holds when they resume after the read — only as many as the balance covers
 * pass, the rest are rejected. (A check-then-hold across the await would let
 * concurrent callers both pass and over-commit, then fail on-chain at charge.)
 *
 * On success the hold is RETAINED and the caller MUST release() it after the
 * charge succeeds or the run fails. On a budget shortfall — or a balance-read
 * error — the reservation is rolled back here before returning/throwing.
 *
 * `ok === false` means the budget wall was hit: the API returns 403 (not 402),
 * the agent should reason about the shortfall rather than re-sign.
 */
export async function reserve(
  agent: Address,
  price: bigint,
): Promise<SolvencyResult> {
  // Place the hold first so concurrent calls observe it across the await below.
  hold(agent, price);

  let balance: bigint;
  try {
    balance = await readBalance(agent);
  } catch (err) {
    release(agent, price); // roll back on read failure — nothing was spent
    throw err;
  }

  const totalHeld = heldFor(agent); // includes this reservation + concurrent ones
  const ok = balance >= totalHeld;
  const otherHeld = totalHeld - price; // holds excluding this reservation
  const available = balance - otherHeld;

  if (!ok) {
    release(agent, price); // give the reservation back
  }

  return { ok, balance, held: otherHeld, available };
}
