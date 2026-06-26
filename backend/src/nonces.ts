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
 * In-memory is correct for the single-process MVP; a multi-process deployment
 * would back this with a shared store (e.g. Redis SETNX).
 */
import type { Address } from "viem";

interface NonceRecord {
  /** Unix seconds after which this record may be pruned. */
  expiry: bigint;
  /** True once a charge settled — permanently spent until expiry. */
  settled: boolean;
}

/** key = `${agent.toLowerCase()}:${nonce}` -> claim record. */
const claimed = new Map<string, NonceRecord>();

function key(agent: Address, nonce: bigint): string {
  return `${agent.toLowerCase()}:${nonce.toString()}`;
}

/** Drop records whose voucher expiry has passed (those vouchers are dead anyway). */
function prune(nowSec: bigint): void {
  for (const [k, rec] of claimed) {
    if (rec.expiry <= nowSec) claimed.delete(k);
  }
}

/**
 * Atomically claim a voucher nonce for an in-flight call. Returns true if the
 * nonce was free (caller may proceed), false if it was already claimed/settled
 * (caller must reject the request as a replay). Synchronous so concurrent
 * identical submissions cannot both observe a free slot.
 */
export function claimNonce(
  agent: Address,
  nonce: bigint,
  expiry: bigint,
  nowSec: bigint,
): boolean {
  prune(nowSec);
  const k = key(agent, nonce);
  if (claimed.has(k)) return false;
  claimed.set(k, { expiry, settled: false });
  return true;
}

/** Mark a claimed nonce permanently spent — call only after a charge settles. */
export function settleNonce(agent: Address, nonce: bigint): void {
  const rec = claimed.get(key(agent, nonce));
  if (rec) rec.settled = true;
}

/**
 * Free a claimed-but-unsettled nonce so a legitimate retry can reuse the same
 * voucher. A nonce already marked settled is left spent (never reopened).
 */
export function releaseNonce(agent: Address, nonce: bigint): void {
  const k = key(agent, nonce);
  const rec = claimed.get(k);
  if (rec && !rec.settled) claimed.delete(k);
}

/** Test/diagnostic helper: number of live claim records. */
export function claimedCount(): number {
  return claimed.size;
}
