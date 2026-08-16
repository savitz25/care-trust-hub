import { describe, expect, it } from "vitest";
import { parsePublicProviderSelection, parseShortlistNames } from "./shortlist-contract";

describe("public shortlist contract", () => {
  it("parses multiline input and enforces the ten-name bound", () => {
    const parsed = parseShortlistNames(
      Array.from({ length: 12 }, (_, index) => `Facility ${index}`).join("\n"),
    );
    expect(parsed.names).toHaveLength(10);
    expect(parsed.truncated).toBe(true);
  });
  it("retains only unique public CMS IDs and bounds compare at three", () => {
    expect(parsePublicProviderSelection("015019,01a193,015019,bad", 3)).toEqual([
      "015019",
      "01A193",
    ]);
  });
});
