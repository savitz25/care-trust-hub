import { NY_PUBLIC_SNAPSHOT } from "./ny-public-snapshot";

export { NY_PUBLIC_SNAPSHOT };

export const NY_INTEL_VERSION = "senior-ny-state-intel-v1" as const;
export const NY_PUBLIC_FINGERPRINT =
  "0ba069ebbd93faeb3274f3849a34703be2a9ce6fa66289468d6a2dfa5c73af54";
export const NY_PUBLIC_PATH = "/new-york";

export type NyPublicSnapshot = typeof NY_PUBLIC_SNAPSHOT;

export type NyCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "OPEN_SEARCH_ONLY"
  | "SOURCE_NOT_ACQUIRED"
  | "PUBLIC_RESEARCH_PATH";

export const NY_LOCKED = {
  acfFacilities: 527,
  adultHomes: 381,
  enrichedHousing: 146,
  nhFacilities: 597,
  nhDistinctCcn: 594,
  nhSurveys: 6036,
  nhCitations: 19032,
  nhEnforcementRows: 2036,
  dnrObservations: 117,
  dnrExactOpcert: 6,
  cmsNursingHomes: 593,
  cmsHomeHealth: 100,
  cmsHospice: 39,
  lhcsaFacilities: 1258,
  chhaFacilities: 97,
  alr: 271,
  ealr: 220,
  snalr: 203,
  alpResidential: 162,
  netNewCanonical: 0,
  netNewProfiles: 0,
  overlayAsOf: "2026-08-27",
  snapshotAsOf: "2026-09-11",
} as const;

export interface NyTraceMetric {
  id: string;
  label: string;
  display: string;
  value: number | null;
  source: string;
  sourceDate: string | null;
  sourceGrain: string;
  numerator: number | null;
  denominator: number | null;
  computation: string;
  coverageState: NyCoverageState;
  caveat: string;
}

export function nyTraceMetrics(snapshot: NyPublicSnapshot = NY_PUBLIC_SNAPSHOT): NyTraceMetric[] {
  return [
    {
      id: "acf-count",
      label: "Adult Care Facility identities",
      display: NY_LOCKED.acfFacilities.toLocaleString("en-US"),
      value: NY_LOCKED.acfFacilities,
      source: "Health Facility General Information (AH + EHP)",
      sourceDate: snapshot.acf.sourceAsOf,
      sourceGrain: "NYSDOH Facility ID with operating certificate; Adult Home or Enriched Housing",
      numerator: NY_LOCKED.acfFacilities,
      denominator: NY_LOCKED.acfFacilities,
      computation: "381 Adult Homes + 146 Enriched Housing Programs; overlap 0; 527 distinct operating certificates.",
      coverageState: "PARTIAL_SOURCE_COVERAGE",
      caveat: "Not nursing homes. Not a sum of ALR/EALR/SNALR/ALP designations. Currentness is partial — no source ACTIVE flag.",
    },
    {
      id: "nh-count",
      label: "NYSDOH Nursing Home Profile facilities",
      display: NY_LOCKED.nhFacilities.toLocaleString("en-US"),
      value: NY_LOCKED.nhFacilities,
      source: "Nursing Home Profile Facility_Info.csv",
      sourceDate: snapshot.nursingHomeProfile.sourceAsOf,
      sourceGrain: "one Facility_Info row = one FACILITY_ID",
      numerator: NY_LOCKED.nhFacilities,
      denominator: NY_LOCKED.nhFacilities,
      computation: "Count Facility_Info rows (FACILITY_ID unique). Distinct source-native MEDICARE_NUMBER = 594.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not the CMS directory count (593). Not Adult Care Facilities. Inspection count is a different grain.",
    },
    {
      id: "nh-surveys",
      label: "Nursing-home survey observations",
      display: NY_LOCKED.nhSurveys.toLocaleString("en-US"),
      value: NY_LOCKED.nhSurveys,
      source: "Nursing Home Profile Surveys.csv",
      sourceDate: snapshot.nursingHomeProfile.sourceAsOf,
      sourceGrain: "one Surveys.csv row = one survey observation",
      numerator: NY_LOCKED.nhSurveys,
      denominator: NY_LOCKED.nhFacilities,
      computation: "Count Surveys.csv rows covering all 597 Facility IDs. Types include COMPLAINT, CERTIFICATION/COMPLAINT, COVID19, CERTIFICATION.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Survey observation is not a deficiency count and is not a quality score.",
    },
    {
      id: "dnr-count",
      label: "Do Not Refer observations",
      display: NY_LOCKED.dnrObservations.toLocaleString("en-US"),
      value: NY_LOCKED.dnrObservations,
      source: "NYSDOH Adult Care Facility Do Not Refer List PDF",
      sourceDate: snapshot.doNotRefer.sourceAsOf,
      sourceGrain: "one Facility Name block = one observation",
      numerator: NY_LOCKED.dnrObservations,
      denominator: NY_LOCKED.acfFacilities,
      computation: "Count Facility Name blocks in the 2026-09-10 PDF. Exact current GI operating-certificate matches = 6. Name-only remainder not attached.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Do Not Refer is not a criminal conviction, not a TrustHub blacklist, and not every enforcement action.",
    },
    {
      id: "cms-hha",
      label: "CMS Home Health Agencies in New York",
      display: NY_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: NY_LOCKED.cmsHomeHealth,
      source: "CMS Home Health Care Agencies NY overlay",
      sourceDate: NY_LOCKED.overlayAsOf,
      sourceGrain: "CMS Home Health CCN",
      numerator: NY_LOCKED.cmsHomeHealth,
      denominator: NY_LOCKED.cmsHomeHealth,
      computation: "Accepted national geography partition for NY.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "CMS HHA is not LHCSA. State CHHA Facility IDs (97) are a different class.",
    },
    {
      id: "cms-hospice",
      label: "CMS Hospice providers in New York",
      display: NY_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: NY_LOCKED.cmsHospice,
      source: "CMS Hospice General Information NY overlay",
      sourceDate: NY_LOCKED.overlayAsOf,
      sourceGrain: "CMS Hospice CCN",
      numerator: NY_LOCKED.cmsHospice,
      denominator: NY_LOCKED.cmsHospice,
      computation: "Accepted national geography partition for NY.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Hospice is not Home Health. State HSPC Facility IDs (39) were not name-matched to CMS.",
    },
  ];
}

export function assertNyIntelligence(
  value: NyPublicSnapshot = NY_PUBLIC_SNAPSHOT,
): NyPublicSnapshot {
  if (value.version !== NY_INTEL_VERSION) throw new Error("New York snapshot version mismatch");
  if (value.fingerprint !== NY_PUBLIC_FINGERPRINT) throw new Error("New York snapshot fingerprint mismatch");
  if (value.acf.acfFacilities !== NY_LOCKED.acfFacilities) throw new Error("ACF count mismatch");
  if (value.nursingHomeProfile.sourceRows !== NY_LOCKED.nhFacilities) throw new Error("NH count mismatch");
  if (value.nursingHomeProfile.distinctCcn !== NY_LOCKED.nhDistinctCcn) throw new Error("NH CCN mismatch");
  if (value.doNotRefer.observationCount !== NY_LOCKED.dnrObservations) throw new Error("DNR count mismatch");
  if (value.cmsOverlay.nursingHomes !== NY_LOCKED.cmsNursingHomes) throw new Error("CMS NH overlay mismatch");
  if (value.cmsOverlay.homeHealth !== NY_LOCKED.cmsHomeHealth) throw new Error("CMS HHA overlay mismatch");
  if (value.cmsOverlay.hospice !== NY_LOCKED.cmsHospice) throw new Error("CMS Hospice overlay mismatch");
  if (value.acf.adultHomeIsNotEnrichedHousing !== true) throw new Error("AH must stay distinct from EHP");
  if (value.assistedLivingDesignations.alpIsNotAlr !== true) throw new Error("ALP must stay distinct from ALR");
  if (value.assistedLivingDesignations.doNotSumAsAssistedLivingFacilities !== true) {
    throw new Error("Do not sum assisted-living designations");
  }
  if (value.homeCare.lhcsaIsNotCmsHha !== true) throw new Error("LHCSA must stay distinct from CMS HHA");
  if (value.doNotRefer.nameOnlyJoins !== "UNSAFE") throw new Error("Name-only DNR joins must stay unsafe");
  if (value.doNotRefer.exactProfileAttachments !== 0) throw new Error("Do not attach DNR rows to profiles");
  if (value.expansionLedger.NET_NEW_CANONICAL_FACILITIES !== 0) throw new Error("Do not mint canonical facilities");
  if (value.expansionLedger.NET_NEW_PUBLIC_PROFILES !== 0) throw new Error("Do not mint public profiles");
  if (value.expansionLedger.EXISTING_ORGANIZATIONS_ENRICHED !== 0) throw new Error("No graph enrichment");
  if (value.expansionLedger.NY_ACF_CERTIFIED_CAPACITY !== null) {
    throw new Error("ACF certified capacity must remain UNKNOWN as a unique-facility total");
  }
  if (value.uiGrains.acfFacilities !== "VISIBLE_PUBLIC_METRIC") throw new Error("ACF must be visible");
  if (value.uiGrains.nursingHomeFacilities !== "VISIBLE_PUBLIC_METRIC") throw new Error("NH must be visible");
  if (value.uiGrains.doNotReferObservations !== "VISIBLE_PUBLIC_METRIC") throw new Error("DNR must be visible");
  if (value.noCombinedDenominator !== true) throw new Error("No combined NY senior-provider total");
  if (value.publicationPath !== "/new-york") throw new Error("Route drifted");
  return value;
}
