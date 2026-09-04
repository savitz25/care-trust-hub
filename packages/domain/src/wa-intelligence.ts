import { WA_PUBLIC_SNAPSHOT } from "./wa-public-snapshot";

export { WA_PUBLIC_SNAPSHOT };

export const WA_INTEL_VERSION = "senior-wa-state-intel-v1" as const;
export const WA_PUBLIC_FINGERPRINT =
  "2ad2b2ec7cdf0c1c32aae8980ea4b1f921e264cf49705881ce31671faaf220a4";
export const WA_PUBLIC_PATH = "/washington";

export type WaPublicSnapshot = typeof WA_PUBLIC_SNAPSHOT;

export type WaCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "OPEN_SEARCH_ONLY"
  | "NO_BULK_ACQUIRED"
  | "INTERNAL_ONLY";

export interface WaSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  rows: number | null;
  asOf: string | null;
  grain: string;
  identityKey: string;
  access: string;
  publication: string;
  coverage: WaCoverageState;
  limitations: string;
}

export interface WaTraceMetric {
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
  coverageState: WaCoverageState;
  caveat: string;
}

export const WA_LOCKED = {
  gisCurrent: 6968,
  afh: 6179,
  alf: 557,
  esf: 16,
  sl: 187,
  gt: 29,
  gisPhone: 6900,
  gisAddress: 6968,
  gisCounties: 37,
  afhPhone: 6128,
  alfPhone: 547,
  esfPhone: 15,
  cmsNursingHomes: 193,
  cmsHomeHealth: 74,
  cmsHospice: 50,
  stateNhCurrent: 198,
  stateNhNf: 195,
  stateNhIm: 3,
  stateNhUniqueLicense: 198,
  stateNhUniqueCcn: 196,
  stateNhExactCms: 193,
  stateNhUnmatchedState: 3,
  stateNhUnmatchedCms: 0,
  overlayAsOf: "2026-08-27",
  gisAsOf: "2026-09-04",
} as const;

export const WA_SOURCE_CATALOG: WaSourceCatalogRow[] = [
  {
    id: "dshs-gis-residential",
    source: "DSHS Long Term Care — Residential Care GIS",
    agency: "Washington DSHS Residential Care Services",
    rows: WA_LOCKED.gisCurrent,
    asOf: WA_LOCKED.gisAsOf,
    grain: "current GIS location (GDLArchiveDate IS NULL)",
    identityKey: "LicenseNumber; FacInstanceId",
    access: "ArcGIS FeatureServer",
    publication: "State page directory tables; no thousands of profile routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Current GIS record is not independently license-in-good-standing. FacilityStatus OP on all current rows. DSHS != CMS.",
  },
  {
    id: "dshs-afh",
    source: "Adult Family Home (FacilityType AF)",
    agency: "Washington DSHS RCS",
    rows: WA_LOCKED.afh,
    asOf: WA_LOCKED.gisAsOf,
    grain: "AFH license location",
    identityKey: "WA-DSHS:{LicenseNumber}",
    access: "Same GIS layer, filtered AF",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "AFH != ALF. AFH != Nursing Home. Not a CMS class.",
  },
  {
    id: "dshs-alf",
    source: "Assisted Living Facility (FacilityType BH)",
    agency: "Washington DSHS RCS",
    rows: WA_LOCKED.alf,
    asOf: WA_LOCKED.gisAsOf,
    grain: "ALF license location",
    identityKey: "WA-DSHS:{LicenseNumber}",
    access: "Same GIS layer, filtered BH",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "ALF != SNF. ALF != CMS Nursing Home. No name/address CMS join.",
  },
  {
    id: "dshs-esf",
    source: "Enhanced Services Facility (FacilityType EF)",
    agency: "Washington DSHS RCS",
    rows: WA_LOCKED.esf,
    asOf: WA_LOCKED.gisAsOf,
    grain: "ESF license location",
    identityKey: "WA-DSHS:{LicenseNumber}",
    access: "Same GIS layer, filtered EF",
    publication: "STATE_DIRECTORY_ONLY",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Not merged into Assisted Living.",
  },
  {
    id: "dshs-sl",
    source: "Certified RSS / Supported Living (FacilityType SL)",
    agency: "Washington DSHS",
    rows: WA_LOCKED.sl,
    asOf: WA_LOCKED.gisAsOf,
    grain: "certified RSS provider location",
    identityKey: "LicenseNumber",
    access: "Same GIS layer; not a public senior-care tile",
    publication: "INTERNAL_ONLY / MARKET_INTELLIGENCE_ONLY",
    coverage: "INTERNAL_ONLY",
    limitations: "Adjacent DDA/residential supports. Not added to AFH+ALF+NH.",
  },
  {
    id: "dshs-gt",
    source: "Group Training Home (FacilityType GT)",
    agency: "Washington DSHS",
    rows: WA_LOCKED.gt,
    asOf: WA_LOCKED.gisAsOf,
    grain: "group training home location",
    identityKey: "LicenseNumber",
    access: "Same GIS layer; excluded from consumer core",
    publication: "INTERNAL_ONLY",
    coverage: "INTERNAL_ONLY",
    limitations: "Not a consumer senior-care product class.",
  },
  {
    id: "dshs-nh-gis",
    source: "DSHS Long Term Care — Nursing Homes GIS",
    agency: "Washington DSHS RCS",
    rows: WA_LOCKED.stateNhCurrent,
    asOf: WA_LOCKED.gisAsOf,
    grain: "current NH GIS location (GDLArchiveDate IS NULL)",
    identityKey: "nf_license_num; nf_fed_provider_num",
    access: "ArcGIS FeatureServer",
    publication: "State page counts; staff names unpublished",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "198 current rows include NF 195 and IM 3. Not added to CMS 193. Staff name fields unpublished.",
  },
  {
    id: "cms-nh",
    source: "CMS Nursing Home Provider Information (WA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: WA_LOCKED.cmsNursingHomes,
    asOf: WA_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN in Washington geography",
    identityKey: "CMS CCN",
    access: "Provider Data Catalog query / existing national ingest",
    publication: "Existing national CCN routes only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "CMS CERTIFIED != STATE LICENSED. Not summed with DSHS AFH/ALF/ESF.",
  },
  {
    id: "cms-hha",
    source: "CMS Home Health Care Agencies (WA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: WA_LOCKED.cmsHomeHealth,
    asOf: WA_PUBLIC_SNAPSHOT.cmsOverlay.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
    grain: "CMS Home Health CCN; office is not a service area",
    identityKey: "CMS Home Health CCN",
    access: "Provider Data Catalog query / existing national ingest",
    publication: "Existing national Home Health CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HOME HEALTH != RESIDENTIAL CARE. Not an Adult Family Home.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (WA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: WA_LOCKED.cmsHospice,
    asOf: WA_PUBLIC_SNAPSHOT.cmsOverlay.clocks.hospice.sourceModifiedAt.slice(0, 10),
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
    rows: WA_LOCKED.cmsNursingHomes,
    asOf: WA_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub national architecture",
    publication: "Existing NH evidence panels on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "No Washington-specific score. Deficiency != quality rank. No deficiency found != clean record.",
  },
  {
    id: "cms-ownership",
    source: "CMS Skilled Nursing Facility All Owners / ownership graph",
    agency: "Centers for Medicare & Medicaid Services",
    rows: WA_LOCKED.cmsNursingHomes,
    asOf: WA_PUBLIC_SNAPSHOT.cmsOverlay.clocks.ownership.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN ownership edges",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub CMS ownership product",
    publication: "Existing ownership routes on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Do not infer AFH/ALF ownership by matching names.",
  },
  {
    id: "state-enforcement",
    source: "DSHS AFH/ALF/ESF/NH inspection and enforcement bulk",
    agency: "Washington DSHS RCS",
    rows: null,
    asOf: null,
    grain: "not acquired as a statewide structured file",
    identityKey: "DSHS LicenseNumber when a future bulk file publishes one",
    access: "Locator inspection pages SEARCH_ONLY; scrape forbidden",
    publication: "Verification links only",
    coverage: "NO_BULK_ACQUIRED",
    limitations:
      "Missing bulk != zero enforcement. Complaint != violation. Name-only attach is UNSAFE.",
  },
];

export function waTraceMetrics(snapshot: WaPublicSnapshot = WA_PUBLIC_SNAPSHOT): WaTraceMetric[] {
  const gis = snapshot.dshsGis;
  const cms = snapshot.cmsOverlay;
  const cross = snapshot.crosswalk.stateNhToCmsNh;
  return [
    {
      id: "gis-current",
      label: "Current DSHS residential-care GIS rows",
      display: WA_LOCKED.gisCurrent.toLocaleString("en-US"),
      value: gis.profile.rows,
      source: gis.source_url,
      sourceDate: snapshot.asOf,
      sourceGrain: "GDLArchiveDate IS NULL",
      numerator: gis.profile.rows,
      denominator: gis.profile.rows,
      computation: "FeatureServer count and paged harvest of current (non-archived) residential-care locations.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Includes AF, BH, EF, SL, and GT. Not one senior-provider total. Current GIS record != quality.",
    },
    {
      id: "afh",
      label: "Adult Family Homes (current GIS)",
      display: WA_LOCKED.afh.toLocaleString("en-US"),
      value: snapshot.adultFamilyHomes.count,
      source: gis.source_url,
      sourceDate: snapshot.asOf,
      sourceGrain: "FacilityType = AF and GDLArchiveDate IS NULL",
      numerator: snapshot.adultFamilyHomes.count,
      denominator: snapshot.adultFamilyHomes.count,
      computation: "Count of current GIS rows with FacilityType AF.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "AFH != ALF. AFH != Nursing Home. Not CMS certified by this file.",
    },
    {
      id: "alf",
      label: "Assisted Living Facilities (current GIS)",
      display: WA_LOCKED.alf.toLocaleString("en-US"),
      value: snapshot.assistedLiving.count,
      source: gis.source_url,
      sourceDate: snapshot.asOf,
      sourceGrain: "FacilityType = BH and GDLArchiveDate IS NULL",
      numerator: snapshot.assistedLiving.count,
      denominator: snapshot.assistedLiving.count,
      computation: "Count of current GIS rows with FacilityType BH (Assisted Living Facility).",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "ALF != SNF. Not added to Adult Family Homes.",
    },
    {
      id: "esf",
      label: "Enhanced Services Facilities (current GIS)",
      display: WA_LOCKED.esf.toLocaleString("en-US"),
      value: snapshot.enhancedServices.count,
      source: gis.source_url,
      sourceDate: snapshot.asOf,
      sourceGrain: "FacilityType = EF and GDLArchiveDate IS NULL",
      numerator: snapshot.enhancedServices.count,
      denominator: snapshot.enhancedServices.count,
      computation: "Count of current GIS rows with FacilityType EF.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not merged into Assisted Living.",
    },
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in Washington",
      display: WA_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl,
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = WA",
      numerator: cms.nursingHomes,
      denominator: cms.nursingHomes,
      computation:
        "National CMS Nursing Home directory identities in Washington. Live unique CCN query reconciles to the overlay.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not summed with DSHS AFH/ALF. CMS CERTIFIED != STATE LICENSED.",
    },
    {
      id: "cms-hha-overlay",
      label: "CMS Home Health Agencies in Washington",
      display: WA_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: cms.homeHealth,
      source: cms.clocks.homeHealth.officialUrl,
      sourceDate: cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Home Health CCN with state = WA",
      numerator: cms.homeHealth,
      denominator: cms.homeHealth,
      computation: "National CMS Home Health directory identities in Washington.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "HOME HEALTH != RESIDENTIAL CARE. Office geography is not a service area.",
    },
    {
      id: "cms-hospice-overlay",
      label: "CMS Hospice providers in Washington",
      display: WA_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: cms.hospice,
      source: cms.clocks.hospice.officialUrl,
      sourceDate: cms.clocks.hospice.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Hospice CCN with state = WA",
      numerator: cms.hospice,
      denominator: cms.hospice,
      computation: "National CMS Hospice directory identities in Washington.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "HOSPICE != HOME HEALTH.",
    },
    {
      id: "state-nh-cms-exact",
      label: "Exact DSHS NH federal numbers matching CMS Nursing Homes",
      display: WA_LOCKED.stateNhExactCms.toLocaleString("en-US"),
      value: cross.exact_matches,
      source: "DSHS nf_fed_provider_num padded ∩ CMS NH WA CCN set",
      sourceDate: snapshot.asOf,
      sourceGrain: "exact CCN",
      numerator: cross.exact_matches,
      denominator: cross.state_native_ccns,
      computation:
        "Intersection of distinct padded nf_fed_provider_num values on current DSHS NH GIS rows with the live CMS Nursing Home WA CCN set. Name and city are not used.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Unmatched DSHS and unmatched CMS remain unmatched. AFH/ALF are not joined.",
    },
  ];
}

export function assertWaIntelligence(
  value: WaPublicSnapshot = WA_PUBLIC_SNAPSHOT,
): WaPublicSnapshot {
  if (value.version !== WA_INTEL_VERSION) {
    throw new Error(`Unexpected Washington contract ${value.version}`);
  }
  if (value.fingerprint !== WA_PUBLIC_FINGERPRINT) {
    throw new Error("Washington public snapshot fingerprint drifted");
  }
  if (value.dshsGis.profile.rows !== WA_LOCKED.gisCurrent) {
    throw new Error("DSHS GIS current count drifted");
  }
  if (value.adultFamilyHomes.count !== WA_LOCKED.afh) {
    throw new Error("AFH count drifted");
  }
  if (value.assistedLiving.count !== WA_LOCKED.alf) {
    throw new Error("ALF count drifted");
  }
  if (value.enhancedServices.count !== WA_LOCKED.esf) {
    throw new Error("ESF count drifted");
  }
  if (value.cmsOverlay.nursingHomes !== WA_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay drifted");
  }
  if (value.cmsOverlay.homeHealth !== WA_LOCKED.cmsHomeHealth) {
    throw new Error("CMS HHA overlay drifted");
  }
  if (value.cmsOverlay.hospice !== WA_LOCKED.cmsHospice) {
    throw new Error("CMS Hospice overlay drifted");
  }
  if (value.cmsOverlay.liveDirectoryWaUniqueCcn.nursingHomes !== WA_LOCKED.cmsNursingHomes) {
    throw new Error("Live CMS NH Washington CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryWaUniqueCcn.homeHealth !== WA_LOCKED.cmsHomeHealth) {
    throw new Error("Live CMS HHA Washington CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryWaUniqueCcn.hospice !== WA_LOCKED.cmsHospice) {
    throw new Error("Live CMS Hospice Washington CCN set must reconcile to the overlay");
  }
  if (value.crosswalk.afhToCmsNh.attempted !== false) {
    throw new Error("AFH must not be joined to CMS NH");
  }
  if (value.crosswalk.alfToCmsNh.attempted !== false) {
    throw new Error("ALF must not be joined to CMS NH");
  }
  if (value.noCombinedDenominator !== true) {
    throw new Error("Combined Washington senior-provider denominator is forbidden");
  }
  return value;
}
