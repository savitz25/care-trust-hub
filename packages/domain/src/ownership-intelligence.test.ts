import { describe, expect, it } from "vitest";
import {
  classifyOwnershipRole,
  computePortfolioMetrics,
  organizationLabelsCompatible,
  PORTFOLIO_MIN_FACILITIES,
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
});
