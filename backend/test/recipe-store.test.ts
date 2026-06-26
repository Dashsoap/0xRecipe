import { describe, it, expect } from "vitest";
import { getRecipe, listRecipes } from "../src/recipes.js";
import { listRecipeRows, updatePrice } from "../src/db.js";

// NODE_ENV=test (vitest.config) makes db.ts use an in-memory database, so this
// file runs against a fresh, auto-seeded store with no fixture files. Tests run
// in declaration order within the file and share that one in-memory DB — the
// updatePrice case below is the proof that a price changes WITHOUT a restart.
describe("recipe store (SQLite-backed, in-memory under test)", () => {
  it("auto-seeds 'legal-reviewer-v1' on a fresh database", () => {
    const ids = listRecipeRows().map((r) => r.id);
    expect(ids).toContain("legal-reviewer-v1");
    expect(listRecipes().some((r) => r.id === "legal-reviewer-v1")).toBe(true);
  });

  it("getRecipe returns the seed with priceUnits===50000n for the default 0.05", () => {
    const recipe = getRecipe("legal-reviewer-v1");
    expect(recipe).toBeDefined();
    expect(recipe?.pricePerCallUsdc).toBe("0.05");
    expect(recipe?.priceUnits).toBe(50_000n);
    // Panel/judge survive the JSON round-trip intact.
    expect(recipe?.panel).toHaveLength(2);
    expect(recipe?.judge.instruction.length).toBeGreaterThan(0);
  });

  it("getRecipe('nope') is undefined for an unknown id", () => {
    expect(getRecipe("nope")).toBeUndefined();
  });

  it("updatePrice is reflected by getRecipe in the SAME process (no restart)", () => {
    expect(updatePrice("legal-reviewer-v1", "0.07")).toBe(true);

    const recipe = getRecipe("legal-reviewer-v1");
    expect(recipe?.pricePerCallUsdc).toBe("0.07");
    expect(recipe?.priceUnits).toBe(70_000n);
  });

  it("updatePrice returns false for an unknown id", () => {
    expect(updatePrice("nope", "0.10")).toBe(false);
  });
});
