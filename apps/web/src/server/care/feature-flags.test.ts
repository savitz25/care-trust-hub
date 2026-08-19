import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("real provider UI feature flag", () => {
  it("defaults off in development and production", async () => {
    const { isRealProviderUiEnabled } = await import("./feature-flags");
    expect(isRealProviderUiEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isRealProviderUiEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("requires an exact server-side opt-in", async () => {
    const { isRealProviderUiEnabled } = await import("./feature-flags");
    expect(isRealProviderUiEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(true);
    expect(isRealProviderUiEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "TRUE" })).toBe(false);
  });

  it("requires a separate exact inspection-intelligence opt-in", async () => {
    const { isInspectionIntelligenceEnabled } = await import("./feature-flags");
    expect(isInspectionIntelligenceEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(false);
    expect(isInspectionIntelligenceEnabled({ CARE_ENABLE_INSPECTION_INTELLIGENCE: "true" })).toBe(
      true,
    );
  });

  it("requires both real-provider and staffing opt-ins", async () => {
    const { isStaffingIntelligenceEnabled } = await import("./feature-flags");
    expect(isStaffingIntelligenceEnabled({ CARE_ENABLE_STAFFING_INTELLIGENCE: "true" })).toBe(
      false,
    );
    expect(
      isStaffingIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_STAFFING_INTELLIGENCE: "true",
      }),
    ).toBe(true);
    expect(
      isStaffingIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_INSPECTION_INTELLIGENCE: "true",
      }),
    ).toBe(false);
  });

  it("requires both real-provider and ownership opt-ins", async () => {
    const { isOwnershipIntelligenceEnabled } = await import("./feature-flags");
    expect(isOwnershipIntelligenceEnabled({ CARE_ENABLE_OWNERSHIP_INTELLIGENCE: "true" })).toBe(
      false,
    );
    expect(
      isOwnershipIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_OWNERSHIP_INTELLIGENCE: "true",
      }),
    ).toBe(true);
  });
  it("requires both real-provider and chain opt-ins without billing state", async () => {
    const { isChainIntelligenceEnabled } = await import("./feature-flags");
    expect(isChainIntelligenceEnabled({ CARE_ENABLE_CHAIN_INTELLIGENCE: "true" })).toBe(false);
    expect(
      isChainIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_CHAIN_INTELLIGENCE: "true",
        SUBSCRIPTION_STATUS: "paid",
      }),
    ).toBe(true);
  });

  it("keeps state regulatory publication fail-closed without an explicit opt-in", async () => {
    const { isStateRegulatoryIntelligenceEnabled } = await import("./feature-flags");
    expect(isStateRegulatoryIntelligenceEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(
      false,
    );
    expect(
      isStateRegulatoryIntelligenceEnabled({
        CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE: "true",
      }),
    ).toBe(false);
    expect(
      isStateRegulatoryIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE: "true",
      }),
    ).toBe(true);
  });

  it("keeps ownership V2 fail-closed unless ownership intelligence is also on", async () => {
    const { isOwnershipIntelligenceV2Enabled, isOwnershipIntelligenceEnabled } = await import(
      "./feature-flags"
    );
    expect(
      isOwnershipIntelligenceV2Enabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_OWNERSHIP_INTELLIGENCE: "true",
      }),
    ).toBe(false);
    expect(
      isOwnershipIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_OWNERSHIP_INTELLIGENCE: "true",
      }),
    ).toBe(true);
    expect(
      isOwnershipIntelligenceV2Enabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_OWNERSHIP_INTELLIGENCE: "true",
        CARE_ENABLE_OWNERSHIP_INTELLIGENCE_V2: "true",
      }),
    ).toBe(true);
  });

  it("keeps state enforcement history fail-closed without affecting CMS history", async () => {
    const { isStateEnforcementIntelligenceEnabled, isFacilityHistoryEnabled } = await import(
      "./feature-flags"
    );
    expect(isStateEnforcementIntelligenceEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(
      false,
    );
    expect(
      isFacilityHistoryEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_FACILITY_HISTORY: "true",
      }),
    ).toBe(true);
    expect(
      isStateEnforcementIntelligenceEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_STATE_ENFORCEMENT_INTELLIGENCE: "true",
      }),
    ).toBe(true);
  });

  it("keeps facility history fail-closed without an explicit opt-in", async () => {
    const { isFacilityHistoryEnabled, isRealProviderUiEnabled } = await import("./feature-flags");
    expect(isFacilityHistoryEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(false);
    expect(
      isFacilityHistoryEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_FACILITY_HISTORY: "true",
      }),
    ).toBe(true);
    expect(isRealProviderUiEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(true);
  });

  it("disables only the state layer when the state flag is missing", async () => {
    const {
      isRealProviderUiEnabled,
      isStateRegulatoryIntelligenceEnabled,
      isVerifiedEnrichmentEnabled,
      isInspectionIntelligenceEnabled,
    } = await import("./feature-flags");
    const env = {
      CARE_ENABLE_REAL_PROVIDER_UI: "true",
      CARE_ENABLE_INSPECTION_INTELLIGENCE: "true",
    };
    expect(isRealProviderUiEnabled(env)).toBe(true);
    expect(isVerifiedEnrichmentEnabled(env)).toBe(true);
    expect(isInspectionIntelligenceEnabled(env)).toBe(true);
    expect(isStateRegulatoryIntelligenceEnabled(env)).toBe(false);
  });

  it("publishes verified enrichment with real-provider UI unless explicitly disabled", async () => {
    const { isVerifiedEnrichmentEnabled } = await import("./feature-flags");
    expect(isVerifiedEnrichmentEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(isVerifiedEnrichmentEnabled({ CARE_ENABLE_REAL_PROVIDER_UI: "true" })).toBe(true);
    expect(
      isVerifiedEnrichmentEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_VERIFIED_ENRICHMENT: "false",
      }),
    ).toBe(false);
  });

  it("keeps the care-needs navigator fail-closed and independent of facility flags", async () => {
    const { isCareNeedsNavigatorEnabled, isRealProviderUiEnabled } = await import(
      "./feature-flags"
    );
    expect(isCareNeedsNavigatorEnabled({})).toBe(false);
    expect(isCareNeedsNavigatorEnabled({ CARE_ENABLE_CARE_NEEDS_NAVIGATOR: "TRUE" })).toBe(false);
    expect(isCareNeedsNavigatorEnabled({ CARE_ENABLE_CARE_NEEDS_NAVIGATOR: "true" })).toBe(true);
    expect(isRealProviderUiEnabled({ CARE_ENABLE_CARE_NEEDS_NAVIGATOR: "true" })).toBe(false);
  });

  it("keeps the senior care cost planner fail-closed and independent", async () => {
    const { isSeniorCareCostPlannerEnabled, isCareNeedsNavigatorEnabled } = await import(
      "./feature-flags"
    );
    expect(isSeniorCareCostPlannerEnabled({})).toBe(false);
    expect(isSeniorCareCostPlannerEnabled({ CARE_ENABLE_SENIOR_CARE_COST_PLANNER: "TRUE" })).toBe(
      false,
    );
    expect(isSeniorCareCostPlannerEnabled({ CARE_ENABLE_SENIOR_CARE_COST_PLANNER: "true" })).toBe(
      true,
    );
    expect(isCareNeedsNavigatorEnabled({ CARE_ENABLE_SENIOR_CARE_COST_PLANNER: "true" })).toBe(
      false,
    );
  });

  it("keeps the facility interview builder fail-closed and independent", async () => {
    const {
      isFacilityInterviewBuilderEnabled,
      isCareNeedsNavigatorEnabled,
      isSeniorCareCostPlannerEnabled,
      isRealProviderUiEnabled,
    } = await import("./feature-flags");
    expect(isFacilityInterviewBuilderEnabled({})).toBe(false);
    expect(
      isFacilityInterviewBuilderEnabled({ CARE_ENABLE_FACILITY_INTERVIEW_BUILDER: "TRUE" }),
    ).toBe(false);
    expect(
      isFacilityInterviewBuilderEnabled({ CARE_ENABLE_FACILITY_INTERVIEW_BUILDER: "true" }),
    ).toBe(true);
    expect(isCareNeedsNavigatorEnabled({ CARE_ENABLE_FACILITY_INTERVIEW_BUILDER: "true" })).toBe(
      false,
    );
    expect(isSeniorCareCostPlannerEnabled({ CARE_ENABLE_FACILITY_INTERVIEW_BUILDER: "true" })).toBe(
      false,
    );
    expect(isRealProviderUiEnabled({ CARE_ENABLE_FACILITY_INTERVIEW_BUILDER: "true" })).toBe(false);
  });

  it("keeps the family comparison workspace fail-closed and independent", async () => {
    const {
      isFamilyComparisonWorkspaceEnabled,
      isFacilityInterviewBuilderEnabled,
      isRealProviderUiEnabled,
    } = await import("./feature-flags");
    expect(isFamilyComparisonWorkspaceEnabled({})).toBe(false);
    expect(
      isFamilyComparisonWorkspaceEnabled({ CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE: "TRUE" }),
    ).toBe(false);
    expect(
      isFamilyComparisonWorkspaceEnabled({ CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE: "true" }),
    ).toBe(true);
    expect(
      isFacilityInterviewBuilderEnabled({ CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE: "true" }),
    ).toBe(false);
    expect(isRealProviderUiEnabled({ CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE: "true" })).toBe(
      false,
    );
  });

  it("keeps assisted-living intelligence fail-closed and unpublished", async () => {
    const { isAssistedLivingIntelligenceEnabled, isRealProviderUiEnabled } = await import(
      "./feature-flags"
    );
    expect(isAssistedLivingIntelligenceEnabled({})).toBe(false);
    expect(
      isAssistedLivingIntelligenceEnabled({ CARE_ENABLE_ASSISTED_LIVING_INTELLIGENCE: "TRUE" }),
    ).toBe(false);
    expect(
      isAssistedLivingIntelligenceEnabled({ CARE_ENABLE_ASSISTED_LIVING_INTELLIGENCE: "true" }),
    ).toBe(true);
    expect(isRealProviderUiEnabled({ CARE_ENABLE_ASSISTED_LIVING_INTELLIGENCE: "true" })).toBe(
      false,
    );
  });

  it("requires both real-provider and trust-participation opt-ins without billing state", async () => {
    const { isTrustParticipationEnabled } = await import("./feature-flags");
    expect(isTrustParticipationEnabled({ CARE_ENABLE_TRUST_PARTICIPATION: "true" })).toBe(false);
    expect(
      isTrustParticipationEnabled({
        CARE_ENABLE_REAL_PROVIDER_UI: "true",
        CARE_ENABLE_TRUST_PARTICIPATION: "true",
        SUBSCRIPTION_STATUS: "paid",
      }),
    ).toBe(true);
  });
});
