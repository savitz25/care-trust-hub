import { CO_PUBLIC_SNAPSHOT } from "./co-public-snapshot";

export { CO_PUBLIC_SNAPSHOT };

export const CO_INTEL_VERSION = "senior-co-state-intel-v1" as const;
export const CO_PUBLIC_FINGERPRINT =
  "5f56bc927c981a15293f941cb794a317e3b2182100c1e7167dd7a78c0f57b9e3";
export const CO_PUBLIC_PATH = "/colorado";

export type CoPublicSnapshot = typeof CO_PUBLIC_SNAPSHOT;

export type CoCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "OPEN_SEARCH_ONLY"
  | "NO_BULK_ACQUIRED"
  | "PUBLIC_RESEARCH_PATH"
  | "HISTORICAL_STALE"
  | "INTERNAL_ONLY";

export interface CoSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  rows: number | null;
  asOf: string | null;
  grain: string;
  identityKey: string;
  access: string;
  publication: string;
  coverage: CoCoverageState;
  limitations: string;
}

export interface CoTraceMetric {
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
  coverageState: CoCoverageState;
  caveat: string;
}

export const CO_LOCKED = {
  cmsNursingHomes: 210,
  cmsHomeHealth: 222,
  cmsHospice: 88,
  alrCount: null,
  hcaCount: null,
  nhaCount: null,
  cdpheUniverse: null,
  pressAlrRejected: 675,
  netNewCanonical: 0,
  netNewStateIdentities: 0,
  overlayAsOf: "2026-08-27",
  snapshotAsOf: "2026-09-09",
  gis2017Clock: "January 2017",
} as const;

export const CO_SOURCE_CATALOG: CoSourceCatalogRow[] = [
  {
    id: "cms-nh",
    source: "CMS Nursing Home Provider Information (CO overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CO_LOCKED.cmsNursingHomes,
    asOf: CO_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN in Colorado geography",
    identityKey: "CMS CCN",
    access: "Accepted national geography partition / Provider Data Catalog",
    publication: "Existing national CCN routes only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Not summed with Assisted Living Residences or Home Care Agencies. CMS CERTIFIED != STATE LICENSED. Not added again to national CMS totals.",
  },
  {
    id: "cms-hha",
    source: "CMS Home Health Care Agencies (CO overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CO_LOCKED.cmsHomeHealth,
    asOf: CO_PUBLIC_SNAPSHOT.cmsOverlay.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
    grain: "CMS Home Health CCN; office is not a service area",
    identityKey: "CMS Home Health CCN",
    access: "Accepted national geography partition / Provider Data Catalog",
    publication: "Existing national Home Health CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "HOME HEALTH != HCA. Do not infer a CDPHE Home Care Agency license solely from CMS. Office geography is not a service area.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (CO overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CO_LOCKED.cmsHospice,
    asOf: CO_PUBLIC_SNAPSHOT.cmsOverlay.clocks.hospice.sourceModifiedAt.slice(0, 10),
    grain: "CMS Hospice CCN",
    identityKey: "CMS Hospice CCN",
    access: "Accepted national geography partition / Provider Data Catalog",
    publication: "Existing national Hospice CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HOSPICE != HOME HEALTH. Do not infer a state hospice license solely from CMS.",
  },
  {
    id: "cdphe-find-and-compare",
    source: "CDPHE Find and Compare Facilities",
    agency: "Colorado Department of Public Health and Environment / HFEMSD",
    rows: null,
    asOf: null,
    grain: "interactive inspection / occurrence search (last 3 years)",
    identityKey: "CDPHE facility identity on a looked-up record",
    access: "OPEN_SEARCH_ONLY; scrape forbidden",
    publication: "Verification links only; no invented CDPHE roster count",
    coverage: "OPEN_SEARCH_ONLY",
    limitations:
      "SEARCH RESULT != COMPLETE BULK UNIVERSE. Search-only is not zero. A search result is not claim eligibility.",
  },
  {
    id: "cdphe-alr",
    source: "Assisted Living Residences (6 CCR 1011-1 Chapter 7)",
    agency: "Colorado Department of Public Health and Environment",
    rows: null,
    asOf: null,
    grain: "licensed Assisted Living Residence (no current bulk acquired)",
    identityKey: "CDPHE ALR license when a future bulk file publishes one",
    access: "Official class page + Find and Compare search",
    publication: "Class structure and verify path only; no state-only ALR profiles without safe identity",
    coverage: "NO_BULK_ACQUIRED",
    limitations: "ALR != Nursing Home. Approximate press counts are not network metrics.",
  },
  {
    id: "cdphe-hca",
    source: "Home Care Agencies Class A / Class B (6 CCR 1011-1 Chapter 26)",
    agency: "Colorado Department of Public Health and Environment",
    rows: null,
    asOf: null,
    grain: "licensed Home Care Agency (no current bulk acquired)",
    identityKey: "CDPHE HCA license when a future bulk file publishes one",
    access: "Official class page + Find and Compare search",
    publication: "Class structure and verify path only",
    coverage: "NO_BULK_ACQUIRED",
    limitations: "HCA != CMS Home Health. HCPA != HCA. Class A != Class B.",
  },
  {
    id: "stale-gis-2017",
    source: "CDPHE Health Facilities GIS (98pp-s4r4)",
    agency: "Colorado Department of Public Health and Environment",
    rows: null,
    asOf: CO_LOCKED.gis2017Clock,
    grain: "January 2017 address-derived point",
    identityKey: "historical GIS feature — not a current identity",
    access: "Colorado Information Marketplace metadata",
    publication: "EXCLUDED_FROM_CURRENT_IDENTITY",
    coverage: "HISTORICAL_STALE",
    limitations: "Cannot be promoted to a current roster. Cannot be used as current identity.",
  },
  {
    id: "complaints",
    source: "CDPHE health facilities complaint contacts",
    agency: "Colorado Department of Public Health and Environment / HFEMSD",
    rows: null,
    asOf: null,
    grain: "public complaint-intake process",
    identityKey: "complaint intake, not a dataset row",
    access: "PUBLIC_RESEARCH_PATH",
    publication: "Process links only",
    coverage: "PUBLIC_RESEARCH_PATH",
    limitations: "Complaint process != complaint dataset. Complaint != violation. Bulk not acquired.",
  },
  {
    id: "dora-nha",
    source: "DORA Nursing Home Administrator license lookup",
    agency: "Colorado Department of Regulatory Agencies",
    rows: null,
    asOf: null,
    grain: "person license",
    identityKey: "DORA professional license number",
    access: "PUBLIC_RESEARCH_PATH",
    publication: "No person pages",
    coverage: "PUBLIC_RESEARCH_PATH",
    limitations: "NHA != facility. Not a facility count. No automatic person pages.",
  },
  {
    id: "cms-inspection",
    source: "CMS Nursing Home inspection / deficiency / penalty files",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CO_LOCKED.cmsNursingHomes,
    asOf: CO_PUBLIC_SNAPSHOT.cmsOverlay.clocks.penalties.sourceModifiedAt.slice(0, 10),
    grain: "existing national CMS Nursing Home CCN inspection architecture",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub federal inspection/enforcement product",
    publication: "CMS Nursing Home class profiles; no Colorado ranking",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Inspection != deficiency != enforcement. Staffing != quality. CMS stars != TrustHub rating. Home Health and Hospice have no CMS national inspection/enforcement file on this hub.",
  },
  {
    id: "cms-ownership",
    source: "CMS Skilled Nursing Facility All Owners / ownership graph",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CO_LOCKED.cmsNursingHomes,
    asOf: CO_PUBLIC_SNAPSHOT.cmsOverlay.clocks.ownership.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN ownership edges",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub CMS ownership product",
    publication: "Existing ownership routes on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Do not infer ownership for state-only facilities by name.",
  },
];

export function coTraceMetrics(snapshot: CoPublicSnapshot = CO_PUBLIC_SNAPSHOT): CoTraceMetric[] {
  const cms = snapshot.cmsOverlay;
  return [
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in Colorado (overlay)",
      display: CO_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = CO",
      numerator: cms.nursingHomes,
      denominator: cms.nursingHomes,
      computation:
        "Canonical national CMS Nursing Home directory identities in Colorado from accepted senior-national-intelligence.json geography. Not added again to national totals.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not summed with Assisted Living Residences. CMS CERTIFIED != STATE LICENSED.",
    },
    {
      id: "cms-hha-overlay",
      label: "CMS Home Health Agencies in Colorado (overlay)",
      display: CO_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: cms.homeHealth,
      source: cms.clocks.homeHealth.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Home Health CCN with state = CO",
      numerator: cms.homeHealth,
      denominator: cms.homeHealth,
      computation: "Canonical national CMS Home Health directory identities in Colorado.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not a Home Care Agency count. Office geography is not a service area.",
    },
    {
      id: "cms-hospice-overlay",
      label: "CMS Hospice providers in Colorado (overlay)",
      display: CO_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: cms.hospice,
      source: cms.clocks.hospice.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.hospice.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Hospice CCN with state = CO",
      numerator: cms.hospice,
      denominator: cms.hospice,
      computation: "Canonical national CMS Hospice directory identities in Colorado.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "HOSPICE != HOME HEALTH.",
    },
    {
      id: "cdphe-universe",
      label: "Current CDPHE licensed-facility universe",
      display: "Unknown / search-only",
      value: null,
      source: snapshot.cdpheVerification.url,
      sourceDate: null,
      sourceGrain: "interactive search result",
      numerator: null,
      denominator: null,
      computation:
        "No current official bulk CDPHE roster was acquired. Find and Compare remains the live verification path.",
      coverageState: "OPEN_SEARCH_ONLY",
      caveat: "Search-only is not zero. A search result is not the complete universe.",
    },
    {
      id: "alr-count",
      label: "Assisted Living Residences (current bulk)",
      display: "Unknown / no bulk acquired",
      value: null,
      source: snapshot.assistedLiving.verifyPath,
      sourceDate: null,
      sourceGrain: "licensed ALR (not acquired)",
      numerator: null,
      denominator: null,
      computation: "No current ALR roster count is published. Press approximations are rejected.",
      coverageState: "NO_BULK_ACQUIRED",
      caveat: "ALR != Nursing Home. Approximate assisted-living press counts are not network metrics.",
    },
    {
      id: "net-new-canonical",
      label: "Net-new canonical organizations",
      display: CO_LOCKED.netNewCanonical.toLocaleString("en-US"),
      value: snapshot.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS,
      source: "expansion ledger vs pre-ingest CMS Colorado graph",
      sourceDate: snapshot.asOf,
      sourceGrain: "canonical organization",
      numerator: 0,
      denominator: 0,
      computation:
        "CMS Colorado CCNs already in the national graph are not new organizations. No current CDPHE bulk identities were minted.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "State verification path is not a directory build.",
    },
  ];
}

export function assertCoIntelligence(
  value: CoPublicSnapshot = CO_PUBLIC_SNAPSHOT,
): CoPublicSnapshot {
  if (value.version !== CO_INTEL_VERSION) {
    throw new Error(`Unexpected Colorado contract ${value.version}`);
  }
  if (value.fingerprint !== CO_PUBLIC_FINGERPRINT) {
    throw new Error("Colorado public snapshot fingerprint drifted");
  }
  if (value.cmsOverlay.nursingHomes !== CO_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay drifted");
  }
  if (value.cmsOverlay.homeHealth !== CO_LOCKED.cmsHomeHealth) {
    throw new Error("CMS HHA overlay drifted");
  }
  if (value.cmsOverlay.hospice !== CO_LOCKED.cmsHospice) {
    throw new Error("CMS Hospice overlay drifted");
  }
  if (value.cmsOverlay.liveDirectoryCoUniqueCcn.nursingHomes !== CO_LOCKED.cmsNursingHomes) {
    throw new Error("Live CMS NH Colorado CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryCoUniqueCcn.homeHealth !== CO_LOCKED.cmsHomeHealth) {
    throw new Error("Live CMS HHA Colorado CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryCoUniqueCcn.hospice !== CO_LOCKED.cmsHospice) {
    throw new Error("Live CMS Hospice Colorado CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.addedToNationalTotals !== false) {
    throw new Error("Colorado CMS partitions must not be added again to national totals");
  }
  if (value.assistedLiving.count !== null) {
    throw new Error("ALR bulk count must stay unknown");
  }
  if (value.assistedLiving.pressCountUsed !== false) {
    throw new Error("Assisted-living press counts must not be used as network metrics");
  }
  if (value.cdpheVerification.coverage !== "OPEN_SEARCH_ONLY") {
    throw new Error("CDPHE live verification must stay search/path");
  }
  if (value.cdpheVerification.searchOnlyIsNotZero !== true) {
    throw new Error("Search-only must not be treated as zero");
  }
  if (value.staleGis2017.cannotPromoteToCurrentIdentity !== true) {
    throw new Error("2017 GIS must not be promoted to current identity");
  }
  if (value.staleGis2017.cannotUseAsCurrentRoster !== true) {
    throw new Error("2017 GIS must not be used as a current roster");
  }
  if (value.crosswalk.alrToCmsNh.attempted !== false) {
    throw new Error("ALR must not be joined to CMS Nursing Homes");
  }
  if (value.crosswalk.cmsCcnPreserved !== true) {
    throw new Error("CMS CCN must be preserved");
  }
  if (value.nursingHomeAdministrator.grain !== "PERSON") {
    throw new Error("NHA must stay person-grain");
  }
  if (value.nursingHomeAdministrator.notAFacilityCount !== true) {
    throw new Error("NHA must not be treated as a facility count");
  }
  if (value.inspections.citationIsNotPenalty !== true) {
    throw new Error("Citation must not be treated as a penalty");
  }
  if (value.inspections.occurrenceIsNotViolation !== true) {
    throw new Error("Occurrence must not be treated as a violation");
  }
  if (value.complaints.complaintProcessIsNotComplaintDataset !== true) {
    throw new Error("Complaint process must not be treated as a complaint dataset");
  }
  if (value.inspections.nameOnlyAdverseAttach !== "UNSAFE") {
    throw new Error("Name-only adverse attachment must stay unsafe");
  }
  if (value.claimEligibility.broadened !== false) {
    throw new Error("CO-SEN-001 must not broaden claim eligibility");
  }
  if (value.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) {
    throw new Error("Do not claim CMS overlays as net-new canonical organizations");
  }
  if (value.noCombinedDenominator !== true) {
    throw new Error("Combined Colorado senior-provider denominator is forbidden");
  }
  if (value.noTrustScore !== true || value.noRanking !== true || value.noAggregateRating !== true) {
    throw new Error("Colorado page must not publish a Trust Score, ranking, or AggregateRating");
  }
  if (value.publicationPath !== CO_PUBLIC_PATH) {
    throw new Error("Colorado publication path must be /colorado");
  }
  if (
    value.noCountyRoutes !== true ||
    value.noCityRoutes !== true ||
    value.noDenverPage !== true ||
    value.statewideOnly !== true
  ) {
    throw new Error("Colorado local routes are forbidden");
  }
  return value;
}
