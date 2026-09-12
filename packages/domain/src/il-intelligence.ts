import { IL_PUBLIC_SNAPSHOT } from "./il-public-snapshot";

export { IL_PUBLIC_SNAPSHOT };

export const IL_INTEL_VERSION = "senior-il-state-intel-v1" as const;
export const IL_PUBLIC_FINGERPRINT =
  "20e48b6f8a24c2f3acb0ea208961a93e5c10a3c858d5f42f81454059dea85bac";
export const IL_PUBLIC_PATH = "/illinois";

export type IlPublicSnapshot = typeof IL_PUBLIC_SNAPSHOT;

export const IL_LOCKED = {
  cmsNursingHomes: 666,
  cmsHomeHealth: 530,
  cmsHospice: 149,
  idphHomeHealth: 595,
  idphHospice: 178,
  idphHomeNursing: 258,
  idphHomeServices: 1029,
  idphHospiceResidence: 10,
  slpSites: 169,
  slpUnits: 13939,
  stateNursingHomeRows: null,
  assistedLivingRows: null,
  exactStateToCmsBridges: 0,
  netNewCanonical: 0,
  snapshotAsOf: "2026-09-12",
} as const;

export type IlCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "OPEN_SEARCH_ONLY"
  | "HISTORICAL_STALE"
  | "SOURCE_NOT_ACQUIRED";

export interface IlTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: IlCoverageState;
  caveat: string;
}

export function ilTraceMetrics(snapshot: IlPublicSnapshot = IL_PUBLIC_SNAPSHOT): IlTraceMetric[] {
  const cms = snapshot.cmsOverlay;
  return [
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Illinois",
      display: IL_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = IL",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "CMS-certified providers, not a current IDPH license census. Not summed with other classes.",
    },
    {
      id: "cms-hha",
      label: "CMS Home Health Agencies in Illinois",
      display: IL_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: cms.homeHealth,
      source: cms.clocks.homeHealth.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Home Health CCN with state = IL",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not an IDPH Home Health license count. Office geography is not a service area.",
    },
    {
      id: "cms-hospice",
      label: "CMS Hospice providers in Illinois",
      display: IL_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: cms.hospice,
      source: cms.clocks.hospice.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.hospice.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Hospice CCN with state = IL",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Hospice != Home Health. CMS certification is not a state hospice license.",
    },
    {
      id: "idph-hha",
      label: "IDPH licensed Home Health Agencies",
      display: IL_LOCKED.idphHomeHealth.toLocaleString("en-US"),
      value: snapshot.idphHomeHealth.rows,
      source: snapshot.regulatorMap.openDataHha,
      sourceDate: snapshot.idphHomeHealth.sourceAsOf,
      sourceGrain: "IDPH Home Health license_number",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "State license != CMS Home Health CCN. No CCN on this roster.",
    },
    {
      id: "idph-hospice",
      label: "IDPH licensed Hospice programs",
      display: IL_LOCKED.idphHospice.toLocaleString("en-US"),
      value: snapshot.idphHospice.rows,
      source: snapshot.regulatorMap.openDataHospice,
      sourceDate: snapshot.idphHospice.sourceAsOf,
      sourceGrain: "IDPH Hospice license_number",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Hospice program != Hospice Residence. State license != CMS Hospice CCN.",
    },
    {
      id: "slp",
      label: "HFS Supportive Living Program operational sites",
      display: IL_LOCKED.slpSites.toLocaleString("en-US"),
      value: snapshot.supportiveLiving.operationalSites,
      source: snapshot.regulatorMap.hfsSlpPdf,
      sourceDate: snapshot.supportiveLiving.sourceAsOf,
      sourceGrain: "HFS operational SLP site (official PDF total)",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Supportive Living != nursing home != assisted living != CMS SNF. Medicaid participation is not a facility license.",
    },
    {
      id: "state-nh",
      label: "Current IDPH nursing-home license census",
      display: "Unknown / search-only",
      value: null,
      source: snapshot.regulatorMap.facilityLookup,
      sourceDate: null,
      sourceGrain: "LLCS facility lookup",
      coverageState: "OPEN_SEARCH_ONLY",
      caveat: "Search-only is not zero. The 2013-era GIS dump is not a current roster.",
    },
  ];
}

export function assertIlIntelligence(
  value: IlPublicSnapshot = IL_PUBLIC_SNAPSHOT,
): IlPublicSnapshot {
  if (value.version !== IL_INTEL_VERSION)
    throw new Error(`Unexpected Illinois contract ${value.version}`);
  if (value.fingerprint !== IL_PUBLIC_FINGERPRINT)
    throw new Error("Illinois public snapshot fingerprint drifted");
  if (value.publicationPath !== IL_PUBLIC_PATH) throw new Error("Illinois path must be /illinois");
  if (value.cmsOverlay.nursingHomes !== IL_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH overlay drifted");
  if (value.cmsOverlay.homeHealth !== IL_LOCKED.cmsHomeHealth)
    throw new Error("CMS HHA overlay drifted");
  if (value.cmsOverlay.hospice !== IL_LOCKED.cmsHospice)
    throw new Error("CMS Hospice overlay drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false)
    throw new Error("Do not add IL CMS partitions again");
  if (value.stateNursingHomes.currentRosterCount != null)
    throw new Error("Do not invent a current NH census");
  if (value.stateNursingHomes.staleGisCannotPromote !== true)
    throw new Error("Stale GIS must not be promoted");
  if (value.idphHomeHealth.rows !== IL_LOCKED.idphHomeHealth) throw new Error("IDPH HHA drifted");
  if (value.idphHospice.rows !== IL_LOCKED.idphHospice) throw new Error("IDPH hospice drifted");
  if (value.idphHomeNursing.rows !== IL_LOCKED.idphHomeNursing)
    throw new Error("IDPH home nursing drifted");
  if (value.idphHomeServices.rows !== IL_LOCKED.idphHomeServices)
    throw new Error("IDPH home services drifted");
  if (value.idphHospiceResidence.rows !== IL_LOCKED.idphHospiceResidence)
    throw new Error("Hospice residence drifted");
  if (value.supportiveLiving.operationalSites !== IL_LOCKED.slpSites)
    throw new Error("SLP sites drifted");
  if (value.assistedLiving.currentRosterCount != null)
    throw new Error("Do not invent current AL count");
  if (value.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0)
    throw new Error("no canonical writes");
  if (value.expansionLedger.EXACT_IL_STATE_TO_CMS_BRIDGES !== 0)
    throw new Error("no invented bridges");
  if (value.claimEligibility.broadened !== false) throw new Error("claim eligibility frozen");
  if (value.noLocalIllinoisRoutes !== true) throw new Error("no local Illinois routes");
  if (!value.noRanking || !value.noTrustScore) throw new Error("no ranking or Trust Score");
  if (value.idphHomeHealth.notCmsHomeHealth !== true) throw new Error("HHA license != CMS HHA");
  if (value.supportiveLiving.notNursingHome !== true) throw new Error("SLP != nursing home");
  return value;
}
