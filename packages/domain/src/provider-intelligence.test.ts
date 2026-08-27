import { describe, expect, it } from "vitest";
import {
  PROVIDER_INTEL_VERSION,
  chowAbsenceCopy,
  cmsStarConsumerLabel,
  currentOwnedByStatement,
  directoryBanner,
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
