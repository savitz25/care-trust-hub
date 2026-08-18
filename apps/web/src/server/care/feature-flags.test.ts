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
