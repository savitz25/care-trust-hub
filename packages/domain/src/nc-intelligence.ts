import { NC_PUBLIC_SNAPSHOT } from "./nc-public-snapshot";

export { NC_PUBLIC_SNAPSHOT };

export const NC_INTEL_VERSION = "senior-nc-state-intel-v1" as const;
export const NC_PUBLIC_FINGERPRINT =
  "a53e54853c351e287e8d91a7f131369d60a4e40a3f35a64d2e86899ed41d3181";
export const NC_PUBLIC_PATH = "/north-carolina";

export type NcPublicSnapshot = typeof NC_PUBLIC_SNAPSHOT;

export const NC_LOCKED = {
  adultCareHomes: 568,
  familyCareHomes: 515,
  nursingHomes: 423,
  homeHealth: 192,
  hospice: 212,
  homeCareAllMixed: 3336,
  nursingPool: 631,
  latestStarObservations: 1057,
  starFidAttachments: 1083,
  penaltyRows: 489,
  penaltyEvents: 488,
  penaltyLicenses: 190,
  sodIndexRows: 446,
  adultDayCenters: 93,
  adultDaySlots: 5850,
  paceOrganizations: 11,
  paceLocations: 14,
  ccrcMapCommunities: 66,
  ccrcHandbookIdRows: 68,
  ccahRows: 10,
  overnightRespite: 1,
  cmsNursingHomes: 419,
  cmsHomeHealth: 166,
  cmsHospice: 76,
  exactCmsBridgesTotal: 0,
} as const;

export type NcCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "ACQUIRED_INDEX"
  | "OPEN_SEARCH_ONLY"
  | "SOURCE_NOT_ACQUIRED";

export interface NcTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: NcCoverageState;
  caveat: string;
}

export function ncTraceMetrics(snapshot: NcPublicSnapshot = NC_PUBLIC_SNAPSHOT): NcTraceMetric[] {
  return [
    {
      id: "dhsr-ach",
      label: "NC DHSR Adult Care Home license rows",
      display: snapshot.adultCareHomes.NC_ADULT_CARE_HOME_ROWS.toLocaleString("en-US"),
      value: snapshot.adultCareHomes.NC_ADULT_CARE_HOME_ROWS,
      source: snapshot.regulatorMap.dhsrListings,
      sourceDate: snapshot.clocks.ach_list_update_date,
      sourceGrain: "NC-DHSR-ACH:{HAL license} from 2026-07-30 Adult Care Home listing",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Adult Care Homes are not Family Care Homes and not Nursing Homes. This is not a combined NC senior-facilities total.",
    },
    {
      id: "dhsr-star",
      label: "NC DHSR Star Rating listing observations",
      display: snapshot.starRatings.NC_LATEST_STAR_OBSERVATIONS.toLocaleString("en-US"),
      value: snapshot.starRatings.NC_LATEST_STAR_OBSERVATIONS,
      source: snapshot.regulatorMap.starSearch,
      sourceDate: snapshot.clocks.star_listing_as_of,
      sourceGrain: "Official NC DHSR Star Rating column on ACH/FCH listings as of 2026-07-30",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "This is an NC DHSR Star Rating, not a TrustHub score. Missing/N/A is not zero. Issue dates remain on facility.asp. TrustHub does not rank facilities.",
    },
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in North Carolina",
      display: snapshot.cmsOverlay.nursingHomes.toLocaleString("en-US"),
      value: snapshot.cmsOverlay.nursingHomes,
      source: snapshot.regulatorMap.cmsCareCompare,
      sourceDate: snapshot.clocks.cms_sourceAsOf,
      sourceGrain: "CMS Nursing Home CCN with state = NC",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "CMS certification is not a DHSR nursing-home license. 419 CMS vs 423 DHSR rows is not an identity bridge.",
    },
  ];
}

export function assertNcIntelligence(
  value: NcPublicSnapshot = NC_PUBLIC_SNAPSHOT,
): NcPublicSnapshot {
  if (value.version !== NC_INTEL_VERSION)
    throw new Error(`Unexpected NC contract ${value.version}`);
  if (value.fingerprint !== NC_PUBLIC_FINGERPRINT) throw new Error("NC fingerprint drifted");
  if (value.publicationPath !== NC_PUBLIC_PATH) throw new Error("path must be /north-carolina");
  if (value.adultCareHomes.NC_ADULT_CARE_HOME_ROWS !== NC_LOCKED.adultCareHomes) {
    throw new Error("ACH drifted");
  }
  if (value.familyCareHomes.NC_FAMILY_CARE_HOME_ROWS !== NC_LOCKED.familyCareHomes) {
    throw new Error("FCH drifted");
  }
  if (value.nursingHomes.NC_NURSING_HOME_ROWS !== NC_LOCKED.nursingHomes) {
    throw new Error("NH drifted");
  }
  if (value.homeHealth.NC_HOME_HEALTH_ROWS !== NC_LOCKED.homeHealth) {
    throw new Error("Home Health drifted");
  }
  if (value.hospice.NC_HOSPICE_ROWS !== NC_LOCKED.hospice) throw new Error("Hospice drifted");
  if (value.homeCareAllMixed.NC_HOME_CARE_ALL_MIXED_ROWS !== NC_LOCKED.homeCareAllMixed) {
    throw new Error("Home Care All mixed drifted");
  }
  if (
    Number(value.adultCareHomes.NC_ADULT_CARE_HOME_ROWS) ===
    Number(value.familyCareHomes.NC_FAMILY_CARE_HOME_ROWS)
  ) {
    throw new Error("ACH must not equal FCH");
  }
  if (Number(value.homeHealth.NC_HOME_HEALTH_ROWS) === Number(value.hospice.NC_HOSPICE_ROWS)) {
    throw new Error("Home Health must not equal Hospice");
  }
  if (!value.homeCareAllMixed.not_home_care_agency_count) {
    throw new Error("Home Care All mixed file must not be treated as a Home Care agency count");
  }
  if (value.starRatings.label !== "NC DHSR Star Rating") {
    throw new Error("Star Rating must stay labeled NC DHSR Star Rating");
  }
  if (!value.starRatings.not_trusthub_score || !value.starRatings.no_aggregate_rating) {
    throw new Error("Star Rating must not be a TrustHub score");
  }
  if (value.crosswalk.EXACT_NC_STATE_TO_CMS_BRIDGES_TOTAL !== 0) {
    throw new Error("no CCN in DHSR listings means zero exact CMS bridges");
  }
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("graph writes must stay 0");
  if (value.claimEligibilityBroadened) throw new Error("claim eligibility must stay false");
  if (value.localWorkNeededNow !== "NO") throw new Error("local work must stay NO");
  if (!value.clocks.retrievedAt_is_not_sourceAsOf) {
    throw new Error("retrievedAt is not sourceAsOf");
  }
  return value;
}
