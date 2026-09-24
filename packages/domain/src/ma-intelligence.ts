import { MA_PUBLIC_SNAPSHOT } from "./ma-public-snapshot";

export { MA_PUBLIC_SNAPSHOT };

export const MA_INTEL_VERSION = "senior-ma-state-intel-v1" as const;
export const MA_PUBLIC_FINGERPRINT =
  "b8cb397f6bb0ecdb9f58a09ff7e6a7ce720d7a37c1906cf16e68deac39586ccf";
export const MA_PUBLIC_PATH = "/massachusetts";

export type MaPublicSnapshot = typeof MA_PUBLIC_SNAPSHOT;

export const MA_LOCKED = {
  dphNursingHomes: 347,
  dphRestHomes: 58,
  dphHomeHealth: 325,
  dphHospice: 93,
  dphAdultDayHealth: 162,
  ageAssistedLivingResidences: 272,
  cmsNursingHomes: 341,
  cmsHomeHealth: 287,
  cmsHospice: 77,
  exactCmsBridges: 0,
} as const;

export type MaCapabilityState =
  | "KNOWN"
  | "UNKNOWN"
  | "PARTIAL"
  | "NOT_ACQUIRED"
  | "REQUEST_ONLY"
  | "UNSUPPORTED";

export interface MaTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  coverageState: MaCapabilityState;
  caveat: string;
}

export function maTraceMetrics(snapshot: MaPublicSnapshot = MA_PUBLIC_SNAPSHOT): MaTraceMetric[] {
  const dph = snapshot.dphWorkbook;
  const cms = snapshot.cmsOverlay;
  const row = (
    id: string,
    label: string,
    value: number,
    sourceGrain: string,
    caveat: string,
  ): MaTraceMetric => ({
    id,
    label,
    display: value.toLocaleString("en-US"),
    value,
    source: dph.source,
    sourceDate: dph.sourceAsOf,
    sourceGrain,
    coverageState: "KNOWN",
    caveat,
  });
  return [
    row(
      "dph-nh",
      "DPH Nursing Home rows",
      snapshot.nursingHomes.rows,
      "DPH facility ID, type = Nursing Home",
      "A DPH nursing-home license row is not a CMS CCN. Not a Rest Home.",
    ),
    row(
      "dph-rest",
      "DPH Rest Home rows",
      snapshot.restHomes.rows,
      "DPH facility ID, type = Rest Home",
      "A Rest Home is not a Nursing Home and not an Assisted Living Residence.",
    ),
    row(
      "dph-hha",
      "DPH Certified Home Health Agency rows",
      snapshot.homeHealth.rows,
      "DPH facility ID, type = Certified Home Health Agency",
      "The DPH row is not a CMS Home Health CCN.",
    ),
    row(
      "dph-hospice",
      "DPH Hospice rows",
      snapshot.hospice.rows,
      "DPH facility ID, type = Hospice",
      "The DPH row is not a CMS Hospice CCN. Inpatient satellites are counted separately.",
    ),
    {
      id: "age-alr",
      label: "AGE certified Assisted Living Residences",
      display: snapshot.assistedLiving.rows.toLocaleString("en-US"),
      value: snapshot.assistedLiving.rows,
      source: snapshot.assistedLiving.source,
      sourceDate: snapshot.assistedLiving.sourceAsOf,
      sourceGrain: "Residence row on the AGE certified ALR list",
      coverageState: "KNOWN",
      caveat:
        "ALR certification by AGE is not a DPH license and not CMS certification. The live directory showed 273 results.",
    },
    {
      id: "cms-nh",
      label: "CMS Nursing Homes in Massachusetts",
      display: cms.nursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl,
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = MA",
      coverageState: "KNOWN",
      caveat:
        "CMS certification is not a DPH license. The two counts are not added and not bridged.",
    },
  ];
}

export function assertMaIntelligence(
  value: MaPublicSnapshot = MA_PUBLIC_SNAPSHOT,
): MaPublicSnapshot {
  if (value.version !== MA_INTEL_VERSION)
    throw new Error(`Unexpected MA contract ${value.version}`);
  if (value.fingerprint !== MA_PUBLIC_FINGERPRINT) throw new Error("MA fingerprint drifted");
  if (value.publicationPath !== MA_PUBLIC_PATH) throw new Error("path must be /massachusetts");
  if (value.nursingHomes.rows !== MA_LOCKED.dphNursingHomes) throw new Error("DPH NH drifted");
  if (value.restHomes.rows !== MA_LOCKED.dphRestHomes) throw new Error("DPH Rest Home drifted");
  if (value.homeHealth.rows !== MA_LOCKED.dphHomeHealth) throw new Error("DPH HHA drifted");
  if (value.hospice.rows !== MA_LOCKED.dphHospice) throw new Error("DPH Hospice drifted");
  if (value.adultDayHealth.rows !== MA_LOCKED.dphAdultDayHealth) throw new Error("DPH ADH drifted");
  if (value.assistedLiving.rows !== MA_LOCKED.ageAssistedLivingResidences)
    throw new Error("ALR drifted");
  if (Number(value.restHomes.rows) === Number(value.nursingHomes.rows)) {
    throw new Error("Rest Home must not equal Nursing Home");
  }
  if (
    value.restHomes.distinctFromNursingHome !== true ||
    value.restHomes.distinctFromAssistedLiving !== true
  ) {
    throw new Error("Rest Home must stay its own class");
  }
  if (
    value.assistedLiving.distinctFromRestHome !== true ||
    value.assistedLiving.distinctFromNursingHome !== true
  ) {
    throw new Error("ALR must stay its own class");
  }
  if (value.hospiceInpatientSatellites.notAddedToHospiceRows !== true) {
    throw new Error("inpatient satellites are not added to hospice rows");
  }
  if (value.cmsOverlay.nursingHomes !== MA_LOCKED.cmsNursingHomes)
    throw new Error("CMS NH drifted");
  if (value.cmsOverlay.homeHealth !== MA_LOCKED.cmsHomeHealth) throw new Error("CMS HHA drifted");
  if (value.cmsOverlay.hospice !== MA_LOCKED.cmsHospice) throw new Error("CMS Hospice drifted");
  if (value.cmsOverlay.addedToNationalTotals !== false) throw new Error("do not re-add CMS totals");
  if (value.crosswalk.exactStateToCmsBridges !== MA_LOCKED.exactCmsBridges) {
    throw new Error("no CCN in the DPH workbook means zero exact bridges");
  }
  if (value.crosswalk.ccnInDphWorkbook !== false) throw new Error("DPH workbook carries no CCN");
  if (value.crosswalk.nameOnly !== "UNSAFE") throw new Error("name-only joins stay unsafe");
  if (value.surveyTool.notTrustHubScore !== true)
    throw new Error("DPH survey tool is not a TrustHub score");
  if (value.surveyTool.indexedFacilityResults !== null)
    throw new Error("survey results were not indexed");
  if (value.complaints.providerLevelRows !== null)
    throw new Error("complaint rows were not acquired");
  if (value.complaints.capability !== "REQUEST_ONLY")
    throw new Error("complaints stay request-only");
  if (value.alrCensus2026.usedAsIdentitySource !== false)
    throw new Error("census report is context only");
  if (value.massgis.capability !== "UNSUPPORTED")
    throw new Error("MassGIS is not a current roster");
  if (value.expansionLedger.GRAPH_WRITES !== 0) throw new Error("graph writes must stay 0");
  if (value.expansionLedger.NET_NEW_CANONICAL_FACILITIES !== 0)
    throw new Error("no new canonical facilities");
  if (value.claimEligibilityBroadened) throw new Error("claim eligibility must stay false");
  if (value.no_boston_page !== true) throw new Error("no Boston page");
  if (value.clocks.retrievedAt_is_not_sourceAsOf !== true)
    throw new Error("retrieval is not a source date");
  if (
    value.clocks.license_effective_date !== null ||
    value.clocks.license_expiration_date !== null
  ) {
    throw new Error("the DPH workbook publishes no license dates");
  }
  const allowed = new Set([
    "KNOWN",
    "UNKNOWN",
    "PARTIAL",
    "NOT_ACQUIRED",
    "REQUEST_ONLY",
    "UNSUPPORTED",
  ]);
  if (value.capabilities.some((row) => !allowed.has(row.state))) {
    throw new Error("capability state outside the allowed set");
  }
  if (
    value.capabilities.find((row) => row.id === "combined-massachusetts-senior-facilities")
      ?.state !== "UNSUPPORTED"
  ) {
    throw new Error("combined senior-facility total is unsupported");
  }
  return value;
}
