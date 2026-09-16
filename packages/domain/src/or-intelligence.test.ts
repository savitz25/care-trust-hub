import { describe, expect, it } from "vitest";
import {
  OR_LOCKED,
  OR_PUBLIC_FINGERPRINT,
  OR_PUBLIC_SNAPSHOT,
  assertOrIntelligence,
} from "./or-intelligence";

describe("OR-SEN-001 snapshot contract", () => {
  it("keeps ODHS classes, OHA licenses, and CMS overlays separate", () => {
    const snap = assertOrIntelligence();
    expect(snap.fingerprint).toBe(OR_PUBLIC_FINGERPRINT);
    expect(snap.odhsProviders.OPEN_NF).toBe(OR_LOCKED.openNf);
    expect(snap.odhsProviders.OPEN_ALF).toBe(OR_LOCKED.openAlf);
    expect(snap.odhsProviders.OPEN_RCF).toBe(OR_LOCKED.openRcf);
    expect(snap.odhsProviders.OPEN_AFH).toBe(OR_LOCKED.openAfh);
    expect(snap.cmsOverlay.nursingHomes).toBe(128);
    expect(snap.cmsOverlay.homeHealth).toBe(51);
    expect(snap.cmsOverlay.hospice).toBe(66);
    expect(snap.crosswalk.exactStateToCmsBridges).toBe(0);
    expect(snap.ohaHomeHealth.rows).not.toBe(snap.cmsOverlay.homeHealth);
    expect(snap.ohaHospice.rows).not.toBe(snap.cmsOverlay.hospice);
    expect(snap.odhsProviders.OPEN_NF + snap.odhsProviders.OPEN_ALF).not.toBe(
      snap.odhsProviders.OPEN_AFH,
    );
  });

  it("preserves inspection, violation, and license-condition grains", () => {
    const snap = assertOrIntelligence();
    expect(snap.odhsInspections.INSPECTION_ROWS).toBe(snap.odhsInspections.DISTINCT_EVENT_IDS);
    expect(snap.odhsInspections.complaint_related_inspection_ne_complaint).toBe(true);
    expect(snap.odhsViolations.violation_ne_complaint).toBe(true);
    expect(snap.odhsRegulatoryActions.UNIQUE_REGULATORY_MATTERS).toBe(1038);
    expect(snap.odhsRegulatoryActions.REGULATORY_ACTION_ROWS).toBe(1299);
    expect(snap.odhsRegulatoryActions.scope).toMatch(/LICENSE CONDITIONS/);
    expect(snap.identity.NAME_ONLY_UNSAFE).toBe(0);
    expect(snap.adverse_publication.EXACT_PROFILE_ATTACHMENTS).toBe(0);
    expect(snap.adverse_publication.PUBLICLY_RENDERED_PROFILES).toBe(0);
    expect(snap.expansion_ledger.GRAPH_WRITES).toBe(0);
    expect(snap.claimEligibilityBroadened).toBe(false);
  });

  it("does not treat generatedAt or retrievedAt as ODHS sourceAsOf", () => {
    expect(OR_PUBLIC_SNAPSHOT.clocks.odhs_sourceAsOf).toBeNull();
    expect(OR_PUBLIC_SNAPSHOT.generatedAt).not.toBe(OR_PUBLIC_SNAPSHOT.clocks.odhs_retrievedAt);
    expect(OR_PUBLIC_SNAPSHOT.clocks.retrievedAt_is_not_sourceAsOf).toBe(true);
  });
});
