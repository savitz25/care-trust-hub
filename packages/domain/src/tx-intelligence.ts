import { TX_PUBLIC_SNAPSHOT } from "./tx-public-snapshot";

export { TX_PUBLIC_SNAPSHOT };

export const TX_INTEL_VERSION = "senior-tx-state-intel-v1" as const;
export const TX_PUBLIC_FINGERPRINT =
  "21a477348aa7e5f8de242acaa64526633a454ee4bbd59e232feefa5aa34ef407";
export const TX_PUBLIC_PATH = "/texas";

export type TxPublicSnapshot = typeof TX_PUBLIC_SNAPSHOT;

export type TxCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "ACQUIRED_DATED_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "OPEN_SEARCH_ONLY"
  | "NO_BULK_ACQUIRED"
  | "DELIBERATELY_EXCLUDED";

export interface TxSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  rows: number | null;
  asOf: string | null;
  grain: string;
  identityKey: string;
  access: string;
  publication: string;
  coverage: TxCoverageState;
  limitations: string;
}

export interface TxTraceMetric {
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
  coverageState: TxCoverageState;
  caveat: string;
}

export const TX_LOCKED = {
  cmsNursingHomes: 1177,
  cmsHomeHealth: 1854,
  cmsHospice: 1053,
  hhscNf: 1175,
  hhscNfCertifiedYes: 1169,
  hhscNfNativeCcn: 1153,
  hhscNfExactCms: 1149,
  hhscNfUnmatchedCms: 28,
  hhscNfUnmatchedState: 4,
  hhscAlf: 2000,
  hhscAlfAlzheimer: 731,
  hhscAlfTypeA: 337,
  hhscAlfTypeB: 1655,
  hhscAlfTypeC: 8,
  hhscHcssa: 8799,
  hhscHcssaParent: 7743,
  hhscHcssaPas: 6035,
  hhscHcssaLicensedHh: 3608,
  hhscHcssaCertifiedHh: 2048,
  hhscHcssaHospice: 1538,
  hhscHcssaLicensedStatus: 7481,
  hhscHcssaEnforcementPend: 1151,
  hhscHospNf: 6,
  nfClosures: 404,
  alfClosures: 1496,
  hcssaClosures: 22027,
  cmsNhCounties: 217,
  texasCounties: 254,
  childCareOperations: 14982,
  childCareInspections: 206609,
  hhscAsOf: "2026-09-03",
  closuresAsOf: "2026-07-20",
  cmsOverlayAsOf: "2026-08-27",
} as const;

export const TX_SOURCE_CATALOG: TxSourceCatalogRow[] = [
  {
    id: "cms-nh",
    source: "CMS Nursing Home Provider Information (TX overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: TX_LOCKED.cmsNursingHomes,
    asOf: TX_PUBLIC_SNAPSHOT.cmsOverlay.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN in Texas geography",
    identityKey: "CMS CCN",
    access: "Provider Data Catalog CSV / existing national ingest",
    publication: "Existing national CCN routes only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Not summed with HHSC NF.xlsx. CMS CERTIFIED != STATE LICENSED. Live unique Texas CCNs reconcile to 1,177.",
  },
  {
    id: "cms-hha",
    source: "CMS Home Health Care Agencies (TX overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: TX_LOCKED.cmsHomeHealth,
    asOf: TX_PUBLIC_SNAPSHOT.cmsOverlay.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
    grain: "CMS Home Health CCN; office is not a service area",
    identityKey: "CMS Home Health CCN",
    access: "Provider Data Catalog CSV / existing national ingest",
    publication: "Existing national Home Health CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Not HCSSA. Not Personal Assistance. This extract has City/Town and State, not a county field.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (TX overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: TX_LOCKED.cmsHospice,
    asOf: TX_PUBLIC_SNAPSHOT.cmsOverlay.clocks.hospice.sourceModifiedAt.slice(0, 10),
    grain: "CMS Hospice CCN",
    identityKey: "CMS Hospice CCN",
    access: "Provider Data Catalog CSV / existing national ingest",
    publication: "Existing national Hospice CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HOSPICE != HOME HEALTH. Not an HCSSA row total.",
  },
  {
    id: "hhsc-tulip",
    source: "Texas Unified Licensure Information Portal (TULIP)",
    agency: "Texas Health and Human Services Commission",
    rows: null,
    asOf: null,
    grain: "interactive LTC provider search (not a bulk roster)",
    identityKey: "HHSC facility / license ID on a looked-up record",
    access: "OPEN_SEARCH_NO_LOGIN; scrape forbidden",
    publication: "Verification link only; no TULIP scrape and no invented TULIP count",
    coverage: "OPEN_SEARCH_ONLY",
    limitations:
      "TULIP SEARCH RESULT != COMPLETE BULK UNIVERSE. Missing TULIP roster is unknown, not zero. Hospice and Home Health may serve counties other than the registered county.",
  },
  {
    id: "tx-alf",
    source: "HHSC Directory of Assisted Living Facility Providers (al.xlsx)",
    agency: "Texas Health and Human Services Commission",
    rows: TX_LOCKED.hhscAlf,
    asOf: TX_LOCKED.hhscAsOf,
    grain: "HHSC Assisted Living Facility (Facility ID / License Number)",
    identityKey: "HHSC Facility ID / License No",
    access: "Official Excel directory",
    publication:
      "Source-level state page; existing /assisted-living/texas landing; no new state-only profiles minted here",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "ALF != SNF. Alzheimer's Certified is an official certificate field (731), never inferred from a name. Not a CMS class.",
  },
  {
    id: "hcssa",
    source: "HHSC HCSSA providers directory (HHA.xlsx)",
    agency: "Texas Health and Human Services Commission",
    rows: TX_LOCKED.hhscHcssa,
    asOf: TX_LOCKED.hhscAsOf,
    grain: "HHSC Home and Community Support Services Agency (License No)",
    identityKey: "HHSC License No; Medicare Number when source-native",
    access: "Official Excel directory",
    publication: "Source-level state page; not a CMS Home Health extract",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Filename HHA.xlsx is HCSSA, not CMS Home Health. Service labels overlap and are not added. HOME HEALTH != PERSONAL ASSISTANCE. HOSPICE != HOME HEALTH. Administrator email is not published.",
  },
  {
    id: "state-enforcement",
    source: "HHSC closure workbooks; data.texas.gov LTC enforcement search",
    agency: "Texas Health and Human Services Commission",
    rows: null,
    asOf: TX_LOCKED.closuresAsOf,
    grain: "historical closure listing row (Facility ID / License No)",
    identityKey: "HHSC Facility ID or License No; no name-only adverse attach",
    access: "Official Excel closures; SOD/penalty bulk not acquired",
    publication: "Source-level counts only; not a quality rank",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    limitations:
      "NF closures 404, ALF closures 1,496, HCSSA closures 22,027 as of 2026-07-20 are historical license actions, not current rosters and not inspection findings. Statement-of-deficiencies and administrative-penalty bulk were not acquired. Missing is unknown, not zero. Child-care CCL SODA is excluded.",
  },
  {
    id: "cms-inspection",
    source: "CMS Nursing Home inspection / deficiency / penalty files",
    agency: "Centers for Medicare & Medicaid Services",
    rows: TX_LOCKED.cmsNursingHomes,
    asOf: TX_PUBLIC_SNAPSHOT.cmsOverlay.clocks.penalties.sourceModifiedAt.slice(0, 10),
    grain: "existing national CMS Nursing Home CCN inspection architecture",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub federal inspection/enforcement product",
    publication: "CMS Nursing Home class profiles; no Texas ranking",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Reuses national definitions. Inspection deficiency != quality rank. No deficiency found != clean record. Home Health and Hospice have no CMS national inspection/enforcement file on this hub.",
  },
  {
    id: "cms-ownership",
    source: "CMS Skilled Nursing Facility All Owners / ownership graph",
    agency: "Centers for Medicare & Medicaid Services",
    rows: TX_LOCKED.cmsNursingHomes,
    asOf: TX_PUBLIC_SNAPSHOT.cmsOverlay.clocks.ownership.sourceModifiedAt.slice(0, 10),
    grain: "CMS Nursing Home CCN ownership edges",
    identityKey: "CMS CCN",
    access: "Existing SeniorTrustHub CMS ownership product",
    publication: "Existing ownership routes on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Do not infer ownership for state-only facilities by name. TULIP licensee/operator is not scraped as a roster.",
  },
];

export function txTraceMetrics(snapshot: TxPublicSnapshot = TX_PUBLIC_SNAPSHOT): TxTraceMetric[] {
  const cms = snapshot.cmsOverlay;
  const nf = snapshot.hhscNursingFacilities;
  const alf = snapshot.hhscAssistedLiving;
  const hcssa = snapshot.hhscHcssa;
  const cross = snapshot.crosswalk.nfToCmsNh;
  return [
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in Texas (overlay)",
      display: TX_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.clocks.nursingHomes.officialUrl,
      sourceDate: cms.clocks.nursingHomes.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Nursing Home CCN with state = TX",
      numerator: cms.nursingHomes,
      denominator: cms.nursingHomes,
      computation:
        "Canonical national CMS Nursing Home directory identities in Texas. Live unique CCN set reconciles to the same count.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not summed with HHSC NF.xlsx. CMS CERTIFIED != STATE LICENSED.",
    },
    {
      id: "cms-hha-overlay",
      label: "CMS Home Health Agencies in Texas (overlay)",
      display: TX_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: cms.homeHealth,
      source: cms.clocks.homeHealth.officialUrl,
      sourceDate: cms.clocks.homeHealth.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Home Health CCN with state = TX",
      numerator: cms.homeHealth,
      denominator: cms.homeHealth,
      computation: "Canonical national CMS Home Health directory identities in Texas.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not HCSSA. Office geography is not a service area.",
    },
    {
      id: "cms-hospice-overlay",
      label: "CMS Hospice providers in Texas (overlay)",
      display: TX_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: cms.hospice,
      source: cms.clocks.hospice.officialUrl,
      sourceDate: cms.clocks.hospice.sourceModifiedAt.slice(0, 10),
      sourceGrain: "CMS Hospice CCN with state = TX",
      numerator: cms.hospice,
      denominator: cms.hospice,
      computation: "Canonical national CMS Hospice directory identities in Texas.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "HOSPICE != HOME HEALTH. Not an HCSSA hospice-service row total.",
    },
    {
      id: "hhsc-nf",
      label: "HHSC nursing facilities with an active license",
      display: TX_LOCKED.hhscNf.toLocaleString("en-US"),
      value: nf.source_row_count,
      source: nf.source_url,
      sourceDate: nf.source_as_of,
      sourceGrain: "HHSC NF.xlsx directory row (Facility ID)",
      numerator: nf.source_row_count,
      denominator: nf.source_row_count,
      computation:
        "Count of rows under the Facility Name header in the official NF.xlsx directory.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not added to hospital-based NF.xlsx (6 rows). Not the CMS overlay.",
    },
    {
      id: "nf-ccn-exact",
      label: "Exact HHSC NF Medicare numbers matching CMS Nursing Homes",
      display: TX_LOCKED.hhscNfExactCms.toLocaleString("en-US"),
      value: cross.exact_matches,
      source: "HHSC Medicare Provider Number padded to 6 digits ∩ CMS NH TX CCN set",
      sourceDate: nf.source_as_of,
      sourceGrain: "exact CCN",
      numerator: cross.exact_matches,
      denominator: cross.source_native_ccns,
      computation:
        "Intersection of distinct padded Medicare Provider Number values on HHSC NF rows with the live CMS Nursing Home TX CCN set. Name and city are not used.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Unmatched HHSC and unmatched CMS remain unmatched. No name-only attachment.",
    },
    {
      id: "hhsc-alf",
      label: "HHSC Assisted Living Facilities with an active license",
      display: TX_LOCKED.hhscAlf.toLocaleString("en-US"),
      value: alf.source_row_count,
      source: alf.source_url,
      sourceDate: alf.source_as_of,
      sourceGrain: "HHSC al.xlsx directory row (Facility ID)",
      numerator: alf.source_row_count,
      denominator: alf.source_row_count,
      computation:
        "Count of rows under the Facility Name header in the official al.xlsx directory.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "ALF != SNF. Not a CMS class and not added to NF.xlsx.",
    },
    {
      id: "hcssa-rows",
      label: "HHSC HCSSA directory rows",
      display: TX_LOCKED.hhscHcssa.toLocaleString("en-US"),
      value: hcssa.source_row_count,
      source: hcssa.source_url,
      sourceDate: hcssa.source_as_of,
      sourceGrain: "HHSC HHA.xlsx HCSSA directory row (License No)",
      numerator: hcssa.source_row_count,
      denominator: hcssa.source_row_count,
      computation: "Count of rows under the Agency header in the official HCSSA directory.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Not a CMS Home Health count. Service labels overlap and must not be added. Personal Assistance is not Home Health.",
    },
    {
      id: "tulip-roster",
      label: "TULIP bulk roster count",
      display: "Unknown / search-only",
      value: null,
      source: snapshot.tulip.search,
      sourceDate: null,
      sourceGrain: "interactive search result",
      numerator: null,
      denominator: null,
      computation: "TULIP is not acquired as a bulk roster. No count is invented.",
      coverageState: "OPEN_SEARCH_ONLY",
      caveat: "Missing is unknown, not zero. A search result is not the complete universe.",
    },
  ];
}

export function assertTxIntelligence(
  value: TxPublicSnapshot = TX_PUBLIC_SNAPSHOT,
): TxPublicSnapshot {
  if (value.version !== TX_INTEL_VERSION) {
    throw new Error(`Unexpected Texas contract ${value.version}`);
  }
  if (value.fingerprint !== TX_PUBLIC_FINGERPRINT) {
    throw new Error("Texas public snapshot fingerprint drifted");
  }
  if (value.cmsOverlay.nursingHomes !== TX_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay drifted");
  }
  if (value.cmsOverlay.homeHealth !== TX_LOCKED.cmsHomeHealth) {
    throw new Error("CMS HHA overlay drifted");
  }
  if (value.cmsOverlay.hospice !== TX_LOCKED.cmsHospice) {
    throw new Error("CMS Hospice overlay drifted");
  }
  if (value.cmsOverlay.liveDirectoryTxUniqueCcn.nursingHomes !== TX_LOCKED.cmsNursingHomes) {
    throw new Error("Live CMS NH Texas CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryTxUniqueCcn.homeHealth !== TX_LOCKED.cmsHomeHealth) {
    throw new Error("Live CMS HHA Texas CCN set must reconcile to the overlay");
  }
  if (value.cmsOverlay.liveDirectoryTxUniqueCcn.hospice !== TX_LOCKED.cmsHospice) {
    throw new Error("Live CMS Hospice Texas CCN set must reconcile to the overlay");
  }
  if (value.hhscNursingFacilities.source_row_count !== TX_LOCKED.hhscNf) {
    throw new Error("HHSC NF directory count drifted");
  }
  if (value.hhscAssistedLiving.source_row_count !== TX_LOCKED.hhscAlf) {
    throw new Error("HHSC ALF directory count drifted");
  }
  if (value.hhscAssistedLiving.alzheimer_certificate !== TX_LOCKED.hhscAlfAlzheimer) {
    throw new Error("HHSC ALF Alzheimer certificate count drifted");
  }
  const alfTypes = Object.fromEntries(
    value.hhscAssistedLiving.by_type.map((row) => [row.label, row.count]),
  );
  if (
    alfTypes["TYPE A"] !== TX_LOCKED.hhscAlfTypeA ||
    alfTypes["TYPE B"] !== TX_LOCKED.hhscAlfTypeB ||
    alfTypes["TYPE C"] !== TX_LOCKED.hhscAlfTypeC
  ) {
    throw new Error("HHSC ALF type counts drifted");
  }
  if (value.hhscHcssa.source_row_count !== TX_LOCKED.hhscHcssa) {
    throw new Error("HHSC HCSSA directory count drifted");
  }
  if (value.tulip.license_count_published !== null) {
    throw new Error("TULIP roster must stay unknown");
  }
  if (value.hhscHospitalBasedNf.source_row_count !== TX_LOCKED.hhscHospNf) {
    throw new Error("Hospital-based NF sibling count drifted");
  }
  if (value.crosswalk.nfToCmsNh.exact_matches !== TX_LOCKED.hhscNfExactCms) {
    throw new Error("NF exact CCN matches drifted");
  }
  if (value.crosswalk.alfToCmsNh.attempted !== false) {
    throw new Error("ALF must not be crosswalked to CMS Nursing Homes");
  }
  if (
    value.enforcement.childCareExcluded["bc5r-88dy"].publication !==
    "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE"
  ) {
    throw new Error("Child-care operations SODA must stay excluded");
  }
  if (
    value.enforcement.childCareExcluded["m5q4-3y3d"].publication !==
    "DELIBERATELY_EXCLUDED_CHILD_CARE_SOURCE"
  ) {
    throw new Error("Child-care inspection SODA must stay excluded");
  }
  if (value.childCareExclusion.datasets["bc5r-88dy"].row_count !== TX_LOCKED.childCareOperations) {
    throw new Error("Child-care operations exclusion count drifted");
  }
  if (value.cmsCounties.nursingHomes.length !== TX_LOCKED.cmsNhCounties) {
    throw new Error("CMS NH county coverage drifted");
  }
  if (value.enforcement.result !== "PARTIAL_SOURCE_COVERAGE") {
    throw new Error("State enforcement coverage must stay partial");
  }
  if (value.enforcement.inspectionFindings !== "SOURCE_NOT_ACQUIRED") {
    throw new Error("State inspection findings must stay not acquired");
  }
  return value;
}
