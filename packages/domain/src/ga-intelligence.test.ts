import { describe, expect, it } from "vitest";
import { GA_PUBLIC_FINGERPRINT, GA_PUBLIC_SNAPSHOT, assertGaIntelligence } from "./ga-intelligence";

describe("GA-SEN-001 public snapshot", () => {
  it("keeps CMS Georgia partitions and refuses invented state totals", () => {
    const snap = assertGaIntelligence();
    expect(snap.fingerprint).toBe(GA_PUBLIC_FINGERPRINT);
    expect(snap.cmsOverlay.nursingHomes).toBe(356);
    expect(snap.cmsOverlay.homeHealth).toBe(105);
    expect(snap.cmsOverlay.hospice).toBe(261);
    expect(snap.personalCareHomes.rows).toBeNull();
    expect(snap.assistedLivingCommunities.rows).toBeNull();
    expect(JSON.stringify(snap)).not.toMatch(/"value":2910|"value":357|"value":30000|"rows":2910/);
    expect(snap.programContext.statement).toMatch(/2,910 facilities/);
    expect(snap.programContext.usedAsTrustHubCount).toBe(false);
  });
});
