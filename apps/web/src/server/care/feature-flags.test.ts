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
});
