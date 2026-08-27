import { describe, expect, it } from "vitest";
import { FLORIDA_COUNTIES, normalizeFloridaCounty } from "./florida-county";

describe("Florida county normalization", () => {
  it("keeps canonical names unmapped", () => {
    const result = normalizeFloridaCounty("Miami-Dade");
    expect(result).toEqual({
      raw: "Miami-Dade",
      canonical: "Miami-Dade",
      mapped: false,
      mapping: null,
    });
  });

  it("maps only documented exact aliases", () => {
    expect(normalizeFloridaCounty("Dade").mapping).toBe("Dade → Miami-Dade");
    expect(normalizeFloridaCounty("Hillsborou").canonical).toBe("Hillsborough");
    expect(normalizeFloridaCounty("Desoto").canonical).toBe("DeSoto");
  });

  it("does not fuzzy-match unknown strings", () => {
    const result = normalizeFloridaCounty("Hillsboro");
    expect(result.canonical).toBeNull();
    expect(result.mapped).toBe(false);
  });

  it("has 67 canonical counties", () => {
    expect(FLORIDA_COUNTIES).toHaveLength(67);
    expect(new Set(FLORIDA_COUNTIES).size).toBe(67);
  });
});
