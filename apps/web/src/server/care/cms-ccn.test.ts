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
  ["55305", "055305", "Sherwood Healthcare Center", "sherwood-healthcare-center"],
  [
    "56158",
    "056158",
    "College Oak Nursing and Rehabilitation Center",
    "college-oak-nursing-and-rehabilitation-center",
  ],
  ["55491", "055491", "Oak Ridge Healthcare Center", "oak-ridge-healthcare-center"],
  ["55417", "055417", "Saylor Lane Healthcare Center", "saylor-lane-healthcare-center"],
] as const;

describe("CMS CCN normalization", () => {
  it("pads the four reported five-digit chain identifiers and keeps their canonical slugs", () => {
    for (const [stored, padded, name, slug] of reported) {
      expect(normalizeCmsCcn(stored)).toBe(padded);
      expect(normalizeLinkableCmsCcn(stored)).toBe(padded);
      expect(chainFacilityCcn(null, stored)).toBe(padded);
      expect(chainFacilityCcn(padded, stored)).toBe(padded);
      expect(chainFacilityHref(stored, name)).toBe(`/facility/cms/${padded}/${slug}`);
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
    expect(chainFacilityCcn("055999", "55305")).toBe("055999");
  });

  it("looks up a facility CCN and the one-zero-dropped membership key", () => {
    expect(cmsCcnMembershipKeys("055305")).toEqual(["055305", "55305"]);
    expect(cmsCcnMembershipKeys("01A193")).toEqual(["01A193"]);
    expect(cmsCcnMembershipKeys("555180")).toEqual(["555180"]);
    expect(cmsCcnMembershipKeys("55305")).toEqual([]);
  });
});
