import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  assertNyIntelligence,
  NY_LOCKED,
  NY_PUBLIC_FINGERPRINT,
  NY_PUBLIC_PATH,
  nyTraceMetrics,
} from "./ny-intelligence";
import { NY_PUBLIC_SNAPSHOT } from "./ny-public-snapshot";

function fingerprint(value: object): string {
  return createHash("sha256")
    .update(JSON.stringify(value, Object.keys(value).sort()))
    .digest("hex");
}

describe("NY-SEN-001 New York state intelligence", () => {
  const snap = assertNyIntelligence();

  it("locks ACF, nursing-home, DNR, and CMS grains separately", () => {
    expect(snap.acf.acfFacilities).toBe(527);
    expect(snap.acf.adultHomeFacilities).toBe(381);
    expect(snap.acf.enrichedHousingFacilities).toBe(146);
    expect(snap.nursingHomeProfile.sourceRows).toBe(597);
    expect(snap.nursingHomeProfile.distinctCcn).toBe(594);
    expect(snap.doNotRefer.observationCount).toBe(117);
    expect(snap.cmsOverlay.nursingHomes).toBe(593);
    expect(snap.cmsOverlay.homeHealth).toBe(100);
    expect(snap.cmsOverlay.hospice).toBe(39);
    expect(snap.acf.acfFacilities).not.toBe(snap.nursingHomeProfile.sourceRows);
    expect(snap.nursingHomeProfile.sourceRows).not.toBe(snap.cmsOverlay.nursingHomes);
  });

  it("keeps assisted-living designations from being summed as facilities", () => {
    expect(snap.acf.adultHomeIsNotEnrichedHousing).toBe(true);
    expect(snap.assistedLivingDesignations.alpIsNotAlr).toBe(true);
    expect(snap.assistedLivingDesignations.alrIsNotEalr).toBe(true);
    expect(snap.assistedLivingDesignations.alrIsNotSnalr).toBe(true);
    expect(snap.assistedLivingDesignations.doNotSumAsAssistedLivingFacilities).toBe(true);
    expect(snap.acf.credentialRowIsNotFacility).toBe(true);
    expect(snap.acf.capacityIsNotOccupancy).toBe(true);
    expect(snap.expansionLedger.NY_ACF_CERTIFIED_CAPACITY).toBeNull();
  });

  it("keeps inspection, complaint, fine, and Do Not Refer semantics source-native", () => {
    expect(snap.nursingHomeProfile.inspectionIsNotDeficiencyCount).toBe(true);
    expect(snap.nursingHomeProfile.complaintSurveyIsNotSubstantiatedComplaint).toBe(true);
    expect(snap.nursingHomeProfile.fineIsNotCriminalConviction).toBe(true);
    expect(snap.doNotRefer.notCriminalConviction).toBe(true);
    expect(snap.doNotRefer.notTrustHubBlacklist).toBe(true);
    expect(snap.doNotRefer.nameOnlyJoins).toBe("UNSAFE");
    expect(snap.doNotRefer.exactProfileAttachments).toBe(0);
    expect(snap.homeCare.lhcsaIsNotCmsHha).toBe(true);
    expect(snap.publication.operatorIsNotFacility).toBe(true);
  });

  it("does not mint profiles or a combined New York senior-provider total", () => {
    expect(snap.expansionLedger.NET_NEW_CANONICAL_FACILITIES).toBe(0);
    expect(snap.expansionLedger.NET_NEW_PUBLIC_PROFILES).toBe(0);
    expect(snap.expansionLedger.EXISTING_ORGANIZATIONS_ENRICHED).toBe(0);
    expect(snap.noCombinedDenominator).toBe(true);
    expect(snap.noTrustScore).toBe(true);
    expect(snap.noRanking).toBe(true);
    expect(snap.statewideOnly).toBe(true);
    expect(NY_PUBLIC_PATH).toBe("/new-york");
    const combined =
      NY_LOCKED.acfFacilities +
      NY_LOCKED.nhFacilities +
      NY_LOCKED.cmsHomeHealth +
      NY_LOCKED.cmsHospice;
    expect(JSON.stringify(snap)).not.toContain(`"newYorkSeniorProviders":${combined}`);
  });

  it("renders UI grain classifications for every major acquired layer", () => {
    expect(snap.uiGrains.acfFacilities).toBe("VISIBLE_PUBLIC_METRIC");
    expect(snap.uiGrains.nursingHomeFacilities).toBe("VISIBLE_PUBLIC_METRIC");
    expect(snap.uiGrains.nursingHomeSurveys).toBe("VISIBLE_PUBLIC_METRIC");
    expect(snap.uiGrains.doNotReferObservations).toBe("VISIBLE_PUBLIC_METRIC");
    expect(snap.uiGrains.cmsHomeHealth).toBe("VISIBLE_PUBLIC_METRIC");
    expect(snap.uiGrains.cmsHospice).toBe("VISIBLE_PUBLIC_METRIC");
    expect(nyTraceMetrics().map((row) => row.id)).toEqual(
      expect.arrayContaining(["acf-count", "nh-count", "nh-surveys", "dnr-count", "cms-hha", "cms-hospice"]),
    );
  });

  it("keeps a deterministic fingerprint and nested mutations change it", () => {
    expect(snap.fingerprint).toBe(NY_PUBLIC_FINGERPRINT);
    const mutated = structuredClone(NY_PUBLIC_SNAPSHOT) as Record<string, unknown>;
    const acf = { ...(mutated.acf as Record<string, unknown>), acfFacilities: 528 };
    mutated.acf = acf;
    const original = { ...NY_PUBLIC_SNAPSHOT } as Record<string, unknown>;
    delete original.fingerprint;
    const changed = { ...mutated };
    delete changed.fingerprint;
    expect(JSON.stringify(changed)).not.toBe(JSON.stringify(original));
    expect(fingerprint({ acfFacilities: 528 })).not.toBe(fingerprint({ acfFacilities: 527 }));
  });
});
