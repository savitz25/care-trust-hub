import { OH_PUBLIC_SNAPSHOT } from "./oh-public-snapshot";

export { OH_PUBLIC_SNAPSHOT };

export const OH_INTEL_VERSION = "senior-oh-state-intel-v1" as const;
export const OH_PUBLIC_FINGERPRINT =
  "f4e8f7706cf758403dc7e11883c936a14d080fd24d3fc25dca8ae3031c7c5578";
export const OH_PUBLIC_PATH = "/ohio";

export type OhPublicSnapshot = typeof OH_PUBLIC_SNAPSHOT;

export const OH_LOCKED = {
  nursingFacilities: 923,
  rcf: 812,
  cmsNursingHomes: 922,
  cmsHomeHealth: 835,
  cmsHospice: 169,
  exactCmsNhBridges: 0,
} as const;

export type OhCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "OPEN_SEARCH_ONLY"
  | "INTAKE_AVAILABLE / BULK_NOT_PUBLIC"
  | "SOURCE_NOT_ACQUIRED";

export interface OhTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: OhCoverageState;
  caveat: string;
}

export function ohTraceMetrics(snapshot: OhPublicSnapshot = OH_PUBLIC_SNAPSHOT): OhTraceMetric[] {
  return [
    {
      id: "odh-nh",
      label: "ODH nursing facility licenses",
      display: snapshot.nursingHomes.OH_NURSING_FACILITY_ROWS.toLocaleString("en-US"),
      value: snapshot.nursingHomes.OH_NURSING_FACILITY_ROWS,
      source: snapshot.nursingHomes.source,
      sourceDate: snapshot.nursingHomes.sourceAsOf,
      sourceGrain: "ODH OneSource f_licenseno (OH#####) ACTIVE nursing home",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: snapshot.nursingHomes.caveat,
    },
    {
      id: "odh-rcf",
      label: "ODH Residential Care Facility licenses",
      display: snapshot.rcf.OH_RCF_ROWS.toLocaleString("en-US"),
      value: snapshot.rcf.OH_RCF_ROWS,
      source: snapshot.rcf.source,
      sourceDate: snapshot.rcf.sourceAsOf,
      sourceGrain: "ODH OneSource f_licenseno (OHL#####) ACTIVE L1 RESIDENTIAL CARE",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: snapshot.rcf.caveat,
    },
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Ohio",
      display: snapshot.cmsOverlay.CMS_OH_NURSING_HOME_ROWS.toLocaleString("en-US"),
      value: snapshot.cmsOverlay.CMS_OH_NURSING_HOME_ROWS,
      source: snapshot.regulatorMap.cmsCareCompare,
      sourceDate: snapshot.clocks.cms_sourceAsOf,
      sourceGrain: "CMS Nursing Home CCN with state = OH",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "CMS certification is not an ODH nursing-home license. 922 vs 923 is not an identity bridge.",
    },
  ];
}

export function assertOhIntelligence(
  value: OhPublicSnapshot = OH_PUBLIC_SNAPSHOT,
): OhPublicSnapshot {
  if (value.version !== OH_INTEL_VERSION)
    throw new Error(`Unexpected OH contract ${value.version}`);
  if (value.fingerprint !== OH_PUBLIC_FINGERPRINT) throw new Error("OH fingerprint drifted");
  if (value.publicationPath !== OH_PUBLIC_PATH) throw new Error("path must be /ohio");
  if (value.nursingHomes.OH_NURSING_FACILITY_ROWS !== OH_LOCKED.nursingFacilities) {
    throw new Error("NH drifted");
  }
  if (value.rcf.OH_RCF_ROWS !== OH_LOCKED.rcf) throw new Error("RCF drifted");
  if (Number(value.nursingHomes.OH_NURSING_FACILITY_ROWS) === Number(value.rcf.OH_RCF_ROWS)) {
    throw new Error("Nursing Home must not equal RCF");
  }
  if (value.cmsOverlay.CMS_OH_NURSING_HOME_ROWS !== OH_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay drifted");
  }
  if (value.crosswalk.EXACT_OH_STATE_TO_CMS_NURSING_HOME_BRIDGES !== 0) {
    throw new Error("no CCN in OneSource means zero exact CMS bridges");
  }
  if (value.nursingHomes.OH_NURSING_FACILITY_DISTINCT_CCNS !== null) {
    throw new Error("CCN census must stay null without a CCN field");
  }
  if (value.homeHealth.OH_SKILLED_HOME_HEALTH_AGENCY_ROWS !== null) {
    throw new Error("Home Health bulk must stay search-only");
  }
  if (value.navigator.not_trusthub_rating !== true) {
    throw new Error("Navigator is not a TrustHub rating");
  }
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("graph writes must stay 0");
  if (value.claimEligibilityBroadened) throw new Error("claim eligibility must stay false");
  if (value.localWorkNeededNow !== "NO") throw new Error("local work must stay NO");
  if (value.no_cleveland_page !== true || value.no_columbus_page !== true) {
    throw new Error("no local Ohio pages");
  }
  if (value.cmsOverlay.nursingHomes !== OH_LOCKED.cmsNursingHomes) {
    throw new Error("CMS overlay alias drifted");
  }
  if (
    value.adverse_publication.WITHHELD_REASON_COUNTS
      .do_not_sum_inspection_complaint_deficiency_enforcement !== true
  ) {
    throw new Error("adverse grains must stay unsummed");
  }
  return value;
}
