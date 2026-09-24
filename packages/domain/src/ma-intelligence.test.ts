import { describe, expect, it } from "vitest";
import {
  MA_LOCKED,
  MA_PUBLIC_FINGERPRINT,
  MA_PUBLIC_SNAPSHOT,
  assertMaIntelligence,
  maTraceMetrics,
} from "./ma-intelligence";

describe("MA-SEN-001 public snapshot", () => {
  it("keeps DPH, AGE, and CMS classes separate and unsummed", () => {
    const snap = assertMaIntelligence();
    expect(snap.fingerprint).toBe(MA_PUBLIC_FINGERPRINT);
    expect(snap.nursingHomes.rows).toBe(347);
    expect(snap.restHomes.rows).toBe(58);
    expect(snap.assistedLiving.rows).toBe(272);
    expect(snap.cmsOverlay.nursingHomes).toBe(341);
    const combined =
      MA_LOCKED.dphNursingHomes +
      MA_LOCKED.dphRestHomes +
      MA_LOCKED.ageAssistedLivingResidences +
      MA_LOCKED.dphHomeHealth +
      MA_LOCKED.dphHospice;
    expect(JSON.stringify(snap)).not.toMatch(new RegExp(`\\b${combined}\\b`));
    expect(JSON.stringify(snap)).not.toMatch(/\b688\b/); // 347 DPH + 341 CMS nursing homes
  });

  it("does not claim a state-to-CMS bridge without a CCN", () => {
    expect(MA_PUBLIC_SNAPSHOT.crosswalk.exactStateToCmsBridges).toBe(0);
    expect(MA_PUBLIC_SNAPSHOT.crosswalk.ccnInDphWorkbook).toBe(false);
    expect(MA_PUBLIC_SNAPSHOT.crosswalk.reason).toMatch(/not zero overlap/);
  });

  it("keeps ALR units as unit grain and the census report as context", () => {
    const alr = MA_PUBLIC_SNAPSHOT.assistedLiving;
    expect(alr.traditionalUnits + alr.specialCareUnits).toBe(alr.totalUnits);
    expect(alr.unitGrain).toMatch(/not residents/);
    expect(alr.liveDirectoryObservation.rowsAcquired).toBeNull();
    expect(MA_PUBLIC_SNAPSHOT.alrCensus2026.usedAsIdentitySource).toBe(false);
    expect(alr.fieldsWithheld).toContain("ED email");
  });

  it("labels the DPH survey tool as DPH evidence, not a TrustHub score", () => {
    expect(MA_PUBLIC_SNAPSHOT.surveyTool.capability).toBe("KNOWN");
    expect(MA_PUBLIC_SNAPSHOT.surveyTool.bulkCapability).toBe("NOT_ACQUIRED");
    expect(maTraceMetrics().every((m) => m.value !== null)).toBe(true);
  });
});
