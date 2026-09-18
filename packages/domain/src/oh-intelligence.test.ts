import { describe, expect, it } from "vitest";
import {
  OH_LOCKED,
  OH_PUBLIC_FINGERPRINT,
  OH_PUBLIC_SNAPSHOT,
  assertOhIntelligence,
} from "./oh-intelligence";

describe("OH-SEN-001 snapshot contract", () => {
  it("keeps nursing homes, RCFs, and CMS overlays separate", () => {
    const snap = assertOhIntelligence();
    expect(snap.fingerprint).toBe(OH_PUBLIC_FINGERPRINT);
    expect(snap.nursingHomes.OH_NURSING_FACILITY_ROWS).toBe(OH_LOCKED.nursingFacilities);
    expect(snap.rcf.OH_RCF_ROWS).toBe(OH_LOCKED.rcf);
    expect(snap.cmsOverlay.CMS_OH_NURSING_HOME_ROWS).toBe(OH_LOCKED.cmsNursingHomes);
    expect(snap.nursingHomes.OH_NURSING_FACILITY_ROWS).not.toBe(snap.rcf.OH_RCF_ROWS);
    expect(snap.crosswalk.EXACT_OH_STATE_TO_CMS_NURSING_HOME_BRIDGES).toBe(0);
    expect(snap.rcf.stateNativeClass).toBe("Residential Care Facility");
    expect(snap.rcf.consumerLanguage).toBe("assisted living");
  });

  it("does not treat Navigator quality as a TrustHub score", () => {
    const snap = assertOhIntelligence();
    expect(snap.navigator.not_trusthub_rating).toBe(true);
    expect(snap.no_trust_score).toBe(true);
    expect(snap.no_aggregate_rating).toBe(true);
    expect(snap.no_rankings).toBe(true);
    expect(snap.complaints.OH_NURSING_HOME_COMPLAINT_ROWS).toBeNull();
    expect(snap.homeHealth.OH_SKILLED_HOME_HEALTH_AGENCY_ROWS).toBeNull();
    expect(snap.expansion_ledger.GRAPH_WRITES).toBe(0);
    expect(snap.localWorkNeededNow).toBe("NO");
  });
});
