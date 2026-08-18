import { describe, expect, it } from "vitest";
import {
  canPublishPortfolioMembership,
  classifyMembershipStatus,
  classifyOrganizationRisk,
  classifyOwnershipRole,
  computePortfolioMetrics,
  corroboratesGovernmentSources,
  isOrganizationPageIndexable,
  isPortfolioPublicationEligible,
  organizationLabelsCompatible,
  PORTFOLIO_MIN_FACILITIES,
  selectCurrentMembers,
  selectPortfolioOrganization,
  whoIsBehindItems,
  type PortfolioFacilityInput,
} from "./ownership-intelligence";

const facility = (overrides: Partial<PortfolioFacilityInput> = {}): PortfolioFacilityInput => ({
  overallRating: 3,
  staffingRating: 4,
  healthInspectionRating: 2,
  qualityMeasureRating: 3,
  rnHprd: 0.6,
  totalNurseHprd: 3.4,
  hadPenalty: false,
  penaltyAmount: null,
  hadOwnershipChange: false,
  hadRecentStateEnforcement: false,
  hadRecentCmsPenalty: false,
  hadRecentHighValueEnforcement: false,
  hadRecentComplaintInspection: false,
  ...overrides,
});

describe("ownership intelligence v2", () => {
  it("treats LLC punctuation as compatible but does not collapse different legal names", () => {
    expect(organizationLabelsCompatible("ABC Healthcare LLC", "ABC Healthcare, L.L.C.")).toBe(true);
    expect(organizationLabelsCompatible("ABC Healthcare", "ABC Health Holdings")).toBe(false);
  });

  it("keeps operators and managers distinct from owners", () => {
    expect(
      classifyOwnershipRole({ kind: "organization", roleText: "5% OR GREATER DIRECT OWNERSHIP" }),
    ).toBe("organization_owner");
    expect(classifyOwnershipRole({ kind: "organization", roleText: "MANAGERIAL CONTROL" })).toBe(
      "managing_organization",
    );
    expect(
      classifyOwnershipRole({
        kind: "individual",
        roleText: "5% OR GREATER DIRECT OWNERSHIP INTEREST",
      }),
    ).toBe("individual_owner");
  });

  it("requires at least three connected facilities before selecting a portfolio organization", () => {
    expect(PORTFOLIO_MIN_FACILITIES).toBe(3);
    expect(
      selectPortfolioOrganization([
        {
          kind: "organization",
          displayName: "Example LLC",
          roleText: "DIRECT OWNERSHIP",
          organizationId: "org-1",
          connectedProviderCount: 2,
        },
      ]),
    ).toBeNull();
    const selected = selectPortfolioOrganization([
      {
        kind: "organization",
        displayName: "Example LLC",
        roleText: "DIRECT OWNERSHIP",
        organizationId: "org-1",
        connectedProviderCount: 4,
      },
      {
        kind: "organization",
        displayName: "Manager Inc",
        roleText: "MANAGERIAL CONTROL",
        organizationId: "org-2",
        connectedProviderCount: 9,
      },
    ]);
    expect(selected?.displayName).toBe("Example LLC");
  });

  it("averages only valid 1-5 ratings and does not treat missing as zero", () => {
    const metrics = computePortfolioMetrics(
      [
        facility({ overallRating: 5 }),
        facility({ overallRating: 1 }),
        facility({ overallRating: 3 }),
        facility({ overallRating: null }),
      ],
      2,
    );
    expect(metrics.overall.average).toBe(3);
    expect(metrics.overall.sampleSize).toBe(3);
    expect(metrics.overall.distribution[5]).toBe(1);
    expect(metrics.facilityCount).toBe(4);
    expect(JSON.stringify(metrics)).not.toMatch(/score|grade|best|worst/i);
  });

  it("withholds averages when fewer than three valid observations exist", () => {
    const metrics = computePortfolioMetrics(
      [
        facility({ overallRating: 5 }),
        facility({ overallRating: null }),
        facility({ overallRating: 4 }),
      ],
      1,
    );
    expect(metrics.overall.average).toBeNull();
    expect(metrics.overall.sampleSize).toBe(2);
  });

  it("summarizes who is behind a facility without inventing control", () => {
    const items = whoIsBehindItems({
      operator: "Operator LLC",
      licensee: "Licensee LLC",
      organizationOwners: 2,
      individuals: 6,
      chainName: "Example Group",
      ownershipChanges: 1,
    });
    expect(items.join(" ")).toMatch(/operating organization/);
    expect(items.join(" ")).toMatch(/6 individual ownership interests/);
    expect(items.join(" ")).not.toMatch(/ultimate owner|beneficial owner/i);
  });

  it("classifies current, historical, and uncertain membership without inferring acquisitions", () => {
    expect(
      classifyMembershipStatus({ inLatestSuccessfulRelease: true, seenInOlderRelease: true }),
    ).toBe("current");
    expect(
      classifyMembershipStatus({ inLatestSuccessfulRelease: false, seenInOlderRelease: true }),
    ).toBe("historical");
    expect(
      classifyMembershipStatus({ inLatestSuccessfulRelease: false, seenInOlderRelease: false }),
    ).toBe("uncertain");
    expect(
      selectCurrentMembers([
        { id: "a", membershipStatus: "current" as const },
        { id: "b", membershipStatus: "historical" as const },
        { id: "c", membershipStatus: "uncertain" as const },
      ]).map((member) => member.id),
    ).toEqual(["a"]);
  });

  it("rejects fuzzy-name-only and non-verified membership from published portfolios", () => {
    expect(
      canPublishPortfolioMembership({
        organizationId: "org-1",
        resolutionState: "VERIFIED",
        matchMethod: "authoritative_identifier",
      }),
    ).toBe(true);
    expect(
      canPublishPortfolioMembership({
        organizationId: "org-1",
        resolutionState: "PROBABLE",
        matchMethod: "authoritative_identifier",
      }),
    ).toBe(false);
    expect(
      canPublishPortfolioMembership({
        organizationId: "org-1",
        resolutionState: "VERIFIED",
        matchMethod: "fuzzy_name",
      }),
    ).toBe(false);
    expect(
      canPublishPortfolioMembership({
        organizationId: null,
        resolutionState: "VERIFIED",
        matchMethod: "authoritative_identifier",
      }),
    ).toBe(false);
  });

  it("keeps generic and person-like organizations off published pages", () => {
    expect(classifyOrganizationRisk("Genesis Healthcare LLC")).toBe("clear");
    expect(classifyOrganizationRisk("Healthcare LLC")).toBe("generic");
    expect(classifyOrganizationRisk("SMITH, JOHN")).toBe("person_like");
    expect(
      isPortfolioPublicationEligible({
        resolutionState: "VERIFIED",
        currentFacilityCount: 3,
        risk: "clear",
      }),
    ).toBe(true);
    expect(
      isPortfolioPublicationEligible({
        resolutionState: "VERIFIED",
        currentFacilityCount: 2,
        risk: "clear",
      }),
    ).toBe(false);
    expect(
      isPortfolioPublicationEligible({
        resolutionState: "REVIEW_REQUIRED",
        currentFacilityCount: 12,
        risk: "generic",
      }),
    ).toBe(false);
    expect(isOrganizationPageIndexable({ publicationEligible: true })).toBe(true);
    expect(isOrganizationPageIndexable({ publicationEligible: false })).toBe(false);
  });

  it("labels cross-source corroboration only for defensible exact-compatible names", () => {
    expect(
      corroboratesGovernmentSources({
        cmsOrganizationNames: ["ABC Operations LLC"],
        stateOperator: "ABC Operations, L.L.C.",
        stateLicensee: null,
      }),
    ).toBe(true);
    expect(
      corroboratesGovernmentSources({
        cmsOrganizationNames: ["ABC Operations LLC"],
        stateOperator: "ABC Health Holdings",
        stateLicensee: "Unrelated Licensee Inc",
      }),
    ).toBe(false);
  });

  it("aggregates recent CMS penalties and complaint inspections separately from state events", () => {
    const metrics = computePortfolioMetrics(
      [
        facility({
          hadRecentCmsPenalty: true,
          hadRecentHighValueEnforcement: true,
          hadRecentComplaintInspection: true,
          hadRecentStateEnforcement: true,
        }),
        facility({ hadRecentCmsPenalty: true, hadRecentComplaintInspection: true }),
        facility({}),
      ],
      1,
    );
    expect(metrics.facilitiesWithRecentCmsPenalty).toBe(2);
    expect(metrics.facilitiesWithRecentHighValueEnforcement).toBe(1);
    expect(metrics.facilitiesWithRecentComplaintInspection).toBe(2);
    expect(metrics.facilitiesWithRecentStateEnforcement).toBe(1);
  });
});
