import { describe, expect, it } from "vitest";
import {
  NC_LOCKED,
  NC_PUBLIC_FINGERPRINT,
  NC_PUBLIC_SNAPSHOT,
  assertNcIntelligence,
} from "./nc-intelligence";

describe("NC-SEN-001 snapshot contract", () => {
  it("keeps ACH, FCH, nursing home, home health, home care mixed, and hospice separate", () => {
    const snap = assertNcIntelligence();
    expect(snap.fingerprint).toBe(NC_PUBLIC_FINGERPRINT);
    expect(snap.adultCareHomes.NC_ADULT_CARE_HOME_ROWS).toBe(NC_LOCKED.adultCareHomes);
    expect(snap.familyCareHomes.NC_FAMILY_CARE_HOME_ROWS).toBe(NC_LOCKED.familyCareHomes);
    expect(snap.nursingHomes.NC_NURSING_HOME_ROWS).toBe(NC_LOCKED.nursingHomes);
    expect(snap.homeHealth.NC_HOME_HEALTH_ROWS).toBe(NC_LOCKED.homeHealth);
    expect(snap.hospice.NC_HOSPICE_ROWS).toBe(NC_LOCKED.hospice);
    expect(snap.homeCareAllMixed.NC_HOME_CARE_ALL_MIXED_ROWS).toBe(NC_LOCKED.homeCareAllMixed);
    expect(snap.homeCareAllMixed.not_home_care_agency_count).toBe(true);
    expect(snap.nursingPool.NC_NURSING_POOL_ROWS).toBe(NC_LOCKED.nursingPool);
    expect(snap.cmsOverlay.nursingHomes).toBe(NC_LOCKED.cmsNursingHomes);
    expect(snap.adultCareHomes.NC_ADULT_CARE_HOME_ROWS).not.toBe(
      snap.familyCareHomes.NC_FAMILY_CARE_HOME_ROWS,
    );
    expect(snap.homeHealth.NC_HOME_HEALTH_ROWS).not.toBe(snap.hospice.NC_HOSPICE_ROWS);
  });

  it("preserves official NC DHSR Star Rating evidence without ranking", () => {
    const snap = assertNcIntelligence();
    expect(snap.starRatings.label).toBe("NC DHSR Star Rating");
    expect(snap.starRatings.not_trusthub_score).toBe(true);
    expect(snap.starRatings.not_ranking).toBe(true);
    expect(snap.starRatings.no_aggregate_rating).toBe(true);
    expect(snap.starRatings.no_statewide_average).toBe(true);
    expect(snap.starRatings.NC_LATEST_STAR_OBSERVATIONS).toBe(NC_LOCKED.latestStarObservations);
    expect(snap.starRatings.fidIndex.EXACT_LICENSE_FID_ATTACHMENTS).toBe(
      NC_LOCKED.starFidAttachments,
    );
    expect(snap.starRatings.missing_ne_zero).toBe(true);
    expect(snap.starRatings.historyCoverage).toBe("OPEN_SEARCH_ONLY");
  });

  it("keeps CMS overlays unbridged and claim/graph frozen", () => {
    const snap = assertNcIntelligence();
    expect(snap.crosswalk.EXACT_NC_STATE_TO_CMS_BRIDGES_TOTAL).toBe(0);
    expect(snap.crosswalk.matching_counts_are_not_a_bridge).toBe(true);
    expect(snap.nursingHomes.NC_NURSING_HOME_DISTINCT_CCNS).toBe(0);
    expect(snap.identity.NAME_ONLY_UNSAFE).toBe(0);
    expect(snap.expansion_ledger.GRAPH_WRITES).toBe(0);
    expect(snap.expansion_ledger.NET_NEW_CANONICAL_FACILITIES).toBe(0);
    expect(snap.claimEligibilityBroadened).toBe(false);
    expect(snap.adverse_publication.EXACT_PROFILE_ATTACHMENTS).toBe(0);
    expect(snap.localWorkNeededNow).toBe("NO");
    expect(snap.clocks.retrievedAt_is_not_sourceAsOf).toBe(true);
    expect(snap.pace.NC_PACE_ORGANIZATIONS).toBe(11);
    expect(snap.pace.NC_PACE_LOCATIONS).toBe(14);
    expect(snap.adultDay.NC_ADULT_DAY_CENTER_ROWS).toBe(93);
  });
});
