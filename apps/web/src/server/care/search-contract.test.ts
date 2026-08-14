import { describe, expect, it } from "vitest";
import { parseConsumerSearch } from "./search-contract";

describe("consumer provider search contract", () => {
  it("maps verified filters and fixes the result ceiling", () => {
    const parsed = parseConsumerSearch(
      new URLSearchParams(
        "search=1&q=01a193&state=al&zip=35004&overall=5&medicare=yes&sort=cms-overall-desc",
      ),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.submitted).toBe(true);
    expect(parsed.criteria).toMatchObject({
      query: "01a193",
      state: "AL",
      zip: "35004",
      overallRating: 5,
      medicare: true,
      sort: "cms-overall-desc",
      limit: 25,
    });
  });

  it("rejects malformed filters and incomplete radius input", () => {
    const parsed = parseConsumerSearch(
      new URLSearchParams("search=1&state=Alabama&zip=12&overall=0&lat=33&sort=distance"),
    );
    expect(parsed.errors.length).toBeGreaterThanOrEqual(5);
  });

  it("accepts a complete bounded coordinate search", () => {
    const parsed = parseConsumerSearch(
      new URLSearchParams("search=1&lat=33.5&lon=-86.8&radius=10&sort=distance"),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.criteria).toMatchObject({
      latitude: 33.5,
      longitude: -86.8,
      radiusMiles: 10,
      sort: "distance",
    });
  });
});
