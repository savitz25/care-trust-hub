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
});
