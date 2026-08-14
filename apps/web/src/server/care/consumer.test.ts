import { describe, expect, it } from "vitest";
import {
  cmsRatingText,
  factualRatingObservations,
  isCanonicalProviderSlug,
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
