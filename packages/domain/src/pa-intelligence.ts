import { PA_PUBLIC_SNAPSHOT } from "./pa-public-snapshot";

export { PA_PUBLIC_SNAPSHOT };

export const PA_INTEL_VERSION = "senior-pa-state-intel-v1" as const;
export const PA_PUBLIC_FINGERPRINT =
  "460c6865eb7c3fdb040c95768f42e8ef90009fe9f6f80571c3268d5944ae7fed";
export const PA_PUBLIC_PATH = "/pennsylvania";

export type PaPublicSnapshot = typeof PA_PUBLIC_SNAPSHOT;

export const PA_LOCKED = {
  nursingHomeRows: 659,
  nursingHomeStateIds: 659,
  nursingHomeCcns: 647,
  homeHealthRows: 659,
  homeHealthStateIds: 659,
  homeHealthCcns: 403,
  homeCareRows: 4656,
  hospiceRows: 178,
  hospiceCcns: 152,
  pchMonthlyHomes: 995,
  pchMonthlyCapacity: 61906,
  pchMonthlyResidents: 38898,
  lifeProviders: 24,
  lifeCenters: 58,
  sanctionRows: 1539,
  uniqueSanctions: 1533,
  cmsNursingHomes: 656,
  cmsHomeHealth: 415,
  cmsHospice: 179,
  exactBridgesTotal: 1202,
} as const;

export type PaCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "OPEN_SEARCH_ONLY"
  | "SOURCE_NOT_ACQUIRED";

export interface PaTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: PaCoverageState;
  caveat: string;
}

export function paTraceMetrics(snapshot: PaPublicSnapshot = PA_PUBLIC_SNAPSHOT): PaTraceMetric[] {
  return [
    {
      id: "doh-nh",
      label: "DOH nursing-home license rows",
      display: snapshot.nursingHomes.PA_NURSING_HOME_ROWS.toLocaleString("en-US"),
      value: snapshot.nursingHomes.PA_NURSING_HOME_ROWS,
      source: snapshot.regulatorMap.ncfOwner,
      sourceDate: snapshot.clocks.ncf_sourceAsOf,
      sourceGrain: "PA-DOH-NCF:{facilityId} from September 2026 licensure/ownership table",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "State nursing-home license identities, not CMS Nursing Home CCNs. 659 DOH rows matching 659 Home Health rows is coincidence, not a bridge.",
    },
    {
      id: "pch-monthly",
      label: "PCH monthly report homes",
      display: snapshot.pchMonthlyReport.PA_PCH_MONTHLY_REPORT_HOMES.toLocaleString("en-US"),
      value: snapshot.pchMonthlyReport.PA_PCH_MONTHLY_REPORT_HOMES,
      source: snapshot.regulatorMap.pchMonthly,
      sourceDate: snapshot.clocks.pch_monthly_sourcePeriod,
      sourceGrain: "August 2026 statewide PCH monthly report TOTAL homes",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Aggregate from the most recent inspection, which may be up to a year old. Not a current PCH+ALR roster and not facility identities.",
    },
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Pennsylvania",
      display: snapshot.cmsOverlay.nursingHomes.toLocaleString("en-US"),
      value: snapshot.cmsOverlay.nursingHomes,
      source: snapshot.regulatorMap.cmsCareCompare,
      sourceDate: "2026-08-27",
      sourceGrain: "CMS Nursing Home CCN with state = PA",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "CMS certification is not a DOH nursing-home license. 656 CMS vs 659 DOH is not an identity bridge.",
    },
  ];
}

export function assertPaIntelligence(
  value: PaPublicSnapshot = PA_PUBLIC_SNAPSHOT,
): PaPublicSnapshot {
  if (value.version !== PA_INTEL_VERSION)
    throw new Error(`Unexpected PA contract ${value.version}`);
  if (value.fingerprint !== PA_PUBLIC_FINGERPRINT) throw new Error("PA fingerprint drifted");
  if (value.publicationPath !== PA_PUBLIC_PATH) throw new Error("path must be /pennsylvania");
  if (value.nursingHomes.PA_NURSING_HOME_ROWS !== PA_LOCKED.nursingHomeRows) {
    throw new Error("DOH NH drifted");
  }
  if (value.homeHealth.PA_HOME_HEALTH_ROWS !== PA_LOCKED.homeHealthRows) {
    throw new Error("DOH home health drifted");
  }
  if (value.nursingHomes.PA_NURSING_HOME_ROWS === value.homeHealth.PA_HOME_HEALTH_ROWS) {
    if (!value.nursingHomes.matching_659_home_health_is_not_a_bridge) {
      throw new Error("matching 659 counts must stay labeled as coincidence");
    }
  }
  if (value.homeCare.PA_HOME_CARE_ROWS !== PA_LOCKED.homeCareRows)
    throw new Error("home care drifted");
  if (Number(value.homeCare.PA_HOME_CARE_ROWS) === Number(value.homeHealth.PA_HOME_HEALTH_ROWS)) {
    throw new Error("home care must not equal home health");
  }
  if (value.hospice.PA_HOSPICE_ROWS !== PA_LOCKED.hospiceRows) throw new Error("hospice drifted");
  if (value.pchMonthlyReport.PA_PCH_MONTHLY_REPORT_HOMES !== PA_LOCKED.pchMonthlyHomes) {
    throw new Error("PCH monthly drifted");
  }
  if (value.pchRoster.PA_PCH_ROWS !== null) throw new Error("PCH roster must remain search-only");
  if (value.alrRoster.PA_ALR_ROWS !== null) throw new Error("ALR roster must remain search-only");
  if (value.cmsOverlay.nursingHomes !== PA_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH drifted");
  if (value.cmsOverlay.homeHealth !== PA_LOCKED.cmsHomeHealth) throw new Error("CMS HHA drifted");
  if (value.cmsOverlay.hospice !== PA_LOCKED.cmsHospice) throw new Error("CMS hospice drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false) throw new Error("do not add PA CMS again");
  if (value.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES_TOTAL !== PA_LOCKED.exactBridgesTotal) {
    throw new Error("exact bridges drifted");
  }
  if (value.crosswalk.EXACT_PA_STATE_TO_CMS_BRIDGES.home_care !== 0) {
    throw new Error("home-care Medicare ID is not a CMS CCN");
  }
  if (value.identity.NAME_ONLY_UNSAFE !== 0) throw new Error("name-only joins unattempted");
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.claimEligibilityBroadened !== false) throw new Error("claim eligibility frozen");
  if (value.localWorkNeededNow !== "NO") throw new Error("do not start local PA work");
  if (value.clocks.retrievedAt_is_not_sourceAsOf !== true) {
    throw new Error("retrievedAt is not sourceAsOf");
  }
  return value;
}
