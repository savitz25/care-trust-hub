import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getProvidersByCcns = vi.fn();
const getDecisionSummariesByCcns = vi.fn();
const getPublishedFacilityHistoriesByCcns = vi.fn();
const query = vi.fn();
const isRealProviderUiEnabled = vi.fn();
const isFacilityHistoryEnabled = vi.fn();
const isStateEnforcementIntelligenceEnabled = vi.fn();
const isStateRegulatoryIntelligenceEnabled = vi.fn();
const isOwnershipIntelligenceV2Enabled = vi.fn();
const isAssistedLivingIntelligenceEnabled = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./repository", () => ({ getProvidersByCcns, getDecisionSummariesByCcns }));
vi.mock("./history-repository", () => ({ getPublishedFacilityHistoriesByCcns }));
vi.mock("./db", () => ({ getCareDatabasePool: () => ({ query }) }));
vi.mock("./assisted-living-publication", () => ({ getPublishedAssistedLivingProvider: vi.fn() }));
vi.mock("./feature-flags", () => ({
  isRealProviderUiEnabled,
  isFacilityHistoryEnabled,
  isStateEnforcementIntelligenceEnabled,
  isStateRegulatoryIntelligenceEnabled,
  isOwnershipIntelligenceV2Enabled,
  isAssistedLivingIntelligenceEnabled,
}));

const provider = {
  ccn: "015009",
  providerName: "Example Manor",
  location: {
    city: "Example",
    state: "AL",
    address: null,
    zipCode: null,
    county: null,
    latitude: null,
    longitude: null,
  },
  ratings: { overall: 3, staffing: 3, healthInspection: 3, qualityMeasure: 3 },
  ownershipType: "For profit",
};

describe("family workspace batch read", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isRealProviderUiEnabled.mockReturnValue(true);
    isFacilityHistoryEnabled.mockReturnValue(true);
    isStateEnforcementIntelligenceEnabled.mockReturnValue(true);
    isStateRegulatoryIntelligenceEnabled.mockReturnValue(false);
    isOwnershipIntelligenceV2Enabled.mockReturnValue(false);
    isAssistedLivingIntelligenceEnabled.mockReturnValue(false);
    getProvidersByCcns.mockResolvedValue([provider]);
    getDecisionSummariesByCcns.mockResolvedValue([
      {
        ccn: "015009",
        staffingQuarter: "2026Q1",
        totalNurseHprd: 3.8,
        rnHprd: 0.5,
        weekendRnHprd: 0.3,
        inspectionDate: "2026-01-15",
        deficiencyCount: 2,
        latestPenaltyType: null,
        latestFineAmount: null,
        paymentDenialDays: null,
        ownershipPartyCount: 2,
        ownershipChangeDate: null,
        chainName: null,
        chainFacilityCount: null,
        chainStateCount: null,
        chainReleaseMonth: null,
      },
    ]);
    getPublishedFacilityHistoriesByCcns.mockResolvedValue(
      new Map([
        [
          "015009",
          {
            events: [],
            totalCount: 0,
            coverageLabel: "Limited historical data is available for this facility.",
            recentHighlights: [],
            emptyRecentLabel: "None",
          },
        ],
      ]),
    );
  });

  it("does not query on invalid CCNs and caps the batch at five", async () => {
    const { loadFamilyWorkspaceComparison } = await import("./family-workspace-repository");
    await loadFamilyWorkspaceComparison(["bad", "015009'; DROP TABLE x"]);
    expect(getProvidersByCcns).not.toHaveBeenCalled();
    await loadFamilyWorkspaceComparison([
      "015009",
      "015010",
      "015012",
      "055001",
      "335004",
      "105001",
    ]);
    expect(getProvidersByCcns).toHaveBeenCalledTimes(1);
    expect(getProvidersByCcns.mock.calls[0]?.[0]).toEqual([
      "015009",
      "015010",
      "015012",
      "055001",
      "335004",
    ]);
    expect(getDecisionSummariesByCcns).toHaveBeenCalledTimes(1);
    expect(getPublishedFacilityHistoriesByCcns).toHaveBeenCalledTimes(1);
  });

  it("does not import Google or create a score", async () => {
    const source = [
      readFileSync(
        path.join(process.cwd(), "src/server/care/family-workspace-repository.ts"),
        "utf8",
      ),
      readFileSync(path.join(process.cwd(), "src/server/care/history-repository.ts"), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(/workspace score|best facility/i);
    expect(source).toContain("published_facility_history_event");
    expect(source).toContain("ANY($1::text[])");
  });
});
