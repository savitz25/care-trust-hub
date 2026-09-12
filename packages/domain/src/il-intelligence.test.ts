import { describe, expect, it } from "vitest";
import {
  IL_LOCKED,
  IL_PUBLIC_FINGERPRINT,
  IL_PUBLIC_SNAPSHOT,
  assertIlIntelligence,
} from "./il-intelligence";

describe("IL-SEN-001 snapshot contract", () => {
  it("locks CMS, IDPH, and SLP grains without combining them", () => {
    const snap = assertIlIntelligence();
    expect(snap.fingerprint).toBe(IL_PUBLIC_FINGERPRINT);
    expect(snap.cmsOverlay.nursingHomes).toBe(IL_LOCKED.cmsNursingHomes);
    expect(snap.idphHomeHealth.rows).toBe(595);
    expect(snap.supportiveLiving.operationalSites).toBe(169);
    expect(snap.stateNursingHomes.currentRosterCount).toBeNull();
    expect(snap.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS).toBe(0);
    expect(snap.expansionLedger.EXACT_IL_STATE_TO_CMS_BRIDGES).toBe(0);
    expect(snap.idphHomeHealth.rows).not.toBe(snap.cmsOverlay.homeHealth);
    expect(snap.idphHospice.rows).not.toBe(snap.cmsOverlay.hospice);
    expect(snap.cmsOverlay.nursingHomes + snap.idphHomeHealth.rows).not.toBe(
      snap.supportiveLiving.operationalSites,
    );
  });

  it("does not treat generatedAt as a source clock", () => {
    expect(IL_PUBLIC_SNAPSHOT.generatedAt).not.toBe(IL_PUBLIC_SNAPSHOT.idphHomeHealth.sourceAsOf);
    expect(IL_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.retrievedAt).not.toBe(
      IL_PUBLIC_SNAPSHOT.generatedAt,
    );
  });
});
