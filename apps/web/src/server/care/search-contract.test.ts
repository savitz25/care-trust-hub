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
      radiusMiles: 25,
      limit: 21,
      offset: 0,
    });
  });

  it("rejects malformed consumer location filters", () => {
    const parsed = parseConsumerSearch(
      new URLSearchParams("search=1&state=Alabama&zip=12&overall=0&lat=33&sort=distance"),
    );
    expect(parsed.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts ZIP distance options without exposing coordinates", () => {
    const parsed = parseConsumerSearch(
      new URLSearchParams("search=1&zip=33443&radius=10&sort=distance&page=2"),
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.criteria).toMatchObject({
      zip: "33443",
      radiusMiles: 10,
      sort: "distance",
      offset: 20,
    });
  });

  it("uses 25 miles by default and rejects unsupported distances", () => {
    expect(
      parseConsumerSearch(new URLSearchParams("search=1&zip=33443")).criteria.radiusMiles,
    ).toBe(25);
    expect(
      parseConsumerSearch(new URLSearchParams("search=1&zip=33443&radius=30")).errors,
    ).not.toEqual([]);
  });
});
