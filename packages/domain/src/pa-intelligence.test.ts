import { describe, expect, it } from "vitest";
import {
  PA_LOCKED,
  PA_PUBLIC_FINGERPRINT,
  PA_PUBLIC_SNAPSHOT,
  assertPaIntelligence,
} from "./pa-intelligence";

describe("PA-SEN-001 snapshot contract", () => {
  it("keeps PCH, ALR, nursing home, home health, home care, and hospice separate", () => {
    const snap = assertPaIntelligence();
    expect(snap.fingerprint).toBe(PA_PUBLIC_FINGERPRINT);
    expect(snap.nursingHomes.PA_NURSING_HOME_ROWS).toBe(PA_LOCKED.nursingHomeRows);
    expect(snap.homeHealth.PA_HOME_HEALTH_ROWS).toBe(PA_LOCKED.homeHealthRows);
    expect(snap.homeCare.PA_HOME_CARE_ROWS).toBe(PA_LOCKED.homeCareRows);
    expect(snap.hospice.PA_HOSPICE_ROWS).toBe(PA_LOCKED.hospiceRows);
    expect(snap.pchRoster.coverage).toBe("OPEN_SEARCH_ONLY");
    expect(snap.alrRoster.coverage).toBe("OPEN_SEARCH_ONLY");
    expect(snap.pchMonthlyReport.PA_PCH_MONTHLY_REPORT_HOMES).toBe(995);
    expect(snap.cmsOverlay.nursingHomes).toBe(656);
    expect(snap.homeCare.PA_HOME_CARE_ROWS).not.toBe(snap.homeHealth.PA_HOME_HEALTH_ROWS);
    expect(snap.hospice.PA_HOSPICE_ROWS).not.toBe(snap.homeHealth.PA_HOME_HEALTH_ROWS);
  });

  it("does not treat matching 659 nursing-home and home-health counts as a bridge", () => {
    const snap = assertPaIntelligence();
    expect(snap.nursingHomes.PA_NURSING_HOME_ROWS).toBe(snap.homeHealth.PA_HOME_HEALTH_ROWS);
    expect(snap.nursingHomes.matching_659_home_health_is_not_a_bridge).toBe(true);
    expect(snap.crosswalk.matching_counts_are_not_a_bridge).toBe(true);
    expect(snap.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES.nursing_home).toBe(647);
    expect(snap.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES.home_care).toBe(0);
  });

  it("keeps claim, graph, and name-only attachment frozen", () => {
    const snap = assertPaIntelligence();
    expect(snap.identity.NAME_ONLY_UNSAFE).toBe(0);
    expect(snap.expansion_ledger.GRAPH_WRITES).toBe(0);
    expect(snap.expansion_ledger.NET_NEW_CANONICAL_FACILITIES).toBe(0);
    expect(snap.claimEligibilityBroadened).toBe(false);
    expect(snap.adverse_publication.EXACT_PROFILE_ATTACHMENTS).toBe(0);
    expect(snap.localWorkNeededNow).toBe("NO");
    expect(snap.clocks.retrievedAt_is_not_sourceAsOf).toBe(true);
  });
});
