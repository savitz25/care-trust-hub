import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareOwnershipIntelligence, CareProviderDetail } from "./types";

vi.mock("server-only", () => ({}));
const query = vi.fn();
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));

const source = {
  sourceOrganization: "CMS",
  datasetName: "Owners",
  cmsDatasetIdentifier: "owners",
  officialSourceUrl: "https://data.cms.gov",
  releaseIdentifier: "2026-07-27",
  sourceModifiedAt: "2026-07-27T00:00:00.000Z",
  retrievedAt: "2026-08-15T00:00:00.000Z",
};

const provider = {
  ccn: "055001",
  providerName: "Example",
  ownershipType: "For profit - Corporation",
  location: { state: "CA" },
} as CareProviderDetail;

const ownership: CareOwnershipIntelligence = {
  totalPartyCount: 2,
  parties: [
    {
      id: "1",
      kind: "organization",
      organizationId: "org-1",
      displayName: "EXAMPLE LLC",
      roleCode: "34",
      roleText: "DIRECT OWNERSHIP",
      associationDate: null,
      ownershipPercentage: null,
      classifications: {},
      connectedProviderCount: 4,
      connectedStates: ["CA"],
      source,
    },
    {
      id: "2",
      kind: "individual",
      organizationId: null,
      displayName: "SMITH, JANE",
      roleCode: "34",
      roleText: "5% OR GREATER DIRECT OWNERSHIP INTEREST",
      associationDate: null,
      ownershipPercentage: 10,
      classifications: {},
      connectedProviderCount: null,
      connectedStates: [],
      source,
    },
  ],
  changes: [],
};

describe("ownership intelligence v2 read path", () => {
  beforeEach(() => query.mockReset());

  it("loads portfolio metrics for a connected organization without ranking", async () => {
    query.mockResolvedValue({
      rows: [
        {
          ccn: "055001",
          provider_name: "A Facility",
          city: "Redlands",
          state_code: "CA",
          overall_rating: 3,
          staffing_rating: 4,
          health_inspection_rating: 2,
          quality_measure_rating: 3,
          had_penalty: true,
          penalty_amount: "10000",
          had_ownership_change: false,
          had_recent_state: true,
          rn_hprd: "0.50",
          total_nurse_hprd: "3.20",
          relationship_type: "DIRECT OWNERSHIP",
        },
        {
          ccn: "055002",
          provider_name: "B Facility",
          city: "Fresno",
          state_code: "CA",
          overall_rating: 4,
          staffing_rating: 3,
          health_inspection_rating: 3,
          quality_measure_rating: 4,
          had_penalty: false,
          penalty_amount: null,
          had_ownership_change: true,
          had_recent_state: false,
          rn_hprd: "0.70",
          total_nurse_hprd: "3.40",
          relationship_type: "DIRECT OWNERSHIP",
        },
        {
          ccn: "055003",
          provider_name: "C Facility",
          city: "Bakersfield",
          state_code: "CA",
          overall_rating: 2,
          staffing_rating: 2,
          health_inspection_rating: 2,
          quality_measure_rating: 2,
          had_penalty: true,
          penalty_amount: "5000",
          had_ownership_change: false,
          had_recent_state: false,
          rn_hprd: "0.40",
          total_nurse_hprd: "3.00",
          relationship_type: "DIRECT OWNERSHIP",
        },
      ],
    });
    const { getOwnershipOperationSummary } = await import("./ownership-v2");
    const result = await getOwnershipOperationSummary(provider, ownership);
    expect(query.mock.calls[0][0]).not.toContain("google_");
    expect(result.individualCount).toBe(1);
    expect(result.whoIsBehind.join(" ")).toMatch(/individual ownership/);
    expect(result.portfolio?.facilityCount).toBe(3);
    expect(result.portfolio?.overallAverage).toBe(3);
    expect(result.portfolio?.relatedFacilities[0]?.providerName).toBe("A Facility");
    expect(JSON.stringify(result)).not.toMatch(/Trust Score|best|worst|ultimate owner/i);
  });

  it("does not query a portfolio when fewer than three connected facilities exist", async () => {
    const small: CareOwnershipIntelligence = {
      ...ownership,
      parties: ownership.parties.map((party) =>
        party.kind === "organization" ? { ...party, connectedProviderCount: 2 } : party,
      ),
    };
    const { getOwnershipOperationSummary } = await import("./ownership-v2");
    const result = await getOwnershipOperationSummary(provider, small);
    expect(query).not.toHaveBeenCalled();
    expect(result.portfolio).toBeNull();
  });
});
