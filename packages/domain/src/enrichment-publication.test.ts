import { describe, expect, it } from "vitest";
import type { ResolutionState } from "./facility-intelligence";
import {
  classifyPublicWebsite,
  formatVerifiedCheckedLabel,
  isConsumerPublishableClaim,
  isMeaningfulPublicAlias,
  publicPhonesMatch,
  selectPublishedFacilityEnrichment,
  type FacilityClaimRecord,
} from "./enrichment-publication";

const claim = (
  claimType: string,
  resolutionState: ResolutionState,
  value: string | null,
  publicationEligible = true,
): FacilityClaimRecord => ({
  claimType,
  resolutionState,
  publicationEligible,
  value,
  resolvedAt: "2026-08-18T15:00:00.000Z",
});

describe("enrichment publication selector", () => {
  it("publishes an independently VERIFIED website and phone", () => {
    const published = selectPublishedFacilityEnrichment({
      claims: [
        claim("google_official_website", "VERIFIED", "https://example-snf.org"),
        claim("google_public_phone", "VERIFIED", "(205) 555-0100"),
      ],
      identityState: "VERIFIED",
      cmsName: "Example SNF",
      cmsPhone: "2055550100",
    });
    expect(published.website?.value).toBe("https://example-snf.org");
    expect(published.phone?.value).toBe("(205) 555-0100");
  });

  it("does not publish REVIEW_REQUIRED or PROBABLE websites", () => {
    for (const state of ["REVIEW_REQUIRED", "PROBABLE", "UNRESOLVED", "REJECTED"] as const) {
      const published = selectPublishedFacilityEnrichment({
        claims: [claim("google_official_website", state, "https://example-snf.org")],
        identityState: "VERIFIED",
        cmsName: "Example SNF",
        cmsPhone: null,
      });
      expect(published.website).toBeNull();
    }
  });

  it("does not infer a phone from a VERIFIED identity when the phone claim is under review", () => {
    const published = selectPublishedFacilityEnrichment({
      claims: [
        claim("google_place_identity", "VERIFIED", "ChIJ-internal"),
        claim("google_official_website", "VERIFIED", "https://example-snf.org"),
        claim("google_public_phone", "REVIEW_REQUIRED", "2055550199"),
      ],
      identityState: "VERIFIED",
      cmsName: "Example SNF",
      cmsPhone: "2055550100",
    });
    expect(published.website?.value).toBe("https://example-snf.org");
    expect(published.phone).toBeNull();
  });

  it("rejects directory, lead-generation, and social websites even if marked verified", () => {
    expect(classifyPublicWebsite("https://www.aplaceformom.com/community/x")).toBe(
      "LEAD_GENERATION",
    );
    expect(classifyPublicWebsite("https://www.yelp.com/biz/x")).toBe("THIRD_PARTY_DIRECTORY");
    expect(classifyPublicWebsite("https://facebook.com/example")).toBe("SOCIAL_MEDIA");
    const published = selectPublishedFacilityEnrichment({
      claims: [claim("google_official_website", "VERIFIED", "https://www.yelp.com/biz/x")],
      identityState: "VERIFIED",
      cmsName: "Example",
      cmsPhone: null,
    });
    expect(published.website).toBeNull();
  });

  it("never treats Place IDs or business status as publishable claims", () => {
    expect(isConsumerPublishableClaim(claim("google_place_identity", "VERIFIED", "ChIJ123"))).toBe(
      false,
    );
    expect(
      isConsumerPublishableClaim(claim("google_business_status", "VERIFIED", "CLOSED_PERMANENTLY")),
    ).toBe(false);
    const published = selectPublishedFacilityEnrichment({
      claims: [
        claim("google_place_identity", "VERIFIED", "ChIJ123"),
        claim("google_business_status", "PROBABLE", "OPERATIONAL"),
        claim("google_physical_address", "VERIFIED", "1 Main St"),
      ],
      identityState: "VERIFIED",
      cmsName: "Example",
      cmsPhone: null,
    });
    expect(published).toEqual({ website: null, phone: null, publicAlias: null });
  });

  it("requires a VERIFIED identity plus a distinct name before publishing an alias", () => {
    expect(
      selectPublishedFacilityEnrichment({
        claims: [claim("google_public_name", "VERIFIED", "Sunrise of Example")],
        identityState: "REVIEW_REQUIRED",
        cmsName: "SUNRISE OF EXAMPLE LLC",
        cmsPhone: null,
      }).publicAlias,
    ).toBeNull();
    expect(isMeaningfulPublicAlias("SUNRISE OF EXAMPLE LLC", "Sunrise of Example")).toBe(false);
    expect(
      selectPublishedFacilityEnrichment({
        claims: [claim("google_public_name", "VERIFIED", "Harborview Care")],
        identityState: "VERIFIED",
        cmsName: "HARBORVIEW CARE AND REHAB",
        cmsPhone: null,
      }).publicAlias?.value,
    ).toBe("Harborview Care");
  });

  it("publishes historical VERIFIED contact claims even when the append-only flag stayed false", () => {
    expect(
      isConsumerPublishableClaim(
        claim("google_official_website", "VERIFIED", "https://example-snf.org", false),
      ),
    ).toBe(true);
    expect(
      isConsumerPublishableClaim(
        claim("google_official_website", "REVIEW_REQUIRED", "https://example-snf.org", true),
      ),
    ).toBe(false);
  });

  it("matches phones on the national number only", () => {
    expect(publicPhonesMatch("(205) 555-0100", "2055550100")).toBe(true);
    expect(publicPhonesMatch("2055550100", "2055550199")).toBe(false);
  });

  it("formats a checked-month provenance label without exposing algorithms", () => {
    expect(formatVerifiedCheckedLabel("2026-08-18T15:00:00.000Z")).toBe(
      "Verified public information · checked Aug 2026",
    );
  });
});
