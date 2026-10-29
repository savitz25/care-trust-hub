import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isCanonicalProviderSlug } from "./consumer";
import {
  chainFacilitiesFromSources,
  chainFacilityCcn,
  chainFacilityFromSources,
  chainFacilityHref,
  cmsCcnAuthorityKeys,
  cmsCcnAuthorityKeysFromSources,
  cmsCcnMembershipKeys,
  collidingCanonicalCmsCcns,
  normalizeCmsCcn,
  normalizeLinkableCmsCcn,
  resolveChainMembership,
  resolveUniqueCanonicalCmsCcn,
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

  it("fails closed when a provider has more than one current CMS CCN", () => {
    expect(resolveUniqueCanonicalCmsCcn(["015010", "055305"])).toEqual({ kind: "many", ccn: null });
    const facility = chainFacilityFromSources({
      storedCcn: "015010",
      canonicalCcns: ["015010", "055305"],
      providerName: "Example Indiana Facility",
      state: "IN",
      overallRating: 3,
    });
    expect(facility?.ccn).toBe("unresolved:015010");
    expect(chainFacilityHref(facility?.ccn ?? "", "Example Indiana Facility")).toBeNull();
    const fromText = chainFacilityFromSources({
      storedCcn: "055640",
      canonicalCcns: "{015010,055305}",
      providerName: "Grass Valley Healthcare Center",
      state: "CA",
      overallRating: null,
    });
    expect(chainFacilityHref(fromText?.ccn ?? "", "Grass Valley Healthcare Center")).toBeNull();
  });

  it("treats a leading-zero pair as one canonical CCN", () => {
    expect(resolveUniqueCanonicalCmsCcn(["15010", "015010"])).toEqual({
      kind: "one",
      ccn: "015010",
    });
    expect(resolveUniqueCanonicalCmsCcn(["015010", "015010", null, ""])).toEqual({
      kind: "one",
      ccn: "015010",
    });
    expect(resolveUniqueCanonicalCmsCcn(["015010", "1234", "nope"])).toEqual({
      kind: "one",
      ccn: "015010",
    });
    const facility = chainFacilityFromSources({
      storedCcn: "15010",
      canonicalCcns: "{15010,015010}",
      providerName: "Example Indiana Facility",
      state: "IN",
      overallRating: 4,
    });
    expect(facility?.ccn).toBe("015010");
    expect(chainFacilityHref(facility?.ccn ?? "", "Example Indiana Facility")).toBe(
      "/facility/cms/015010/example-indiana-facility",
    );
  });

  it("leaves malformed and unmatched identities unlinked", () => {
    expect(resolveUniqueCanonicalCmsCcn([])).toEqual({ kind: "none", ccn: null });
    expect(resolveUniqueCanonicalCmsCcn(["1234", "nope", null])).toEqual({
      kind: "none",
      ccn: null,
    });
    expect(resolveChainMembership([])).toBeNull();
    const fiveDigit = chainFacilityFromSources({
      storedCcn: "15010",
      canonicalCcns: [],
      providerName: "Unmatched Facility",
      state: "IN",
      overallRating: null,
    });
    expect(fiveDigit?.ccn).toBe("15010");
    expect(chainFacilityHref(fiveDigit?.ccn ?? "", "Unmatched Facility")).toBeNull();
    const unreadable = chainFacilityFromSources({
      storedCcn: "055640",
      canonicalCcns: "not-an-array",
      providerName: "Grass Valley Healthcare Center",
      state: "CA",
      overallRating: 2,
    });
    expect(unreadable?.ccn).toBe("unresolved:055640");
    expect(chainFacilityHref(unreadable?.ccn ?? "", "Grass Valley Healthcare Center")).toBeNull();
    expect(
      chainFacilityFromSources({
        storedCcn: "   ",
        canonicalCcns: [],
        providerName: "Dropped",
        state: "IN",
        overallRating: null,
      }),
    ).toBeNull();
  });

  it("links one verified canonical match and the known five-digit examples", () => {
    for (const [stored, canonical, name, slug] of reported) {
      const facility = chainFacilityFromSources({
        storedCcn: stored,
        canonicalCcns: [canonical],
        providerName: name,
        state: "CA",
        overallRating: 5,
      });
      expect(facility?.ccn).toBe(canonical);
      expect(chainFacilityHref(facility?.ccn ?? "", name)).toBe(
        `/facility/cms/${canonical}/${slug}`,
      );
      expect(
        chainFacilityFromSources(
          {
            storedCcn: stored,
            canonicalCcns: [stored],
            providerName: name,
            state: "CA",
            overallRating: 5,
          },
          canonical,
        ),
      ).toBeNull();
    }
    const sixCharacter = chainFacilityFromSources({
      storedCcn: "01A193",
      canonicalCcns: [],
      providerName: "Example & Care, Inc.",
      state: "AL",
      overallRating: null,
    });
    expect(sixCharacter?.ccn).toBe("01A193");
    expect(chainFacilityHref(sixCharacter?.ccn ?? "", "Example & Care, Inc.")).toBe(
      "/facility/cms/01A193/example-and-care-inc",
    );
    for (const ccn of ["055640", "555180", "001234"]) {
      expect(
        chainFacilityFromSources({
          storedCcn: ccn,
          canonicalCcns: [ccn],
          providerName: "Named Facility",
          state: "CA",
          overallRating: null,
        })?.ccn,
      ).toBe(ccn);
    }
  });

  it("fails closed on ambiguous chain membership and keeps one verified membership", () => {
    expect(
      resolveChainMembership([
        { providerId: "provider-a", cmsChainId: "244" },
        { providerId: "provider-b", cmsChainId: "244" },
      ]),
    ).toBeNull();
    expect(
      resolveChainMembership([
        { providerId: "provider-a", cmsChainId: "244" },
        { providerId: "provider-a", cmsChainId: "245" },
      ]),
    ).toBeNull();
    expect(
      resolveChainMembership([
        { providerId: null, cmsChainId: "244" },
        { providerId: "provider-a", cmsChainId: "244" },
      ]),
    ).toBeNull();

    const older = {
      providerId: "provider-a",
      cmsChainId: "244",
      sourceModifiedAt: "2026-01-01T00:00:00.000Z",
      retrievedAt: "2026-06-01T00:00:00.000Z",
    };
    const newer = {
      providerId: "provider-a",
      cmsChainId: "244",
      sourceModifiedAt: "2026-03-01T00:00:00.000Z",
      retrievedAt: "2026-01-02T00:00:00.000Z",
    };
    expect(resolveChainMembership([older, newer])).toBe(newer);
    expect(resolveChainMembership([newer])).toBe(newer);

    const byRetrieval = {
      providerId: "provider-a",
      cmsChainId: "244",
      sourceModifiedAt: null,
      retrievedAt: "2026-05-01T00:00:00.000Z",
    };
    expect(
      resolveChainMembership([
        {
          providerId: "provider-a",
          cmsChainId: "244",
          sourceModifiedAt: null,
          retrievedAt: "2026-04-01T00:00:00.000Z",
        },
        byRetrieval,
      ]),
    ).toBe(byRetrieval);

    const unmatched = {
      providerId: null,
      cmsChainId: "244",
      sourceModifiedAt: "2026-02-01T00:00:00.000Z",
    };
    expect(
      resolveChainMembership([
        { providerId: null, cmsChainId: "244", sourceModifiedAt: "2026-01-01T00:00:00.000Z" },
        unmatched,
      ]),
    ).toEqual(unmatched);
  });

  it("does not choose a CCN or a chain membership with LIMIT 1", () => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "chain-repository.ts"),
      "utf8",
    );
    const providerLookup = source.slice(
      source.indexOf("export async function getProviderChainIntelligence"),
      source.indexOf("export async function getChainIntelligence"),
    );
    const facilityQuery = source.slice(
      source.indexOf("canonical_ccns"),
      source.indexOf("const first = snapshots.rows[0]"),
    );
    expect(providerLookup).toContain("resolveChainMembership");
    expect(providerLookup).not.toContain("LIMIT 1");
    expect(providerLookup).not.toContain("ORDER BY");
    expect(facilityQuery).toContain("array_agg(DISTINCT btrim(pi.identifier_value))");
    expect(facilityQuery).not.toContain("ORDER BY pi.identifier_value");
    expect(facilityQuery).not.toContain("ORDER BY identifier_value");
    expect(source.match(/LIMIT 1(?!\d)/g)).toHaveLength(1);
    const chainRead = source.slice(source.indexOf("export async function getChainIntelligence"));
    const authorityQuery = chainRead.slice(chainRead.indexOf("identifier_value = ANY"));
    expect(chainRead).toContain("cmsCcnAuthorityKeysFromSources");
    expect(chainRead).toContain(
      "pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL AND pi.identifier_value = ANY($1::text[])",
    );
    expect(chainRead.slice(chainRead.indexOf("facilities:"))).not.toContain("pool.query");
    expect(authorityQuery).not.toContain("ORDER BY");
    expect(authorityQuery).not.toContain("LIMIT");
  });

  it("unlinks a normalized CCN shared by different providers, including one outside the page", () => {
    const indiana = {
      storedCcn: "15010",
      canonicalCcns: ["15010"],
      providerName: "Example Indiana Facility",
      state: "IN",
      overallRating: 3,
    };
    const padded = {
      storedCcn: "015010",
      canonicalCcns: ["015010"],
      providerName: "Padded Indiana Facility",
      state: "IN",
      overallRating: 4,
    };
    const sameProvider = collidingCanonicalCmsCcns([
      { providerId: "provider-a", identifierValue: "15010" },
      { providerId: "provider-a", identifierValue: "015010" },
      { providerId: "provider-a", identifierValue: "015010" },
    ]);
    expect(sameProvider.size).toBe(0);
    const linked = chainFacilitiesFromSources(
      [indiana],
      [
        { providerId: "provider-a", identifierValue: "15010" },
        { providerId: "provider-a", identifierValue: "015010" },
      ],
    );
    expect(linked).toHaveLength(1);
    expect(chainFacilityHref(linked[0].ccn, linked[0].providerName)).toBe(
      "/facility/cms/015010/example-indiana-facility",
    );

    const crossed = collidingCanonicalCmsCcns([
      { providerId: "provider-a", identifierValue: "15010" },
      { providerId: "provider-b", identifierValue: "015010" },
    ]);
    expect(crossed).toEqual(new Set(["015010"]));
    const both = chainFacilitiesFromSources(
      [indiana, padded],
      [
        { providerId: "provider-a", identifierValue: "15010" },
        { providerId: "provider-b", identifierValue: "015010" },
      ],
    );
    expect(both).toHaveLength(2);
    for (const facility of both) {
      expect(chainFacilityHref(facility.ccn, facility.providerName)).toBeNull();
    }

    const pageKeys = cmsCcnAuthorityKeysFromSources([indiana]);
    expect(pageKeys).toEqual(["015010", "15010"]);
    expect(pageKeys).not.toContain("055305");
    const pageOfOneHundred = Array.from({ length: 100 }, (_, index) => {
      const stored = String(index).padStart(5, "0");
      return { storedCcn: stored, canonicalCcns: [stored] };
    });
    expect(cmsCcnAuthorityKeysFromSources(pageOfOneHundred).length).toBe(200);
    const outsidePage = chainFacilitiesFromSources(
      [padded],
      [
        { providerId: "provider-a", identifierValue: "015010" },
        { providerId: "provider-outside", identifierValue: "15010" },
      ],
    );
    expect(outsidePage).toHaveLength(1);
    expect(chainFacilityHref(outsidePage[0].ccn, outsidePage[0].providerName)).toBeNull();
    const unambiguous = chainFacilitiesFromSources(
      [padded],
      [{ providerId: "provider-a", identifierValue: "015010" }],
    );
    expect(chainFacilityHref(unambiguous[0].ccn, unambiguous[0].providerName)).toBe(
      "/facility/cms/015010/padded-indiana-facility",
    );
  });

  it("keeps one canonical provider and the known examples linkable", () => {
    expect(cmsCcnAuthorityKeys(["01A193", "555180", "1234", "nope"])).toEqual(["01A193", "555180"]);
    const facilities = chainFacilitiesFromSources(
      reported.map(([stored, canonical, name]) => ({
        storedCcn: stored,
        canonicalCcns: [canonical],
        providerName: name,
        state: "CA",
        overallRating: 4,
      })),
      reported.map(([, canonical], index) => ({
        providerId: `provider-${index}`,
        identifierValue: canonical,
      })),
    );
    reported.forEach(([, canonical, name, slug], index) => {
      expect(facilities[index]?.ccn).toBe(canonical);
      expect(chainFacilityHref(facilities[index].ccn, name)).toBe(
        `/facility/cms/${canonical}/${slug}`,
      );
    });
    const malformed = chainFacilitiesFromSources(
      [
        {
          storedCcn: "1234",
          canonicalCcns: ["nope"],
          providerName: "Malformed Facility",
          state: "CA",
          overallRating: null,
        },
      ],
      [{ providerId: "provider-a", identifierValue: "1234" }],
    );
    expect(malformed[0]?.ccn).toBe("1234");
    expect(chainFacilityHref(malformed[0].ccn, "Malformed Facility")).toBeNull();
    const manyCurrent = chainFacilitiesFromSources(
      [
        {
          storedCcn: "055640",
          canonicalCcns: ["055640", "555180"],
          providerName: "Grass Valley Healthcare Center",
          state: "CA",
          overallRating: 5,
        },
      ],
      [
        { providerId: "provider-a", identifierValue: "055640" },
        { providerId: "provider-a", identifierValue: "555180" },
      ],
    );
    expect(chainFacilityHref(manyCurrent[0].ccn, manyCurrent[0].providerName)).toBeNull();
  });
});
