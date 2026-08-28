import { describe, expect, it } from "vitest";
import {
  FLORIDA_HHA_CMS_LIMITATION,
  FLORIDA_HOSPICE_CMS_LIMITATION,
  FLORIDA_PHASE1_PUBLIC_COUNTS,
  FLORIDA_PROVIDER_CONTRACT,
  FLORIDA_PUBLICATION_CONTRACT,
  NO_EVENT_LANGUAGE,
  contactDisplayTier,
  floridaNameSlug,
  floridaProfilePath,
  geographyWithExactMap,
  inspectionDisplayLabel,
  isFloridaPhase1PublicKind,
  publicFloridaContacts,
} from "./florida-provider-profile";

describe("Florida provider profile contract", () => {
  it("builds deterministic class-scoped paths using file number not UUID", () => {
    expect(floridaNameSlug("1 KIND HOME LLC")).toBe("1-kind-home-llc");
    expect(floridaProfilePath("assisted-living", "11968002", "1 KIND HOME LLC")).toBe(
      "/florida/assisted-living/11968002/1-kind-home-llc",
    );
    expect(floridaProfilePath("nursing-home", "95052", "ABBEY DELRAY SOUTH")).not.toContain(
      "/facility/cms/",
    );
  });

  it("does not use name alone as identity and maps exact county aliases only", () => {
    const a = floridaProfilePath("home-health", "19965961", "ACME HOME");
    const b = floridaProfilePath("home-health", "19965962", "ACME HOME");
    expect(a).not.toBe(b);
    expect(geographyWithExactMap("served_county", "Dade").canonical).toBe("Miami-Dade");
    expect(geographyWithExactMap("served_county", "Hillsboro").canonical).toBeNull();
  });

  it("keeps absence language and forbids scores in the contract name", () => {
    expect(NO_EVENT_LANGUAGE).toMatch(/No connected Florida regulatory event was observed/);
    expect(NO_EVENT_LANGUAGE).not.toMatch(/clean record|no violations/i);
    expect(FLORIDA_PROVIDER_CONTRACT).toBe("fl-sen-provider-v1");
    expect(contactDisplayTier("street_address")).toBe("public_candidate");
    expect(contactDisplayTier("controlling_interest")).toBe("review_before_public");
  });

  it("compares Florida HHA/Hospice AHCA counts to Florida CMS universes, not national totals", () => {
    expect(FLORIDA_HHA_CMS_LIMITATION).toMatch(/2,971/);
    expect(FLORIDA_HHA_CMS_LIMITATION).toMatch(/1,146/);
    expect(FLORIDA_HHA_CMS_LIMITATION).not.toMatch(/12,460|12460/);
    expect(FLORIDA_HOSPICE_CMS_LIMITATION).toMatch(/74 CURRENT Hospice/);
    expect(FLORIDA_HOSPICE_CMS_LIMITATION).toMatch(/61 providers/);
    expect(FLORIDA_HOSPICE_CMS_LIMITATION).not.toMatch(/6,669|6669|6,911|6911/);
    expect(FLORIDA_HOSPICE_CMS_LIMITATION).toMatch(/No Hospice star/);
    expect(FLORIDA_HHA_CMS_LIMITATION).toMatch(/No row-level AHCA/);
  });

  it("keeps Phase 1 publication to ALF/AFCH and strips review contacts", () => {
    expect(FLORIDA_PUBLICATION_CONTRACT).toBe("fl-sen-pub-v1");
    expect(FLORIDA_PHASE1_PUBLIC_COUNTS).toEqual({
      "assisted-living": 20,
      "adult-family-care": 5,
    });
    expect(isFloridaPhase1PublicKind("assisted-living")).toBe(true);
    expect(isFloridaPhase1PublicKind("nursing-home")).toBe(false);
    expect(
      publicFloridaContacts([
        { contact_kind: "phone" },
        { contact_kind: "controlling_interest" },
        { contact_kind: "financial_officer" },
        { contact_kind: "other_named_party" },
      ]).map((c) => c.contact_kind),
    ).toEqual(["phone"]);
    expect(inspectionDisplayLabel("inspection", "Complaint")).toBe("Complaint-triggered inspection");
    expect(inspectionDisplayLabel("inspection", "Complaint")).not.toMatch(/substantiated/i);
  });
});
