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
 * Check whether `agent` can afford `price`: on-chain balance minus current
 * holds must be >= price. Reads the live chain balance; the caller decides what
 * to do when `ok` is false (the API returns 403, not 402 — the agent should not
 * re-sign, it should reason about the shortfall).
 */
export async function checkSolvency(
  agent: Address,
  price: bigint,
): Promise<SolvencyResult> {
  const balance = await readBalance(agent);
  const currentHold = heldFor(agent);
  const available = balance - currentHold;
  return {
    ok: available >= price,
    balance,
    held: currentHold,
    available,
  };
}
