import { describe, expect, it } from "vitest";
import {
  cmsRatingText,
  factualRatingObservations,
  isCanonicalProviderSlug,
  isValidCmsChainId,
  isValidOrganizationId,
  nursingHomeResearchDocumentTitle,
  organizationHref,
  providerHref,
  providerSlug,
} from "./consumer";

describe("real provider consumer mapping", () => {
  it("uses CCN as durable URL identity and canonicalizes the name slug", () => {
    const provider = { ccn: "01A193", providerName: "Example & Care, Inc." };
    expect(providerSlug(provider.providerName)).toBe("example-and-care-inc");
    expect(providerHref(provider)).toBe("/facility/cms/01A193/example-and-care-inc");
    expect(isCanonicalProviderSlug(provider, "old-name")).toBe(false);
    expect(isCanonicalProviderSlug(provider, "example-and-care-inc")).toBe(true);
  });

  it("accepts only the numeric CMS chain identifiers used by public chain routes", () => {
    expect(isValidCmsChainId("1")).toBe(true);
    expect(isValidCmsChainId("00123")).toBe(true);
    expect(isValidCmsChainId("not-a-chain")).toBe(false);
    expect(isValidCmsChainId("")).toBe(false);
  });

  it("builds ownership organization routes only for UUID identities", () => {
    const organizationId = "11111111-1111-4111-8111-111111111111";
    expect(isValidOrganizationId(organizationId)).toBe(true);
    expect(isValidOrganizationId("not-an-org")).toBe(false);
    expect(organizationHref({ organizationId, organizationName: "Example Healthcare LLC" })).toBe(
      `/ownership/${organizationId}/example-healthcare-llc`,
    );
  });

  it("keeps the nursing-home research title page-specific so the root template owns the brand", () => {
    expect(nursingHomeResearchDocumentTitle("Country Drive Post Acute")).toBe(
      "Country Drive Post Acute — CMS Ratings, Ownership & Inspection Research",
    );
    expect(nursingHomeResearchDocumentTitle("Country Drive Post Acute")).not.toMatch(
      /SeniorTrustHub/,
    );
    expect(nursingHomeResearchDocumentTitle("Country Drive Post Acute")).not.toMatch(
      /\bReviews\b|\bBest\b|\bTop\b|\bRecommended\b|Trust Score/i,
    );
  });

  it("preserves missing ratings without manufacturing a value or judgment", () => {
    expect(cmsRatingText(null)).toBe("Not reported in this CMS release");
    expect(
      factualRatingObservations({
        overall: null,
        healthInspection: 2,
        staffing: 5,
        qualityMeasure: 3,
      }),
    ).toEqual([
      "CMS did not publish an overall star rating for this provider in this release.",
      "CMS reports a 2-star health inspection rating.",
      "CMS reports a 5-star staffing rating.",
      "CMS reports a 3-star quality-measure rating.",
    ]);
  });
});
