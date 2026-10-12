import { describe, expect, it } from "vitest";
import {
  assistedLivingBusinessContactKey,
  normalizeProviderBusinessContactKey,
  selectPublicProviderBusinessContact,
  type ProviderBusinessContactRow,
} from "./provider-business-contact";

function row(overrides: Partial<ProviderBusinessContactRow> = {}): ProviderBusinessContactRow {
  return {
    providerType: "nursing_home",
    providerKey: "01A193",
    websiteUrl: "https://harborview.example/about",
    email: "admin@harborview.example",
    phoneOverride: "(205) 555-0199",
    sourceUrls: ["https://harborview.example/about"],
    sourceType: "enrichment_file",
    confidence: 0.9,
    verifiedAt: "2026-10-01T00:00:00.000Z",
    isPublic: true,
    updatedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("provider business contact keys", () => {
  it("normalizes CMS CCNs and assisted-living external keys", () => {
    expect(normalizeProviderBusinessContactKey("nursing_home", "01a193")).toEqual({
      providerType: "nursing_home",
      providerKey: "01A193",
    });
    expect(normalizeProviderBusinessContactKey("home_health", "017000")).toEqual({
      providerType: "home_health",
      providerKey: "017000",
    });
    expect(normalizeProviderBusinessContactKey("hospice", " 3a1001 ")).toEqual({
      providerType: "hospice",
      providerKey: "3A1001",
    });
    expect(assistedLivingBusinessContactKey("ca", "CA_CDSS_CCL", "015600001")).toBe(
      "CA:CA_CDSS_CCL:015600001",
    );
  });

  it("rejects keys that are not a CCN or an external_key", () => {
    expect(normalizeProviderBusinessContactKey("nursing_home", "01A1939")).toBeNull();
    expect(normalizeProviderBusinessContactKey("assisted_living", "015600001")).toBeNull();
    expect(
      normalizeProviderBusinessContactKey(
        "assisted_living",
        "11111111-1111-4111-8111-111111111111",
      ),
    ).toBeNull();
    expect(normalizeProviderBusinessContactKey("memory_care", "01A193")).toBeNull();
  });
});

describe("selectPublicProviderBusinessContact", () => {
  it("returns website and email when the row is public", () => {
    const published = selectPublicProviderBusinessContact(row());
    expect(published?.websiteUrl).toBe("https://harborview.example/about");
    expect(published?.email).toBe("admin@harborview.example");
    expect(published?.phoneOverride).toBe("(205) 555-0199");
    expect(published?.sourceType).toBe("enrichment_file");
  });

  it("returns nothing when the row is absent", () => {
    expect(selectPublicProviderBusinessContact(null)).toBeNull();
    expect(
      selectPublicProviderBusinessContact(
        row({ websiteUrl: null, email: "   ", phoneOverride: null }),
      ),
    ).toBeNull();
  });

  it("returns nothing when the row is not public", () => {
    expect(selectPublicProviderBusinessContact(row({ isPublic: false }))).toBeNull();
  });

  it("drops insecure or non-address values without hiding a valid sibling", () => {
    const published = selectPublicProviderBusinessContact(
      row({
        websiteUrl: "http://harborview.example",
        email: "not-an-email",
        phoneOverride: null,
        sourceUrls: ["javascript:alert(1)", "https://source.example/listing"],
      }),
    );
    expect(published).toBeNull();
    const emailOnly = selectPublicProviderBusinessContact(
      row({
        websiteUrl: "javascript:alert(1)",
        email: "desk@harborview.example",
        phoneOverride: null,
      }),
    );
    expect(emailOnly?.websiteUrl).toBeNull();
    expect(emailOnly?.email).toBe("desk@harborview.example");
  });
});
