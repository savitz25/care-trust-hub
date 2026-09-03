import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NJ_PUBLIC_FINGERPRINT } from "./nj-intelligence";
import {
  NJ_COUNTY_FINGERPRINTS,
  NJ_COUNTY_INTEL_VERSION,
  NJ_COUNTY_LOCKED,
  NJ_COUNTY_SLUGS,
  assertNjCountyIntelligence,
  getNjCountySnapshot,
  njCountyTraceMetrics,
} from "./nj-county-intelligence";

const dir = dirname(fileURLToPath(import.meta.url));

describe("NJ-SEN-COUNTY-001 public snapshots", () => {
  it("locks four county fingerprints and pins the frozen NJ-SEN-005 fingerprint", () => {
    for (const slug of NJ_COUNTY_SLUGS) {
      const snap = getNjCountySnapshot(slug);
      expect(snap.version).toBe(NJ_COUNTY_INTEL_VERSION);
      expect(snap.fingerprint).toBe(NJ_COUNTY_FINGERPRINTS[slug]);
      expect(snap.stateSnapshotFingerprint).toBe(NJ_PUBLIC_FINGERPRINT);
      const artifact = JSON.parse(
        readFileSync(join(dir, "../../../artifacts/nj-sen-county-001", `${slug}.json`), "utf8"),
      ) as { fingerprint: string };
      expect(artifact.fingerprint).toBe(NJ_COUNTY_FINGERPRINTS[slug]);
      assertNjCountyIntelligence(snap);
    }
  });

  it("keeps All_LTC and All_Acute separate and does not invent a senior-provider total", () => {
    for (const slug of NJ_COUNTY_SLUGS) {
      const snap = getNjCountySnapshot(slug);
      const locked = NJ_COUNTY_LOCKED[slug];
      expect(snap.njdoh.ltc).toBe(locked.ltc);
      expect(snap.njdoh.acute).toBe(locked.acute);
      expect(snap.njdoh.inventoryRows).toBe(locked.inventoryRows);
      expect(snap.njdoh.ltc + snap.njdoh.acute).toBe(snap.njdoh.inventoryRows);
      expect(JSON.stringify(snap)).not.toMatch(/senior-care providers|ranking of/i);
      expect(snap.disclaimers).toContain(
        "SeniorTrustHub does not rank facilities and does not publish a Trust Score.",
      );
    }
  });

  it("omits county CMS, enforcement exact, staffing aggregate, and Medicaid listed-row counts", () => {
    for (const slug of NJ_COUNTY_SLUGS) {
      const snap = getNjCountySnapshot(slug);
      expect(snap.cms.treatment).toBe("STATEWIDE_OVERLAY_ONLY");
      expect(snap.cms.countyCountPublished).toBeNull();
      expect(snap.cms.nursingHomesStatewide).toBe(348);
      expect(snap.enforcement.treatment).toBe("STATEWIDE_EXACT_CONTEXT_ONLY");
      expect(snap.enforcement.countyExactPublished).toBeNull();
      expect(snap.enforcement.exactStatewide).toBe(300);
      expect(snap.enforcement.unresolvedStatewide).toBe(476);
      expect(snap.staffing.treatment).toBe("STATEWIDE_CONTEXT_ONLY_NH");
      expect(snap.staffing.countyAggregatePublished).toBeNull();
      expect(snap.staffing.notAttachedTo).toEqual(
        expect.arrayContaining(["ALR", "Home Health", "Hospice", "PACE", "CCRC"]),
      );
      expect(snap.medicaid.treatment).toBe("STATEWIDE_SCHEDULE_ONLY");
      expect(snap.medicaid.countyListedRowsPublished).toBeNull();
      expect(snap.medicaid.listedRowsStatewide).toBe(236);
      const traces = njCountyTraceMetrics(snap);
      expect(traces.find((row) => row.id === "cms-county")?.value).toBeNull();
      expect(traces.find((row) => row.id === "enforcement-county")?.value).toBeNull();
      expect(traces.find((row) => row.id === "staffing-county")?.value).toBeNull();
      expect(traces.find((row) => row.id === "medicaid-county")?.value).toBeNull();
    }
  });

  it("treats PACE center address as geography, not a service area", () => {
    const monmouth = getNjCountySnapshot("monmouth-county");
    expect(monmouth.pace.operatingCentersInCounty).toBe(1);
    expect(monmouth.pace.centersInCounty[0]?.name).toBe("BoldAge PACE Oceanport");
    expect(monmouth.pace.centersInCounty[0]?.status).toBe("OPERATING");
    const middlesex = getNjCountySnapshot("middlesex-county");
    expect(middlesex.pace.centersInCounty[0]?.name).toBe("BoldAge PACE East Brunswick");
    expect(middlesex.pace.centersInCounty[0]?.status).toBe("OPERATING");
    const union = getNjCountySnapshot("union-county");
    expect(union.pace.centersInCounty[0]?.name).toBe("Lutheran Senior LIFE at Union");
    expect(union.pace.centersInCounty[0]?.city).toBe("Plainfield");
    expect(union.pace.centersInCounty[0]?.status).toBe("OPERATING");
    const somerset = getNjCountySnapshot("somerset-county");
    expect(somerset.pace.operatingCentersInCounty).toBe(0);
    expect(somerset.pace.awardedOrInDevelopmentCentersInCounty).toBe(1);
    expect(somerset.pace.centersInCounty[0]?.name).toBe("Senior LIFE Bridgewater (awarded)");
    expect(somerset.pace.centersInCounty[0]?.status).toBe("IN_DEVELOPMENT");
    expect(somerset.pace.caveat).toMatch(/not a service area/i);
  });

  it("publishes Monmouth ADRC, 12 senior centers, and meal resources as county resources", () => {
    const snap = getNjCountySnapshot("monmouth-county");
    expect(snap.localResources.adrc?.agency).toMatch(/Aging, Disabilities and Veterans/);
    expect(snap.localResources.adrc?.phone).toBe("732-431-7450");
    expect(snap.localResources.seniorCenters?.count).toBe(12);
    expect(snap.localResources.seniorCenters?.rows[0]?.name).toBe("Asbury Park Senior Center");
    expect(snap.localResources.otherServiceCenters).toHaveLength(3);
    expect(snap.localResources.homeDeliveredMeals.map((row) => row.provider).join(" ")).toMatch(
      /Interfaith Neighbors/,
    );
    expect(snap.localResources.kind).toBe("COUNTY_RESOURCE");
    expect(snap.localResources.notALicensedFacility).toBe(true);
  });

  it("publishes Middlesex 8 complete meal sites and 12 extracted senior centers with remaining coverage", () => {
    const snap = getNjCountySnapshot("middlesex-county");
    expect(snap.localResources.adrc?.phone).toBe("732-745-3295");
    expect(snap.localResources.congregateMealSites).toHaveLength(8);
    expect(snap.localResources.congregateMealSitesCoverage).toBe("COMPLETE_OFFICIAL_HTML");
    expect(snap.localResources.seniorCenters?.count).toBe(12);
    expect(snap.localResources.seniorCenters?.coverage).toBe("ACQUIRED_PUBLIC_HTML_PARTIAL");
    expect(snap.localResources.seniorCentersNotExtracted).toEqual(
      expect.arrayContaining(["Woodbridge", "North Brunswick", "Plainsboro"]),
    );
  });

  it("treats Somerset 58 housing rows as May 2023 planning inventory, not NJDOH or CMS", () => {
    const snap = getNjCountySnapshot("somerset-county");
    const housing = snap.localResources.housingInventory;
    expect(housing?.seniorRelatedRecordCount).toBe(58);
    expect(housing?.rows).toHaveLength(58);
    expect(housing?.categoryCounts["Senior Residence"]).toBe(21);
    expect(housing?.categoryCounts["Assisted Living Facility"]).toBe(20);
    expect(housing?.categoryCounts["Continuing Care Retirement Community"]).toBe(4);
    expect(housing?.categoryCounts["Active Adult Community"]).toBe(13);
    expect(housing?.notCurrentNjdohLicensure).toBe(true);
    expect(housing?.notCmsDirectory).toBe(true);
    expect(housing?.notCertificateOfAuthorityRoster).toBe(true);
    expect(housing?.noNameOnlyMergeToNjdoh).toBe(true);
    expect(housing?.grain).toBe("COUNTY_PLANNING_HOUSING_INVENTORY_POINT");
    expect(snap.localResources.nursingHomeGeocode?.count).toBe(14);
    expect(snap.localResources.nursingHomeGeocode?.notNjdohLicenseRoster).toBe(true);
    expect(snap.ccrc.countPublished).toBeNull();
  });

  it("attributes Union Senior Home Improvement Grant as dated 62+ / $10,000 county program information", () => {
    const snap = getNjCountySnapshot("union-county");
    const grant = snap.localResources.seniorGrant;
    expect(grant?.programName).toBe("Union County Senior Home Improvement Grant");
    expect(grant?.sourceAsOf).toBe("2026-01-14");
    expect(grant?.benefitAmountPublished).toBe("capped at $10,000");
    expect(grant?.ageRule).toMatch(/62/);
    expect(grant?.attribution).toMatch(/According to the county's dated program information/);
    expect(grant?.notGuaranteedEligibilityOrFunding).toBe(true);
    expect(grant?.notACountyLicense).toBe(true);
    expect(snap.localResources.adrc?.agency).toMatch(/Division on Aging/);
    expect(snap.localResources.adrc?.phone).toBe("908-527-4870");
    expect(snap.localResources.homeImprovementProgram?.notACountyLicense).toBe(true);
    expect(snap.localResources.homeImprovementProgram?.agingInPlaceNote).toMatch(
      /not county-licensed contractors/i,
    );
  });

  it("requires indexable county pages to clear the publication gate", () => {
    for (const slug of NJ_COUNTY_SLUGS) {
      const snap = getNjCountySnapshot(slug);
      expect(snap.publicationGate.indexable).toBe(true);
      expect(snap.publicationGate.sourceFamilyCount).toBeGreaterThanOrEqual(3);
      expect(snap.publicationGate.countySpecificLocalSource).toBe(true);
      expect(snap.publicationGate.findingCount).toBeGreaterThanOrEqual(2);
      expect(snap.publicationGate.deterministicSnapshot).toBe(true);
      expect(snap.path).toBe(`/new-jersey/${slug}`);
    }
  });
});
