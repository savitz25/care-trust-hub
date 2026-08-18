import { describe, expect, it } from "vitest";
import { resolveIdentityCandidate, type MatchFeature } from "./facility-intelligence";

const feature = (
  key: MatchFeature["key"],
  outcome: MatchFeature["outcome"],
  weight = 1,
): MatchFeature => ({ key, outcome, weight, reason: `${key} ${outcome}` });

describe("facility identity resolution", () => {
  it.each([
    ["VERIFIED", [feature("address", "match"), feature("zip", "match"), feature("phone", "match")]],
    [
      "PROBABLE",
      [feature("address", "match", 1), feature("zip", "match", 1), feature("phone", "missing", 1)],
    ],
    ["REVIEW_REQUIRED", [feature("cms_ccn", "conflict"), feature("address", "match")]],
    ["REJECTED", [feature("address", "conflict"), feature("phone", "conflict")]],
    ["UNRESOLVED", [feature("address", "missing"), feature("phone", "missing")]],
  ] as const)("returns %s with reconstructable features", (expected, features) => {
    const decision = resolveIdentityCandidate(features);
    expect(decision.state).toBe(expected);
    expect(decision.matchingFeatures).toEqual(features);
    expect(decision.thresholdVersion).toBe("facility-identity-v1");
  });

  it("never promotes the highest candidate when an authority conflict exists", () => {
    const decision = resolveIdentityCandidate([
      feature("state_license", "conflict", 0.1),
      feature("address", "match", 10),
      feature("phone", "match", 10),
      feature("facility_name", "match", 10),
    ]);
    expect(decision.state).toBe("REVIEW_REQUIRED");
    expect(decision.conflicts).toHaveLength(1);
  });
});
