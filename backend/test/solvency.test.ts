import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Address } from "viem";

// Mock the on-chain balance read so no RPC is ever hit. solvency.ts imports
// `readBalance` from "./escrow.js"; replacing that module isolates the hold
// logic from chain/config entirely.
vi.mock("../src/escrow.js", () => ({
  readBalance: vi.fn(),
}));

import { readBalance } from "../src/escrow.js";
import { reserve, release, hold, heldFor } from "../src/solvency.js";

const addr = (hex: string): Address => hex as Address;
const mockedReadBalance = vi.mocked(readBalance);

const PRICE = 50_000n;

beforeEach(() => {
  mockedReadBalance.mockReset();
});

describe("solvency.reserve", () => {
  it("succeeds when balance covers the price and reports available correctly", async () => {
    const agent = addr("0xaaaA000000000000000000000000000000000001");
    mockedReadBalance.mockResolvedValue(1_000_000n);

    const result = await reserve(agent, PRICE);

    expect(result.ok).toBe(true);
    expect(result.balance).toBe(1_000_000n);
    expect(result.held).toBe(0n); // no other in-flight holds
    expect(result.available).toBe(1_000_000n);
    // On success the hold is RETAINED for the caller to release later.
    expect(heldFor(agent)).toBe(PRICE);

    release(agent, PRICE); // clean up module-global state
  });

  it("fails when balance < price and rolls the hold back to zero", async () => {
    const agent = addr("0xaaaA000000000000000000000000000000000002");
    mockedReadBalance.mockResolvedValue(10_000n);

    const result = await reserve(agent, PRICE);

    expect(result.ok).toBe(false);
    expect(result.balance).toBe(10_000n);
    // Reservation rolled back: nothing left held.
    expect(heldFor(agent)).toBe(0n);
  });

  it("lets sequential reserves that fit pass, and fails the one that exceeds balance", async () => {
    const agent = addr("0xaaaA000000000000000000000000000000000003");
    mockedReadBalance.mockResolvedValue(120_000n); // covers two 50k holds, not three

    const first = await reserve(agent, PRICE);
    const second = await reserve(agent, PRICE);
    const third = await reserve(agent, PRICE);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(third.ok).toBe(false);
    // Two successful holds retained (100k); the third was rolled back.
    expect(heldFor(agent)).toBe(2n * PRICE);

    release(agent, 2n * PRICE);
  });

  it("rolls back the hold and rethrows if readBalance throws", async () => {
    const agent = addr("0xaaaA000000000000000000000000000000000004");
    mockedReadBalance.mockRejectedValue(new Error("rpc unavailable"));

    await expect(reserve(agent, PRICE)).rejects.toThrow("rpc unavailable");
    // Hold placed before the failed read must be released.
    expect(heldFor(agent)).toBe(0n);
  });
});

describe("solvency.release", () => {
  it("never drives held below zero", () => {
    const agent = addr("0xaaaA000000000000000000000000000000000005");
    hold(agent, PRICE);
    release(agent, 999_999n); // release more than is held
    expect(heldFor(agent)).toBe(0n);
    release(agent, PRICE); // releasing again on an empty entry stays at zero
    expect(heldFor(agent)).toBe(0n);
  });
});
