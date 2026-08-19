import { beforeEach, describe, expect, it, vi } from "vitest";

const getProviderByCcnForPage = vi.fn();
const getPublishedFacilityHistoryForPage = vi.fn();
const getProviderOwnershipIntelligenceForPage = vi.fn();
const getOwnershipOperationSummaryForPage = vi.fn();
const isRealProviderUiEnabled = vi.fn();
const isFacilityHistoryEnabled = vi.fn();
const isStateEnforcementIntelligenceEnabled = vi.fn();
const isOwnershipIntelligenceEnabled = vi.fn();
const isOwnershipIntelligenceV2Enabled = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./cached-repository", () => ({
  getProviderByCcnForPage,
  getPublishedFacilityHistoryForPage,
  getProviderOwnershipIntelligenceForPage,
  getOwnershipOperationSummaryForPage,
}));
vi.mock("./feature-flags", () => ({
  isRealProviderUiEnabled,
  isFacilityHistoryEnabled,
  isStateEnforcementIntelligenceEnabled,
  isOwnershipIntelligenceEnabled,
  isOwnershipIntelligenceV2Enabled,
}));

const provider = {
  ccn: "01A193",
  providerName: "Example Manor",
  ratings: { staffing: 2 },
};

describe("interview facility context", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isRealProviderUiEnabled.mockReturnValue(true);
    isFacilityHistoryEnabled.mockReturnValue(true);
    isStateEnforcementIntelligenceEnabled.mockReturnValue(true);
    isOwnershipIntelligenceEnabled.mockReturnValue(false);
    isOwnershipIntelligenceV2Enabled.mockReturnValue(false);
  });

  it("returns nothing when the real-provider UI is off or the CCN is invalid", async () => {
    const { loadInterviewFacilityContext } = await import("./interview-facility-context");
    isRealProviderUiEnabled.mockReturnValue(false);
    expect(await loadInterviewFacilityContext("01A193")).toBeNull();
    isRealProviderUiEnabled.mockReturnValue(true);
    expect(await loadInterviewFacilityContext("bad")).toBeNull();
    expect(getProviderByCcnForPage).not.toHaveBeenCalled();
  });

  it("uses published history only and does not query Google", async () => {
    getProviderByCcnForPage.mockResolvedValue(provider);
    getPublishedFacilityHistoryForPage.mockResolvedValue({
      events: [
        {
          id: "staff-1",
          eventType: "STAFFING_TOTAL_CHANGED",
          eventFamily: "staffing",
          eventDate: "2026-04-01",
          datePrecision: "quarter",
          dateBasis: "reported_in_release",
          importance: "MEDIUM",
          title: "Total nurse staffing decreased",
          summary: "Total nurse staffing decreased from 4.10 to 3.40.",
          previousValue: "4.10",
          newValue: "3.40",
          evidenceHref: "#staffing",
          sourceDatasetName: "published_facility_history_event",
          sourceRecordLocator: "row-1",
          sourceLabel: "CMS",
          regulator: null,
        },
      ],
    });
    const { loadInterviewFacilityContext } = await import("./interview-facility-context");
    const context = await loadInterviewFacilityContext("01a193");
    expect(context?.facilityName).toBe("Example Manor");
    expect(context?.facilityHref).toBe("/facility/cms/01A193/example-manor");
    expect(context?.evidence?.latestStaffingChangeDirection).toBe("decrease");
    expect(context?.evidence?.cmsStaffingRating).toBe(2);
    expect(getPublishedFacilityHistoryForPage).toHaveBeenCalledWith("01A193", {
      includeStateEvents: true,
    });
    expect(getOwnershipOperationSummaryForPage).not.toHaveBeenCalled();
  });

  it("does not invent a multi-facility concern when ownership V2 is off", async () => {
    getProviderByCcnForPage.mockResolvedValue(provider);
    getPublishedFacilityHistoryForPage.mockResolvedValue({ events: [] });
    const { loadInterviewFacilityContext } = await import("./interview-facility-context");
    const context = await loadInterviewFacilityContext("01A193");
    expect(context?.evidence?.isMultiFacilityOrganization).toBe(false);
    expect(context?.evidence?.organizationFacilityCount).toBeNull();
  });
});
