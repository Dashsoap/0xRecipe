import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import {
  claimNonce,
  settleNonce,
  releaseNonce,
  claimedCount,
} from "../src/nonces.js";

/** Cast a hex string to the viem Address type for the claim API. */
const addr = (hex: string): Address => hex as Address;

// Each test uses a distinct agent address: the claim map is module-global state
// with no reset hook, so isolating agents keeps tests independent of order.
const FAR_FUTURE = 9_999_999_999n;
const NOW = 1_000n;

describe("nonces replay guard", () => {
  it("accepts the first claim and rejects an identical repeat (replay)", () => {
    const agent = addr("0x1111111111111111111111111111111111111111");
    expect(claimNonce(agent, 1n, FAR_FUTURE, NOW)).toBe(true);
    expect(claimNonce(agent, 1n, FAR_FUTURE, NOW)).toBe(false);
    // claimedCount tracks live records.
    expect(claimedCount()).toBeGreaterThanOrEqual(1);
  });

  it("releaseNonce frees an unsettled nonce so a legitimate retry re-claims", () => {
    const agent = addr("0x2222222222222222222222222222222222222222");
    expect(claimNonce(agent, 1n, FAR_FUTURE, NOW)).toBe(true);
    releaseNonce(agent, 1n);
    expect(claimNonce(agent, 1n, FAR_FUTURE, NOW)).toBe(true);
  });

  it("after settleNonce a releaseNonce does NOT reopen the nonce (stays spent)", () => {
    const agent = addr("0x3333333333333333333333333333333333333333");
    expect(claimNonce(agent, 1n, FAR_FUTURE, NOW)).toBe(true);
    settleNonce(agent, 1n);
    releaseNonce(agent, 1n); // must be a no-op once settled
    expect(claimNonce(agent, 1n, FAR_FUTURE, NOW)).toBe(false);
  });

  it("two different agents with the same nonce do not collide", () => {
    const a1 = addr("0x4444444444444444444444444444444444444444");
    const a2 = addr("0x5555555555555555555555555555555555555555");
    expect(claimNonce(a1, 7n, FAR_FUTURE, NOW)).toBe(true);
    expect(claimNonce(a2, 7n, FAR_FUTURE, NOW)).toBe(true);
  });

  it("prunes a record whose expiry <= nowSec on a later claim", () => {
    const agent = addr("0x6666666666666666666666666666666666666666");
    // Claim with expiry 100 at now=50; a repeat while still live is rejected.
    expect(claimNonce(agent, 100n, 100n, 50n)).toBe(true);
    expect(claimNonce(agent, 100n, 100n, 50n)).toBe(false);
    // A later claim at now=200 (> 100) prunes the expired record first, so the
    // same nonce is free again.
    expect(claimNonce(agent, 100n, 300n, 200n)).toBe(true);
  });

  it("compares the agent address case-insensitively (checksummed == lowercased)", () => {
    const checksummed = addr("0x0C382e685bbeeFE5d3d9C29e29E341fEE8E84C5d");
    const lowercased = addr("0x0c382e685bbeefe5d3d9c29e29e341fee8e84c5d");
    expect(claimNonce(checksummed, 42n, FAR_FUTURE, NOW)).toBe(true);
    // Same underlying address -> treated as already claimed.
    expect(claimNonce(lowercased, 42n, FAR_FUTURE, NOW)).toBe(false);
  });
});
