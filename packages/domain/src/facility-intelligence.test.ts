import { describe, expect, it } from "vitest";
import {
  FACILITY_IDENTITY_RESOLVER_V2,
  resolveIdentityCandidate,
  resolveIdentityCandidateV2,
  type IdentityResolutionContextV2,
  type MatchFeature,
} from "./facility-intelligence";

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

const safeContext: IdentityResolutionContextV2 = {
  competingPlausibleCandidates: 1,
  campusAmbiguity: false,
  sharedPlaceScope: "facility_specific",
  careTypeConflict: false,
  rejectedCandidate: false,
};

describe("facility identity resolver v2", () => {
  const strongIdentity = [
    feature("facility_name", "match", 4),
    feature("street_number", "match", 3),
    feature("state", "match", 5),
    feature("zip", "match", 3),
    feature("coordinates", "match", 4),
  ];

  it("verifies entity identity while keeping a conflicting phone under review", () => {
    const decision = resolveIdentityCandidateV2(
      [...strongIdentity, feature("phone", "conflict", 4)],
      safeContext,
    );
    expect(decision.state).toBe("VERIFIED");
    expect(decision.fieldClaims.phone.state).toBe("REVIEW_REQUIRED");
    expect(decision.thresholdVersion).toBe(FACILITY_IDENTITY_RESOLVER_V2);
  });

  it("accepts an alias only with strong independent location evidence", () => {
    expect(resolveIdentityCandidateV2(strongIdentity, safeContext).state).toBe("VERIFIED");
    expect(
      resolveIdentityCandidateV2(
        [feature("facility_name", "match", 4), feature("zip", "match", 3)],
        safeContext,
      ).state,
    ).not.toBe("VERIFIED");
  });

  it.each([
    ["care type", { careTypeConflict: true }],
    ["hospital campus", { campusAmbiguity: true }],
    ["shared Place", { sharedPlaceScope: "campus_level" as const }],
    ["multiple candidates", { competingPlausibleCandidates: 2 }],
  ])("keeps %s ambiguity under review", (_label, override) => {
    expect(resolveIdentityCandidateV2(strongIdentity, { ...safeContext, ...override }).state).toBe(
      "REVIEW_REQUIRED",
    );
  });

  it("preserves rejected candidates as negative evidence", () => {
    expect(
      resolveIdentityCandidateV2(strongIdentity, { ...safeContext, rejectedCandidate: true }).state,
    ).toBe("REJECTED");
  });

  it("retains the same campus identity only after an independent prior audit", () => {
    const auditedCampus = {
      ...safeContext,
      campusAmbiguity: true,
      priorIndependentAuditPass: true,
    };
    expect(resolveIdentityCandidateV2(strongIdentity, auditedCampus).state).toBe("VERIFIED");
    expect(
      resolveIdentityCandidateV2(strongIdentity, {
        ...auditedCampus,
        careTypeConflict: true,
      }).state,
    ).toBe("REVIEW_REQUIRED");
  });

  it("does not accept a same-market sibling with a conflicting address", () => {
    const decision = resolveIdentityCandidateV2(
      [
        feature("facility_name", "match", 4),
        feature("street_number", "conflict", 3),
        feature("coordinates", "conflict", 4),
        feature("state", "match", 5),
      ],
      safeContext,
    );
    expect(decision.state).toBe("REVIEW_REQUIRED");
  });

  it("keeps a corporate website separate from entity identity", () => {
    const decision = resolveIdentityCandidateV2(
      [...strongIdentity, feature("official_domain", "conflict", 2)],
      safeContext,
    );
    expect(decision.state).toBe("VERIFIED");
    expect(decision.fieldClaims.website.state).toBe("REVIEW_REQUIRED");
  });
});
