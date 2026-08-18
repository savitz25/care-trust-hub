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
      organizationId: "11111111-1111-4111-8111-111111111111",
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

  it("loads derived current portfolio metrics without ranking or raw ownership scans", async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            organization_id: "11111111-1111-4111-8111-111111111111",
            display_name: "EXAMPLE LLC",
            current_facility_count: 3,
            historical_facility_count: 1,
            state_count: 1,
            states: ["CA"],
            relationship_roles: ["DIRECT OWNERSHIP"],
            publication_eligible: true,
            indexable: true,
            snapshot: {
              overallAverage: 3,
              overallSampleSize: 3,
              overallDistribution: { 1: 0, 2: 1, 3: 1, 4: 1, 5: 0 },
              staffingAverage: 3,
              staffingSampleSize: 3,
              facilitiesWithPenalty: 2,
              totalFineAmount: 15000,
              facilitiesWithRecentCmsPenalty: 1,
              facilitiesWithRecentHighValueEnforcement: 1,
              facilitiesWithRecentComplaintInspection: 2,
              facilitiesWithRecentStateEnforcement: 0,
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            ccn: "055001",
            provider_name: "A Facility",
            city: "Redlands",
            state_code: "CA",
            overall_rating: 3,
            staffing_rating: 4,
            had_penalty: true,
            relationship_type: "DIRECT OWNERSHIP",
            membership_status: "current",
          },
        ],
      });
    const { getOwnershipOperationSummary } = await import("./ownership-v2");
    const result = await getOwnershipOperationSummary(provider, ownership);
    expect(query.mock.calls[0][0]).toContain("ownership_portfolio");
    expect(query.mock.calls[0][0]).toContain("publication_eligible");
    expect(query.mock.calls[0][0]).not.toContain("provider_ownership_relationship");
    expect(query.mock.calls[0][0]).not.toContain("google_");
    expect(result.individualCount).toBe(1);
    expect(result.portfolio?.facilityCount).toBe(3);
    expect(result.portfolio?.overallAverage).toBe(3);
    expect(result.portfolio?.historicalFacilityCount).toBe(1);
    expect(result.portfolio?.relatedFacilities[0]?.providerName).toBe("A Facility");
    expect(result.portfolio?.href).toContain("/ownership/");
    expect(JSON.stringify(result)).not.toMatch(/Trust Score|best|worst|ultimate owner/i);
  });

  it("does not publish a portfolio from historical-only or unpublished derived rows", async () => {
    query.mockResolvedValue({ rows: [] });
    const { getOwnershipOperationSummary } = await import("./ownership-v2");
    const result = await getOwnershipOperationSummary(provider, ownership);
    expect(result.portfolio).toBeNull();
    expect(query.mock.calls[0][0]).toContain("publication_eligible");
  });

  it("does not query portfolios when no CMS organization identity exists", async () => {
    const unnamed: CareOwnershipIntelligence = {
      ...ownership,
      parties: ownership.parties.map((party) =>
        party.kind === "organization" ? { ...party, organizationId: null } : party,
      ),
    };
    const { getOwnershipOperationSummary } = await import("./ownership-v2");
    const result = await getOwnershipOperationSummary(provider, unnamed);
    expect(query).not.toHaveBeenCalled();
    expect(result.portfolio).toBeNull();
  });
});
