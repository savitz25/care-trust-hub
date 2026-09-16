import { OR_PUBLIC_SNAPSHOT } from "./or-public-snapshot";

export { OR_PUBLIC_SNAPSHOT };

export const OR_INTEL_VERSION = "senior-or-state-intel-v1" as const;
export const OR_PUBLIC_FINGERPRINT =
  "1041ed21b2647cb670a0b5056458df04d8272e000a5206bb22030d70d3de0cbc";
export const OR_PUBLIC_PATH = "/oregon";

export type OrPublicSnapshot = typeof OR_PUBLIC_SNAPSHOT;

export const OR_LOCKED = {
  openNf: 128,
  openAlf: 240,
  openRcf: 332,
  openAfh: 1580,
  inspectionRows: 12752,
  inspectionEvents: 12752,
  violationRows: 48153,
  violationMatters: 48153,
  licensingViolations: 28299,
  abuseViolations: 19854,
  actionRows: 1299,
  actionMatters: 1038,
  ohaHha: 66,
  ohaHospice: 74,
  cmsNursingHomes: 128,
  cmsHomeHealth: 51,
  cmsHospice: 66,
  exactStateToCmsBridges: 0,
} as const;

export type OrCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "OPEN_SEARCH_ONLY"
  | "SOURCE_NOT_ACQUIRED";

export interface OrTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: OrCoverageState;
  caveat: string;
}

export function orTraceMetrics(snapshot: OrPublicSnapshot = OR_PUBLIC_SNAPSHOT): OrTraceMetric[] {
  const p = snapshot.odhsProviders;
  return [
    {
      id: "odhs-nf",
      label: "ODHS open Nursing Facilities",
      display: p.OPEN_NF.toLocaleString("en-US"),
      value: p.OPEN_NF,
      source: snapshot.regulatorMap.providers,
      sourceDate: snapshot.clocks.odhs_retrievedAt.slice(0, 10),
      sourceGrain: "ODHS Provider ID where Type=NF and Status=Open",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "State Nursing Facility license identities, not CMS Nursing Home CCNs. Open != closed. Not summed with ALF/RCF/AFH.",
    },
    {
      id: "odhs-alf",
      label: "ODHS open Assisted Living Facilities",
      display: p.OPEN_ALF.toLocaleString("en-US"),
      value: p.OPEN_ALF,
      source: snapshot.regulatorMap.providers,
      sourceDate: snapshot.clocks.odhs_retrievedAt.slice(0, 10),
      sourceGrain: "ODHS Provider ID where Type=ALF and Status=Open",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "ALF != RCF != AFH != NF. Memory care is a service flag, not a separate license class here.",
    },
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Oregon",
      display: snapshot.cmsOverlay.nursingHomes.toLocaleString("en-US"),
      value: snapshot.cmsOverlay.nursingHomes,
      source: snapshot.cmsOverlay.clocks.nursingHomes.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: snapshot.cmsOverlay.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = OR",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "CMS certification is not an ODHS Nursing Facility license. Matching 128 counts is not a CCN bridge.",
    },
  ];
}

export function assertOrIntelligence(
  value: OrPublicSnapshot = OR_PUBLIC_SNAPSHOT,
): OrPublicSnapshot {
  if (value.version !== OR_INTEL_VERSION)
    throw new Error(`Unexpected Oregon contract ${value.version}`);
  if (value.fingerprint !== OR_PUBLIC_FINGERPRINT)
    throw new Error("Oregon public snapshot fingerprint drifted");
  if (value.publicationPath !== OR_PUBLIC_PATH) throw new Error("Oregon path must be /oregon");
  if (value.odhsProviders.OPEN_NF !== OR_LOCKED.openNf) throw new Error("ODHS NF drifted");
  if (value.odhsProviders.OPEN_ALF !== OR_LOCKED.openAlf) throw new Error("ODHS ALF drifted");
  if (value.odhsProviders.OPEN_RCF !== OR_LOCKED.openRcf) throw new Error("ODHS RCF drifted");
  if (value.odhsProviders.OPEN_AFH !== OR_LOCKED.openAfh) throw new Error("ODHS AFH drifted");
  if (Number(value.odhsProviders.OPEN_NF) === Number(value.odhsProviders.OPEN_ALF))
    throw new Error("classes must stay separate");
  if (value.cmsOverlay.nursingHomes !== OR_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH overlay drifted");
  if (value.cmsOverlay.homeHealth !== OR_LOCKED.cmsHomeHealth)
    throw new Error("CMS HHA overlay drifted");
  if (value.cmsOverlay.hospice !== OR_LOCKED.cmsHospice)
    throw new Error("CMS Hospice overlay drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false)
    throw new Error("Do not add OR CMS partitions again");
  if (value.crosswalk.exactStateToCmsBridges !== 0)
    throw new Error("no invented state→CMS bridges");
  if (value.ohaHomeHealth.rows !== OR_LOCKED.ohaHha) throw new Error("OHA HHA drifted");
  if (value.ohaHospice.rows !== OR_LOCKED.ohaHospice) throw new Error("OHA hospice drifted");
  if (Number(value.ohaHomeHealth.rows) === Number(value.cmsOverlay.homeHealth)) {
    throw new Error("OHA HHA must not equal CMS HHA");
  }
  if (value.odhsInspections.INSPECTION_ROWS !== value.odhsInspections.DISTINCT_EVENT_IDS) {
    throw new Error("inspection row must equal event id in this extract");
  }
  if (
    value.odhsViolations.LICENSING_VIOLATION_ROWS +
      value.odhsViolations.ABUSE_SUBSTANTIATED_ROWS !==
    value.odhsViolations.VIOLATION_ROWS
  ) {
    throw new Error("violation type partition must cover all rows");
  }
  if (!value.odhsRegulatoryActions.scope.includes("LICENSE CONDITIONS")) {
    throw new Error("regulatory-action scope limitation missing");
  }
  if (value.odhsRegulatoryActions.UNIQUE_REGULATORY_MATTERS !== OR_LOCKED.actionMatters) {
    throw new Error("action matters drifted");
  }
  if (value.identity.NAME_ONLY_UNSAFE !== 0)
    throw new Error("name-only joins must remain unattempted");
  if (value.adverse_publication.EXACT_PROFILE_ATTACHMENTS !== 0)
    throw new Error("no profile attachments");
  if (value.adverse_publication.PUBLICLY_RENDERED_PROFILES !== 0) {
    throw new Error("statewide aggregates are not facility-profile renders");
  }
  if (value.expansion_ledger.GRAPH_WRITES !== 0) throw new Error("no graph writes");
  if (value.claimEligibilityBroadened !== false) throw new Error("claim eligibility frozen");
  if (value.clocks.odhs_sourceAsOf !== null) throw new Error("do not fake ODHS sourceAsOf");
  return value;
}
