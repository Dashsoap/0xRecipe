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
 * Per-agent promise chain — serializes reserve() for the same agent so the
 * "hold + balance read + total-held sample + decide + maybe-rollback" sequence
 * is atomic from a same-agent perspective. Different agents still run in
 * parallel (each has its own chain), so throughput is unaffected.
 *
 * Without this, concurrent same-agent reserves can read `totalHeld` while
 * other in-flight reserves are mid-await, producing two failure modes:
 *   (a) spurious 403s — a request gets rejected on holds that will release
 *       moments later when another reserve fails its Fusion run, and
 *   (b) misleading `available` numbers reported on 403 (concurrency noise,
 *       not ground truth) — which would in turn mislead the agent's brain
 *       when it reasons about whether to top up.
 */
const reserveChains = new Map<string, Promise<void>>();

/**
 * Atomically reserve `price` for an in-flight call.
 *
 * Concurrency guarantee: same-agent reserves are serialized through a tail
 * promise chain (see `reserveChains` above). Within the critical section, the
 * hold is still placed SYNCHRONOUSLY before the on-chain balance read; the
 * mutex ensures no other same-agent reserve can mutate `held` while we sample
 * `heldFor` and decide.
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
  const k = key(agent);
  const prev = reserveChains.get(k) ?? Promise.resolve();

  // Build this reservation's gate and chain it AFTER `prev`. The next concurrent
  // reserve will await `chained` and so on, forming a FIFO per-agent queue.
  let releaseGate!: () => void;
  const gate = new Promise<void>((r) => (releaseGate = r));
  const chained = prev.then(() => gate);
  reserveChains.set(k, chained);

  // Wait for any prior same-agent reserve to finish before entering our section.
  // `prev` only ever resolves (its tail `gate` is released in `finally`), so we
  // never deadlock on a thrown reservation upstream.
  await prev;

  try {
    // Critical section: synchronous hold, async balance read, sample, decide.
    // No other same-agent reserve can run any of these steps in parallel.
    hold(agent, price);

    let balance: bigint;
    try {
      balance = await readBalance(agent);
    } catch (err) {
      release(agent, price); // roll back on read failure — nothing was spent
      throw err;
    }

    const totalHeld = heldFor(agent); // this reservation + any older retained holds
    const ok = balance >= totalHeld;
    const otherHeld = totalHeld - price; // holds excluding this reservation
    const available = balance - otherHeld;

    if (!ok) {
      release(agent, price); // give the reservation back
    }

    return { ok, balance, held: otherHeld, available };
  } finally {
    // Release this gate so the next queued reserve can proceed. Trim the map
    // tail when we're the last in the chain so it can't grow unbounded under
    // long-running churn (Map check is identity, race-safe).
    releaseGate();
    if (reserveChains.get(k) === chained) {
      reserveChains.delete(k);
    }
  }
}
