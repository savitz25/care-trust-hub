import { describe, expect, it } from "vitest";
import {
  assertVaIntelligence,
  VA_LOCKED,
  VA_PUBLIC_FINGERPRINT,
  VA_PUBLIC_PATH,
  VA_SOURCE_CATALOG,
  vaTraceMetrics,
} from "./va-intelligence";
import { formatHubCount } from "./senior-hub-intelligence";
import { VA_PUBLIC_SNAPSHOT } from "./va-public-snapshot";

describe("VA-SEN-001 Virginia state intelligence", () => {
  const snap = assertVaIntelligence();

  it("locks ALF, ADC, CMS, and inspection grains separately", () => {
    expect(snap.dssAlf.licensedFacilityCount).toBe(573);
    expect(snap.dssAdc.licensedFacilityCount).toBe(82);
    expect(snap.cmsOverlay.nursingHomes).toBe(289);
    expect(snap.cmsOverlay.homeHealth).toBe(237);
    expect(snap.cmsOverlay.hospice).toBe(110);
    expect(snap.dssAlfInspections.observationCount).toBe(7032);
    expect(snap.dssAlf.licensedCapacitySum).toBe(38010);
    expect(VA_LOCKED.alfCount).not.toBe(VA_LOCKED.cmsNursingHomes);
    expect(VA_LOCKED.alfCount + VA_LOCKED.adcCount).not.toBe(VA_LOCKED.cmsNursingHomes);
  });

  it("keeps ALF distinct from nursing homes and CMS CCN", () => {
    expect(snap.dssAlf.notNursingHome).toBe(true);
    expect(snap.dssAlf.notCmsCcn).toBe(true);
    expect(snap.identity.namespace).toBe("VA-DSS-ALF:{licenseId}");
    expect(snap.identity.verified).toBe(true);
    expect(snap.identity.nameOnlyJoins).toBe("UNSAFE");
  });

  it("does not treat inspection, complaint-related, or violation flags as guilt or counts", () => {
    expect(snap.dssAlfInspections.complaintRelatedIsNotSubstantiatedComplaint).toBe(true);
    expect(snap.dssAlfInspections.violationFlagIsNotViolationCount).toBe(true);
    expect(snap.dssAlfInspections.inspectionIsNotDisciplinaryAction).toBe(true);
    expect(snap.dssAlfInspections.noViolationShownIsNotPerfect).toBe(true);
    expect(snap.dssAlfInspections.complaintRelatedObservations).toBe(2488);
    expect(snap.dssAlfInspections.violationFlagYes).toBe(4066);
    expect(snap.dssAlfInspections.violationFlagYes).not.toBe(
      snap.dssAlfInspections.observationCount,
    );
  });

  it("keeps capacity, license type, and qualifications as source-native non-quality fields", () => {
    expect(snap.dssAlf.capacityGrain).toBe("licensed_capacity_not_occupancy");
    expect(snap.dssAlf.licenseTypeIsNotQuality).toBe(true);
    expect(snap.dssAlf.qualificationsAreNotRatings).toBe(true);
    expect(snap.dssAlf.licenseTypes["1YR"]).toBe(277);
    expect(snap.dssAlf.licenseTypes["2YR"]).toBe(211);
  });

  it("does not publish a cross-class total, Trust Score, ranking, or local routes", () => {
    expect(snap.noCombinedDenominator).toBe(true);
    expect(snap.noTrustScore).toBe(true);
    expect(snap.noRanking).toBe(true);
    expect(snap.noAggregateRating).toBe(true);
    expect(snap.statewideOnly).toBe(true);
    expect(snap.noCountyRoutes).toBe(true);
    expect(snap.noCityRoutes).toBe(true);
    expect(snap.publicationPath).toBe("/virginia");
    expect(VA_PUBLIC_PATH).toBe("/virginia");
    const combined =
      VA_LOCKED.alfCount +
      VA_LOCKED.adcCount +
      VA_LOCKED.cmsNursingHomes +
      VA_LOCKED.cmsHomeHealth +
      VA_LOCKED.cmsHospice;
    expect(JSON.stringify(snap)).not.toContain(`"virginiaSeniorProviders":${combined}`);
    expect(VA_SOURCE_CATALOG.some((row) => /combined/i.test(row.id))).toBe(false);
  });

  it("does not mint claimable profiles or unsafe CMS crosswalks", () => {
    expect(snap.expansionLedger.NET_NEW_CANONICAL_FACILITIES).toBe(0);
    expect(snap.expansionLedger.NET_NEW_PUBLIC_PROFILES).toBe(0);
    expect(snap.expansionLedger.EXACT_STATE_TO_CMS_CROSSWALKS).toBe(0);
    expect(snap.crosswalk.alfToCmsNh.attempted).toBe(false);
    expect(snap.publication.claimableAlfProfiles).toBe(false);
    expect(snap.claimEligibility.broadened).toBe(false);
  });

  it("keeps DSS sourceAsOf unknown and does not treat unknown as zero", () => {
    expect(snap.sourceAsOf).toBeNull();
    expect(snap.sourceAsOfState).toBe("UNKNOWN");
    expect(snap.unknownIsNotZero).toBe(true);
    expect(snap.vdh.nursingHomeInformationalPortal.coverage).toBe("OPEN_SEARCH_ONLY");
  });

  it("has a deterministic fingerprint and traceable hero metrics", () => {
    expect(snap.fingerprint).toBe(VA_PUBLIC_FINGERPRINT);
    expect(VA_PUBLIC_SNAPSHOT.fingerprint).toBe(VA_PUBLIC_FINGERPRINT);
    const traces = vaTraceMetrics(snap);
    expect(traces.map((row) => row.id)).toContain("dss-alf-count");
    expect(formatHubCount(573)).toBe("573");
  });
});
