import { describe, it, expect } from "vitest";
import { parseUsdcAmount } from "../src/recipes.js";

describe("parseUsdcAmount (USDC 6-decimal base units)", () => {
  it("parses valid decimal strings to exact base units", () => {
    expect(parseUsdcAmount("0.05")).toBe(50_000n);
    expect(parseUsdcAmount("1")).toBe(1_000_000n);
    expect(parseUsdcAmount("0.000001")).toBe(1n);
    expect(parseUsdcAmount("10.5")).toBe(10_500_000n);
  });

  it("rejects more than 6 fractional digits", () => {
    expect(() => parseUsdcAmount("0.0000001")).toThrow();
  });

  it("rejects negative, grouped, scientific, empty, and non-numeric input", () => {
    expect(() => parseUsdcAmount("-1")).toThrow();
    expect(() => parseUsdcAmount("1,5")).toThrow();
    expect(() => parseUsdcAmount("5e-2")).toThrow();
    expect(() => parseUsdcAmount("")).toThrow();
    expect(() => parseUsdcAmount("abc")).toThrow();
  });
});
