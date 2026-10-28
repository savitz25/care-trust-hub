import { describe, expect, it } from "vitest";
import { isCanonicalProviderSlug } from "./consumer";
import {
  chainFacilityCcn,
  chainFacilityHref,
  cmsCcnMembershipKeys,
  normalizeCmsCcn,
  normalizeLinkableCmsCcn,
} from "./cms-ccn";

const reported = [
  ["15010", "015010", "Example Indiana Facility", "example-indiana-facility"],
  ["55170", "055170", "Example California Facility", "example-california-facility"],
  ["55305", "055305", "Sherwood Healthcare Center", "sherwood-healthcare-center"],
  [
    "56158",
    "056158",
    "College Oak Nursing and Rehabilitation Center",
    "college-oak-nursing-and-rehabilitation-center",
  ],
] as const;

describe("CMS CCN normalization", () => {
  it("uses the canonical six-character CCN for membership lookup and facility links", () => {
    for (const [stored, canonical, name, slug] of reported) {
      expect(normalizeCmsCcn(stored)).toBe(canonical);
      expect(chainFacilityCcn(canonical, stored)).toBe(canonical);
      expect(chainFacilityCcn(stored, stored)).toBe(canonical);
      expect(cmsCcnMembershipKeys(canonical)).toEqual([canonical, stored]);
      expect(chainFacilityHref(canonical, name)).toBe(`/facility/cms/${canonical}/${slug}`);
      expect(chainFacilityHref(stored, name)).toBeNull();
      expect(isCanonicalProviderSlug({ providerName: name }, slug)).toBe(true);
    }
  });

  it("preserves existing six-character CCNs", () => {
    for (const ccn of ["055640", "555180", "001234", "01A193"]) {
      expect(normalizeCmsCcn(ccn)).toBe(ccn);
      expect(normalizeLinkableCmsCcn(`  ${ccn}  `)).toBe(ccn);
      expect(chainFacilityCcn(null, ccn)).toBe(ccn);
    }
    expect(chainFacilityHref("055640", "Grass Valley Healthcare Center")).toBe(
      "/facility/cms/055640/grass-valley-healthcare-center",
    );
    expect(chainFacilityHref("01A193", "Example & Care, Inc.")).toBe(
      "/facility/cms/01A193/example-and-care-inc",
    );
    expect(normalizeCmsCcn("01a193")).toBe("01A193");
  });

  it("does not turn invalid input into a facility URL", () => {
    for (const value of ["", "   ", "1234", "1234567", "55-305", "5530A", "ABCDEFG"]) {
      expect(normalizeLinkableCmsCcn(value)).toBeNull();
      expect(chainFacilityHref(value, "Unlinked Facility")).toBeNull();
    }
    expect(normalizeCmsCcn("1234567")).toBe("1234567");
    expect(normalizeCmsCcn("15001")).toBe("015001");
    expect(normalizeLinkableCmsCcn(null)).toBeNull();
    expect(normalizeLinkableCmsCcn(undefined)).toBeNull();
    expect(chainFacilityCcn("nope", "1234")).toBeNull();
    expect(chainFacilityCcn(null, "15010")).toBeNull();
    expect(chainFacilityCcn(undefined, "55170")).toBeNull();
    expect(chainFacilityCcn("", "55305")).toBeNull();
    expect(chainFacilityHref("15010", "Unmatched Facility")).toBeNull();
    expect(chainFacilityCcn("055999", "55305")).toBe("055999");
    expect(chainFacilityCcn("015010", "555180")).toBe("015010");
  });

  it("looks up a facility CCN and the one-zero-dropped membership key", () => {
    expect(cmsCcnMembershipKeys("055305")).toEqual(["055305", "55305"]);
    expect(cmsCcnMembershipKeys("01A193")).toEqual(["01A193"]);
    expect(cmsCcnMembershipKeys("555180")).toEqual(["555180"]);
    expect(cmsCcnMembershipKeys("55305")).toEqual([]);
  });
});
