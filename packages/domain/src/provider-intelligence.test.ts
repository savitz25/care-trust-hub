import { describe, expect, it } from "vitest";
import {
  PROVIDER_INTEL_VERSION,
  agencyDirectoryBanner,
  chowAbsenceCopy,
  chowUnsupportedCopy,
  cmsMeasureAvailabilityCopy,
  cmsStarConsumerLabel,
  currentOwnedByStatement,
  directoryBanner,
  isHomeHealthIntelV1,
  isHospiceIntelV1,
  isProviderIntelV1,
  partyCapCopy,
} from "./provider-intelligence";

describe("provider intelligence presentation", () => {
  it("rejects unknown contract versions", () => {
    expect(isProviderIntelV1({ contract_version: "v0", provider_type: "nursing_home" })).toBe(
      false,
    );
    expect(PROVIDER_INTEL_VERSION).toBe("provider-intel-v1");
  });

  it("labels CMS ratings as CMS, not Trust Hub", () => {
    expect(cmsStarConsumerLabel()).toBe("CMS star rating");
    expect(cmsStarConsumerLabel().toLowerCase()).not.toContain("trust hub rating");
  });

  it("does not call known-not-current closed", () => {
    const copy = directoryBanner("KNOWN_NOT_CURRENT") ?? "";
    expect(copy.toLowerCase()).not.toMatch(/\bclosed\b/);
    expect(copy.toLowerCase()).not.toMatch(/\bterminated\b/);
  });

  it("does not say never changed ownership", () => {
    expect(chowAbsenceCopy().toLowerCase()).not.toContain("never changed ownership");
  });

  it("treats HH and Hospice CHOW as unsupported without calling it a sale or never-changed", () => {
    const hh = chowUnsupportedCopy("home_health");
    const hospice = chowUnsupportedCopy("hospice");
    expect(hh.toLowerCase()).not.toContain("never changed ownership");
    expect(hh.toLowerCase()).not.toContain("sold");
    expect(hospice.toLowerCase()).not.toContain("closed");
    expect(isHomeHealthIntelV1({ contract_version: "provider-intel-v1", provider_type: "nursing_home" })).toBe(
      false,
    );
    expect(
      isHospiceIntelV1({
        contract_version: "provider-intel-v1",
        provider_type: "hospice",
        identifier_type: "HOSPICE_CCN",
      }),
    ).toBe(true);
  });

  it("does not convert missing or suppressed CMS measures to zero", () => {
    expect(cmsMeasureAvailabilityCopy("NOT_AVAILABLE", null, null)).toBe("Not reported");
    expect(cmsMeasureAvailabilityCopy("SUPPRESSED", 0, null)).toBe("Suppressed");
    expect(cmsMeasureAvailabilityCopy("INSUFFICIENT_DATA", null, null)).toBe("Insufficient data");
    expect(cmsMeasureAvailabilityCopy("REPORTED", null, null)).toBe("Not reported");
    expect(agencyDirectoryBanner("hospice", "EVIDENCE_ONLY")?.toLowerCase()).not.toMatch(/\bclosed\b/);
  });

  it("reports party caps without implying a smaller total", () => {
    expect(partyCapCopy(25, 47)).toBe(
      "Showing 25 of 47 relationships from CMS/PECOS evidence.",
    );
    expect(partyCapCopy(3, 3)).toBeNull();
  });

  it("only states owned-by for current OWNED_BY", () => {
    const current = currentOwnedByStatement({
      display_name: "Example LLC",
      party_kind: "organization",
      party_id: "1",
      organization_id: "2",
      relationship_type: "OWNED_BY",
      raw_cms_role: "5% OR GREATER DIRECT OWNERSHIP INTEREST",
      ownership_percentage: 5,
      temporal_status: "CURRENT",
      effective_from: null,
      confidence: "CONFIRMED",
      person_publication_policy: null,
      public_profile: false,
    });
    const unknown = currentOwnedByStatement({
      display_name: "Old LLC",
      party_kind: "organization",
      party_id: "1",
      organization_id: "2",
      relationship_type: "OWNED_BY",
      raw_cms_role: "OWNER",
      ownership_percentage: null,
      temporal_status: "UNKNOWN",
      effective_from: null,
      confidence: "CONFIRMED",
      person_publication_policy: null,
      public_profile: false,
    });
    expect(current).toContain("Example LLC");
    expect(unknown).toBeNull();
  });
});
