import { AZ_PUBLIC_SNAPSHOT } from "./az-public-snapshot";

export { AZ_PUBLIC_SNAPSHOT };

export const AZ_INTEL_VERSION = "senior-az-state-intel-v1" as const;
export const AZ_PUBLIC_FINGERPRINT =
  "9f5d149051c58c88a4284c27594cf81de0912192d9b2c96397ed8af61dfc94a7";
export const AZ_PUBLIC_PATH = "/arizona";

export type AzPublicSnapshot = typeof AZ_PUBLIC_SNAPSHOT;

export type AzCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "OPEN_SEARCH_ONLY"
  | "NO_BULK_ACQUIRED"
  | "INTERNAL_ONLY";

export interface AzSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  rows: number | null;
  asOf: string | null;
  grain: string;
  identityKey: string;
  access: string;
  publication: string;
  coverage: AzCoverageState;
  limitations: string;
}

export interface AzTraceMetric {
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
  coverageState: AzCoverageState;
  caveat: string;
}

export const AZ_LOCKED = {
  gisRows: 11555,
  gisRun: "2025-02-03",
  alHome: 1719,
  alCenter: 328,
  afc: 25,
  adhc: 15,
  stateNh: 141,
  stateNhUniqueLicense: 138,
  stateHha: 223,
  stateHospice: 328,
  cmsNursingHomes: 140,
  cmsHomeHealth: 177,
  cmsHospice: 237,
  nhExact: 140,
  nhUnmatchedState: 1,
  nhUnmatchedCms: 0,
  hhaExact: 172,
  hospiceExact: 232,
  netNewCanonical: 0,
  netNewStateIdentities: 2776,
} as const;

export const AZ_SOURCE_CATALOG: AzSourceCatalogRow[] = [
  {
    id: "adhs-al-home",
    source: "ADHS GIS TYPE = ASSISTED LIVING HOME",
    agency: "ADHS Bureau of Assisted Living Facilities Licensing",
    rows: AZ_LOCKED.alHome,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Assisted Living Home location",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "GIS RUN_DATE 2025-02-03. Monthly Excel table not acquired. Home != Center.",
  },
  {
    id: "adhs-al-center",
    source: "ADHS GIS TYPE = ASSISTED LIVING CENTER",
    agency: "ADHS Bureau of Assisted Living Facilities Licensing",
    rows: AZ_LOCKED.alCenter,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Assisted Living Center location",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "Center != Home. Not a Nursing Home. Not added to Homes.",
  },
  {
    id: "adhs-afc",
    source: "ADHS GIS TYPE = ADULT FOSTER CARE",
    agency: "ADHS Bureau of Assisted Living Facilities Licensing",
    rows: AZ_LOCKED.afc,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Adult Foster Care location",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "AFC != Assisted Living Home != Nursing Home.",
  },
  {
    id: "adhs-adhc",
    source: "ADHS GIS TYPE = ADULT DAY HEALTH CARE",
    agency: "ADHS Bureau of Assisted Living Facilities Licensing",
    rows: AZ_LOCKED.adhc,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Adult Day Health Care location",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "MARKET_INTELLIGENCE_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "Non-residential. Not added to AL Home/Center.",
  },
  {
    id: "adhs-nh",
    source: "ADHS GIS TYPE = NURSING HOME (NH)",
    agency: "ADHS Bureau of Long-Term Care Facilities Licensing",
    rows: AZ_LOCKED.stateNh,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Nursing Home location",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "State license != CMS CCN. Exact MEDICARE_ID only.",
  },
  {
    id: "adhs-hha",
    source: "ADHS GIS TYPE = HOME HEALTH AGENCY",
    agency: "ADHS Bureau of Medical Facilities Licensing",
    rows: AZ_LOCKED.stateHha,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Home Health Agency location",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "Office address != service area. State license != CMS certification.",
  },
  {
    id: "adhs-hospice",
    source: "ADHS GIS TYPE = HOSPICE",
    agency: "ADHS Bureau of Medical Facilities Licensing",
    rows: AZ_LOCKED.stateHospice,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed Hospice location (service agency or inpatient subtype)",
    identityKey: "AZ-ADHS:{LICENSE_NUMBER}",
    access: "ArcGIS FeatureServer",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "Hospice != Home Health.",
  },
  {
    id: "az-care-check",
    source: "AZ Care Check",
    agency: "ADHS",
    rows: null,
    asOf: null,
    grain: "interactive facility licensing-history search",
    identityKey: "license number when a future bulk file publishes one",
    access: "OPEN_SEARCH_ONLY",
    publication: "Verification links only",
    coverage: "OPEN_SEARCH_ONLY",
    limitations: "No CSV/API. Scrape forbidden. Missing bulk != zero enforcement.",
  },
  {
    id: "adhs-gis",
    source: "All State Licensed Facilities in Arizona FeatureServer",
    agency: "ADHS GIS / Division of Licensing",
    rows: AZ_LOCKED.gisRows,
    asOf: AZ_LOCKED.gisRun,
    grain: "licensed facility location on the extract",
    identityKey: "LICENSE_NUMBER / FACID",
    access: "ArcGIS FeatureServer",
    publication: "Class filters only; child care and BH residential excluded from public core",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations: "Includes many non-senior classes. Do not use 11,555 as a senior-provider total.",
  },
  {
    id: "cms-nh",
    source: "CMS Nursing Home Provider Information (Arizona)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: AZ_LOCKED.cmsNursingHomes,
    asOf: AZ_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.sourceModifiedAt?.slice(0, 10) ?? null,
    grain: "CMS Nursing Home CCN",
    identityKey: "CMS CCN",
    access: "Provider Data Catalog query / existing national ingest",
    publication: "Existing national NH CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Not summed with ADHS Assisted Living. CMS CERTIFIED != STATE LICENSED.",
  },
  {
    id: "cms-hha",
    source: "CMS Home Health Care Agencies (Arizona)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: AZ_LOCKED.cmsHomeHealth,
    asOf: AZ_PUBLIC_SNAPSHOT.cmsOverlay.clocks.homeHealth.sourceModifiedAt?.slice(0, 10) ?? null,
    grain: "CMS Home Health CCN",
    identityKey: "CMS Home Health CCN",
    access: "Provider Data Catalog query / existing national ingest",
    publication: "Existing national Home Health CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HOME HEALTH != RESIDENTIAL CARE. Office geography is not a service area.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (Arizona)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: AZ_LOCKED.cmsHospice,
    asOf: AZ_PUBLIC_SNAPSHOT.cmsOverlay.clocks.hospice.sourceModifiedAt?.slice(0, 10) ?? null,
    grain: "CMS Hospice CCN",
    identityKey: "CMS Hospice CCN",
    access: "Provider Data Catalog query / existing national ingest",
    publication: "Existing national Hospice CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HOSPICE != HOME HEALTH.",
  },
  {
    id: "cms-inspection",
    source: "CMS Nursing Home inspection / deficiency / penalty (national exact CCN)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: AZ_LOCKED.cmsNursingHomes,
    asOf: AZ_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.sourceModifiedAt?.slice(0, 10) ?? null,
    grain: "CMS Nursing Home CCN",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub national architecture",
    publication: "Existing NH evidence panels on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Deficiency != quality rank. No deficiency found != clean record.",
  },
  {
    id: "cms-ownership",
    source: "CMS Skilled Nursing Facility All Owners / ownership graph",
    agency: "Centers for Medicare & Medicaid Services",
    rows: AZ_LOCKED.cmsNursingHomes,
    asOf: AZ_PUBLIC_SNAPSHOT.cmsOverlay.clocks.ownership.sourceModifiedAt?.slice(0, 10) ?? null,
    grain: "CMS Nursing Home CCN ownership edges",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub CMS ownership product",
    publication: "Existing ownership routes on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Do not infer Assisted Living ownership by matching names.",
  },
];

export function azTraceMetrics(snapshot: AzPublicSnapshot = AZ_PUBLIC_SNAPSHOT): AzTraceMetric[] {
  const gis = snapshot.adhsGis;
  const cms = snapshot.cmsOverlay;
  const cross = snapshot.crosswalk.stateNhToCmsNh;
  return [
    {
      id: "al-home",
      label: "Assisted Living Homes (ADHS GIS)",
      display: AZ_LOCKED.alHome.toLocaleString("en-US"),
      value: snapshot.assistedLivingHomes.rows,
      source: gis.source_url,
      sourceDate: AZ_LOCKED.gisRun,
      sourceGrain: "TYPE = ASSISTED LIVING HOME",
      numerator: snapshot.assistedLivingHomes.rows,
      denominator: snapshot.assistedLivingHomes.rows,
      computation: "Count of ADHS GIS features with TYPE ASSISTED LIVING HOME.",
      coverageState: "PARTIAL_SOURCE_COVERAGE",
      caveat: "Home != Center. Not a CMS class. GIS clock is 2025-02-03.",
    },
    {
      id: "al-center",
      label: "Assisted Living Centers (ADHS GIS)",
      display: AZ_LOCKED.alCenter.toLocaleString("en-US"),
      value: snapshot.assistedLivingCenters.rows,
      source: gis.source_url,
      sourceDate: AZ_LOCKED.gisRun,
      sourceGrain: "TYPE = ASSISTED LIVING CENTER",
      numerator: snapshot.assistedLivingCenters.rows,
      denominator: snapshot.assistedLivingCenters.rows,
      computation: "Count of ADHS GIS features with TYPE ASSISTED LIVING CENTER.",
      coverageState: "PARTIAL_SOURCE_COVERAGE",
      caveat: "Not added to Assisted Living Homes.",
    },
    {
      id: "afc",
      label: "Adult Foster Care (ADHS GIS)",
      display: AZ_LOCKED.afc.toLocaleString("en-US"),
      value: snapshot.adultFosterCare.rows,
      source: gis.source_url,
      sourceDate: AZ_LOCKED.gisRun,
      sourceGrain: "TYPE = ADULT FOSTER CARE",
      numerator: snapshot.adultFosterCare.rows,
      denominator: snapshot.adultFosterCare.rows,
      computation: "Count of ADHS GIS features with TYPE ADULT FOSTER CARE.",
      coverageState: "PARTIAL_SOURCE_COVERAGE",
      caveat: "AFC != Nursing Home. AFC != Assisted Living Home.",
    },
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in Arizona",
      display: AZ_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Nursing Home CCN with state = AZ",
      numerator: cms.nursingHomes,
      denominator: cms.nursingHomes,
      computation: "National CMS Nursing Home directory identities in Arizona.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not summed with ADHS Assisted Living. CMS CERTIFIED != STATE LICENSED.",
    },
    {
      id: "cms-hha-overlay",
      label: "CMS Home Health Agencies in Arizona",
      display: AZ_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: cms.homeHealth,
      source: cms.clocks.homeHealth.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.homeHealth.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Home Health CCN with state = AZ",
      numerator: cms.homeHealth,
      denominator: cms.homeHealth,
      computation: "National CMS Home Health directory identities in Arizona.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "HOME HEALTH != RESIDENTIAL CARE. Office geography is not a service area.",
    },
    {
      id: "cms-hospice-overlay",
      label: "CMS Hospice providers in Arizona",
      display: AZ_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: cms.hospice,
      source: cms.clocks.hospice.officialUrl ?? "CMS Provider Data Catalog",
      sourceDate: cms.clocks.hospice.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Hospice CCN with state = AZ",
      numerator: cms.hospice,
      denominator: cms.hospice,
      computation: "National CMS Hospice directory identities in Arizona.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "HOSPICE != HOME HEALTH.",
    },
    {
      id: "state-nh-cms-exact",
      label: "Exact ADHS NH MEDICARE_ID matching CMS Nursing Homes",
      display: AZ_LOCKED.nhExact.toLocaleString("en-US"),
      value: cross.exact_matches,
      source: "ADHS MEDICARE_ID padded ∩ CMS NH AZ CCN set",
      sourceDate: AZ_LOCKED.gisRun,
      sourceGrain: "exact CCN",
      numerator: cross.exact_matches,
      denominator: cross.state_native_ccns,
      computation:
        "Intersection of distinct padded MEDICARE_ID values on ADHS Nursing Home GIS rows with the live CMS Nursing Home AZ CCN set. Name and city are not used.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Unmatched remain unmatched. Assisted Living is not joined.",
    },
    {
      id: "net-new-canonical",
      label: "Net-new canonical organizations",
      display: AZ_LOCKED.netNewCanonical.toLocaleString("en-US"),
      value: snapshot.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS,
      source: "expansion ledger vs pre-ingest CMS Arizona graph",
      sourceDate: snapshot.asOf,
      sourceGrain: "canonical organization",
      numerator: 0,
      denominator: snapshot.expansionLedger.NET_NEW_STATE_IDENTITIES,
      computation:
        "STATE_DIRECTORY_ONLY. CMS CCNs already in the national graph are not new organizations. Exact crosswalk is not a new organization.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "State identities can exist without minting thousands of profile routes.",
    },
    {
      id: "net-new-state",
      label: "Net-new ADHS state identities",
      display: AZ_LOCKED.netNewStateIdentities.toLocaleString("en-US"),
      value: snapshot.expansionLedger.NET_NEW_STATE_IDENTITIES,
      source: "AZ-ADHS:{LICENSE_NUMBER} on core senior GIS classes",
      sourceDate: AZ_LOCKED.gisRun,
      sourceGrain: "distinct LICENSE_NUMBER",
      numerator: snapshot.expansionLedger.NET_NEW_STATE_IDENTITIES,
      denominator: snapshot.expansionLedger.NET_NEW_STATE_IDENTITIES,
      computation:
        "Distinct LICENSE_NUMBER values among Assisted Living Home, Center, Adult Foster Care, Adult Day Health, Nursing Home, Home Health, and Hospice GIS rows. None existed as Arizona state identities before this ticket.",
      coverageState: "PARTIAL_SOURCE_COVERAGE",
      caveat: "New state identity != new canonical organization under STATE_DIRECTORY_ONLY.",
    },
  ];
}

export function assertAzIntelligence(
  value: AzPublicSnapshot = AZ_PUBLIC_SNAPSHOT,
): AzPublicSnapshot {
  if (value.version !== AZ_INTEL_VERSION) {
    throw new Error(`Unexpected Arizona contract ${value.version}`);
  }
  if (value.fingerprint !== AZ_PUBLIC_FINGERPRINT) {
    throw new Error("Arizona public snapshot fingerprint drifted");
  }
  if (value.assistedLivingHomes.rows !== AZ_LOCKED.alHome) {
    throw new Error("Assisted Living Home count drifted");
  }
  if (value.assistedLivingCenters.rows !== AZ_LOCKED.alCenter) {
    throw new Error("Assisted Living Center count drifted");
  }
  if (value.adultFosterCare.rows !== AZ_LOCKED.afc) {
    throw new Error("Adult Foster Care count drifted");
  }
  if (value.cmsOverlay.nursingHomes !== AZ_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay drifted");
  }
  if (value.cmsOverlay.homeHealth !== AZ_LOCKED.cmsHomeHealth) {
    throw new Error("CMS HHA overlay drifted");
  }
  if (value.cmsOverlay.hospice !== AZ_LOCKED.cmsHospice) {
    throw new Error("CMS Hospice overlay drifted");
  }
  if (value.cmsOverlay.liveDirectoryAzUniqueCcn.nursingHomes !== AZ_LOCKED.cmsNursingHomes) {
    throw new Error("Live CMS NH Arizona CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryAzUniqueCcn.homeHealth !== AZ_LOCKED.cmsHomeHealth) {
    throw new Error("Live CMS HHA Arizona CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryAzUniqueCcn.hospice !== AZ_LOCKED.cmsHospice) {
    throw new Error("Live CMS Hospice Arizona CCN set must reconcile to the overlay");
  }
  if (value.crosswalk.alHomeToCmsNh.attempted !== false) {
    throw new Error("Assisted Living Home must not be joined to CMS NH");
  }
  if (value.crosswalk.alCenterToCmsNh.attempted !== false) {
    throw new Error("Assisted Living Center must not be joined to CMS NH");
  }
  if (value.expansionLedger.NET_NEW_CANONICAL_ORGANIZATIONS !== 0) {
    throw new Error(
      "Do not claim CMS or directory-only state rows as net-new canonical organizations",
    );
  }
  if (value.noCombinedDenominator !== true) {
    throw new Error("Combined Arizona senior-provider denominator is forbidden");
  }
  if (value.publicationPath !== AZ_PUBLIC_PATH) {
    throw new Error("Arizona publication path must be /arizona");
  }
  if (value.noCountyRoutes !== true || value.noCityRoutes !== true) {
    throw new Error("Arizona local routes are forbidden");
  }
  return value;
}
