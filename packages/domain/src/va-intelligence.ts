import { VA_PUBLIC_SNAPSHOT } from "./va-public-snapshot";

export { VA_PUBLIC_SNAPSHOT };

export const VA_INTEL_VERSION = "senior-va-state-intel-v1" as const;
export const VA_PUBLIC_FINGERPRINT =
  "c98e5373d60c765690f03493e0c1fd85d4b24f2c4693fb964abd27b5d5d73d68";
export const VA_PUBLIC_PATH = "/virginia";

export type VaPublicSnapshot = typeof VA_PUBLIC_SNAPSHOT;

export type VaCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "OPEN_SEARCH_ONLY"
  | "NO_BULK_ACQUIRED"
  | "PUBLIC_RESEARCH_PATH";

export interface VaSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  rows: number | null;
  asOf: string | null;
  grain: string;
  identityKey: string;
  access: string;
  publication: string;
  coverage: VaCoverageState;
  limitations: string;
}

export interface VaTraceMetric {
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
  coverageState: VaCoverageState;
  caveat: string;
}

export const VA_LOCKED = {
  alfCount: 573,
  alfCapacity: 38010,
  alfInspections: 7032,
  alfComplaintRelated: 2488,
  alfViolationYes: 4066,
  alfFacilitiesWithInspections: 571,
  adcCount: 82,
  adcInspections: 615,
  cmsNursingHomes: 289,
  cmsHomeHealth: 237,
  cmsHospice: 110,
  netNewCanonical: 0,
  netNewProfiles: 0,
  exactCrosswalks: 0,
  overlayAsOf: "2026-08-27",
  snapshotAsOf: "2026-09-10",
} as const;

export const VA_SOURCE_CATALOG: VaSourceCatalogRow[] = [
  {
    id: "dss-alf",
    source: "Virginia DSS Assisted Living Facility Search",
    agency: "Virginia Department of Social Services / DOLP",
    rows: VA_LOCKED.alfCount,
    asOf: null,
    grain: "licensed Assisted Living Facility; VA-DSS-ALF:{licenseId}",
    identityKey: "DSS licenseId",
    access: "Official paginated search JSON + licenseId detail",
    publication: "Statewide research counts on /virginia; no claimable ALF profiles",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "ALF != nursing home. licenseId != CMS CCN. Licensed capacity != occupancy. 1YR/2YR/3YR/COND/PROV != quality. Qualifications != ratings. SourceAsOf is unknown.",
  },
  {
    id: "dss-alf-inspections",
    source: "Virginia DSS ALF inspection observations",
    agency: "Virginia Department of Social Services / DOLP",
    rows: VA_LOCKED.alfInspections,
    asOf: null,
    grain: "one DSS inspection row = one observation",
    identityKey: "inspectionNumber on a licenseId",
    access: "Same official detail JSON as the ALF universe",
    publication: "Observation counts only; violation PDFs not harvested",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "Inspection != deficiency count. Complaint-related (complaintNumber != 0) != substantiated complaint. Violations=Y != number of violations. No-violation shown != perfect facility.",
  },
  {
    id: "dss-adc",
    source: "Virginia DSS Adult Day Center Search",
    agency: "Virginia Department of Social Services / DOLP",
    rows: VA_LOCKED.adcCount,
    asOf: null,
    grain: "licensed Adult Day Center; VA-DSS-ADC:{licenseId}",
    identityKey: "DSS licenseId",
    access: "Same search architecture as ALF, endpoint=adc",
    publication: "Separate class on /virginia. Not added to ALF or CMS.",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Adult Day != Assisted Living. Adult Day != Nursing Home.",
  },
  {
    id: "cms-nh",
    source: "CMS Nursing Home Provider Information (VA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: VA_LOCKED.cmsNursingHomes,
    asOf: VA_LOCKED.overlayAsOf,
    grain: "CMS Nursing Home CCN in Virginia geography",
    identityKey: "CMS CCN",
    access: "Accepted national geography partition / Provider Data Catalog",
    publication: "Existing national CCN routes only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Not summed with DSS ALF or Adult Day. CMS CERTIFIED != STATE LICENSED.",
  },
  {
    id: "cms-hha",
    source: "CMS Home Health Care Agencies (VA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: VA_LOCKED.cmsHomeHealth,
    asOf: VA_LOCKED.overlayAsOf,
    grain: "CMS Home Health CCN",
    identityKey: "CMS Home Health CCN",
    access: "Accepted national geography partition / Provider Data Catalog",
    publication: "Existing national Home Health CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "No trivial VDH HCO bulk roster acquired. Office geography is not a service area.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (VA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: VA_LOCKED.cmsHospice,
    asOf: VA_LOCKED.overlayAsOf,
    grain: "CMS Hospice CCN",
    identityKey: "CMS Hospice CCN",
    access: "Accepted national geography partition / Provider Data Catalog",
    publication: "Existing national Hospice CCN routes",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HOSPICE != HOME HEALTH. Do not infer a VDH hospice license solely from CMS.",
  },
  {
    id: "vdh-nh-portal",
    source: "VDH Nursing Home Informational Portal",
    agency: "Virginia Department of Health / OLC",
    rows: null,
    asOf: null,
    grain: "interactive nursing-home portal",
    identityKey: "VDH facility identity on a looked-up record",
    access: "OPEN_SEARCH_ONLY",
    publication: "Verification link only",
    coverage: "OPEN_SEARCH_ONLY",
    limitations: "Search-only is not zero. CMS already supplies the nursing-home backbone.",
  },
];

export function vaTraceMetrics(snapshot: VaPublicSnapshot = VA_PUBLIC_SNAPSHOT): VaTraceMetric[] {
  return [
    {
      id: "dss-alf-count",
      label: "Licensed Virginia DSS Assisted Living Facilities",
      display: VA_LOCKED.alfCount.toLocaleString("en-US"),
      value: VA_LOCKED.alfCount,
      source: "VDSS DOLP Assisted Living Facility Search JSON",
      sourceDate: null,
      sourceGrain: "licensed ALF; VA-DSS-ALF:{licenseId}",
      numerator: VA_LOCKED.alfCount,
      denominator: VA_LOCKED.alfCount,
      computation:
        "Count distinct licenseId values in the official licensedFacilities list where pagination.total equals detail count (573 = 573).",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not unique businesses by another key. Not nursing homes. Not occupancy.",
    },
    {
      id: "dss-alf-capacity",
      label: "Licensed ALF capacity (sum of source capacity fields)",
      display: VA_LOCKED.alfCapacity.toLocaleString("en-US"),
      value: VA_LOCKED.alfCapacity,
      source: "VDSS DOLP facilityLicense.capacity",
      sourceDate: null,
      sourceGrain: "licensed capacity, not current occupancy",
      numerator: VA_LOCKED.alfCapacity,
      denominator: VA_LOCKED.alfCount,
      computation:
        "Sum facilityLicense.capacity across all 573 licensed ALF details. None missing.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Licensed capacity is not occupancy and is not a quality measure.",
    },
    {
      id: "dss-alf-inspections",
      label: "ALF inspection observations",
      display: VA_LOCKED.alfInspections.toLocaleString("en-US"),
      value: VA_LOCKED.alfInspections,
      source: "VDSS DOLP inspectionsList",
      sourceDate: null,
      sourceGrain: "one inspection row = one observation",
      numerator: VA_LOCKED.alfInspections,
      denominator: VA_LOCKED.alfCount,
      computation:
        "Count inspectionsList rows across 573 ALF details. 571 facilities returned at least one observation.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Not a deficiency count. Two facilities returned zero inspection rows — unknown, not zero guilt.",
    },
    {
      id: "dss-alf-complaint-related",
      label: "Complaint-related inspection observations",
      display: VA_LOCKED.alfComplaintRelated.toLocaleString("en-US"),
      value: VA_LOCKED.alfComplaintRelated,
      source: "inspectionsList.complaintNumber != 0",
      sourceDate: null,
      sourceGrain: "inspection observation with a non-zero complaintNumber",
      numerator: VA_LOCKED.alfComplaintRelated,
      denominator: VA_LOCKED.alfInspections,
      computation: "Count inspection rows whose complaintNumber is not 0.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Complaint-related inspection is not a substantiated complaint and is not a TrustHub score.",
    },
    {
      id: "dss-alf-violation-flag",
      label: "Inspection observations with violations=Y",
      display: VA_LOCKED.alfViolationYes.toLocaleString("en-US"),
      value: VA_LOCKED.alfViolationYes,
      source: "inspectionsList.violations",
      sourceDate: null,
      sourceGrain: "source Yes/No flag, not a violation count",
      numerator: VA_LOCKED.alfViolationYes,
      denominator: VA_LOCKED.alfInspections,
      computation: "Count inspection rows where violations is Y.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Y is not the number of violations. N is not a perfect facility.",
    },
    {
      id: "dss-adc-count",
      label: "Licensed Virginia DSS Adult Day Centers",
      display: VA_LOCKED.adcCount.toLocaleString("en-US"),
      value: VA_LOCKED.adcCount,
      source: "VDSS DOLP Adult Day Center Search JSON",
      sourceDate: null,
      sourceGrain: "licensed Adult Day Center",
      numerator: VA_LOCKED.adcCount,
      denominator: VA_LOCKED.adcCount,
      computation: "Count distinct licenseId values in the official ADC licensedFacilities list.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Adult Day is not Assisted Living and is not a Nursing Home.",
    },
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in Virginia",
      display: VA_LOCKED.cmsNursingHomes.toLocaleString("en-US"),
      value: VA_LOCKED.cmsNursingHomes,
      source: "CMS Nursing Home Provider Information geography VA",
      sourceDate: snapshot.cmsOverlay.clocks.nursingHomes.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Nursing Home CCN",
      numerator: VA_LOCKED.cmsNursingHomes,
      denominator: null,
      computation: "Accepted national geography partition for state=VA.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Already in national CMS totals. Not added again. Not DSS ALF.",
    },
    {
      id: "cms-hha-overlay",
      label: "CMS Home Health in Virginia",
      display: VA_LOCKED.cmsHomeHealth.toLocaleString("en-US"),
      value: VA_LOCKED.cmsHomeHealth,
      source: "CMS Home Health Care Agencies geography VA",
      sourceDate: snapshot.cmsOverlay.clocks.homeHealth.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Home Health CCN",
      numerator: VA_LOCKED.cmsHomeHealth,
      denominator: null,
      computation: "Accepted national geography partition for state=VA.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not a VDH Home Care Organization roster.",
    },
    {
      id: "cms-hospice-overlay",
      label: "CMS Hospice in Virginia",
      display: VA_LOCKED.cmsHospice.toLocaleString("en-US"),
      value: VA_LOCKED.cmsHospice,
      source: "CMS Hospice General Information geography VA",
      sourceDate: snapshot.cmsOverlay.clocks.hospice.sourceModifiedAt?.slice(0, 10) ?? null,
      sourceGrain: "CMS Hospice CCN",
      numerator: VA_LOCKED.cmsHospice,
      denominator: null,
      computation: "Accepted national geography partition for state=VA.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not a VDH hospice license roster.",
    },
    {
      id: "net-new-profiles",
      label: "Net-new public / claimable profiles",
      display: "0",
      value: 0,
      source: "VA-SEN-001 publication contract",
      sourceDate: VA_LOCKED.snapshotAsOf,
      sourceGrain: "claimable profile",
      numerator: 0,
      denominator: 0,
      computation: "State research identities are not public profiles and are not claimable.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Do not treat 573 ALF identities as 573 claimable organizations.",
    },
  ];
}

export function assertVaIntelligence(
  value: VaPublicSnapshot = VA_PUBLIC_SNAPSHOT,
): VaPublicSnapshot {
  if (value.version !== VA_INTEL_VERSION) {
    throw new Error("Virginia snapshot version mismatch");
  }
  if (value.fingerprint !== VA_PUBLIC_FINGERPRINT) {
    throw new Error("Virginia snapshot fingerprint mismatch");
  }
  if (value.dssAlf.licensedFacilityCount !== VA_LOCKED.alfCount) {
    throw new Error("ALF count mismatch");
  }
  if (value.dssAlf.licensedCapacitySum !== VA_LOCKED.alfCapacity) {
    throw new Error("ALF capacity mismatch");
  }
  if (value.dssAlfInspections.observationCount !== VA_LOCKED.alfInspections) {
    throw new Error("ALF inspection count mismatch");
  }
  if (value.dssAlfInspections.complaintRelatedObservations !== VA_LOCKED.alfComplaintRelated) {
    throw new Error("Complaint-related inspection count mismatch");
  }
  if (value.dssAlfInspections.violationFlagYes !== VA_LOCKED.alfViolationYes) {
    throw new Error("Violation-flag count mismatch");
  }
  if (value.dssAdc.licensedFacilityCount !== VA_LOCKED.adcCount) {
    throw new Error("ADC count mismatch");
  }
  if (value.cmsOverlay.nursingHomes !== VA_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay mismatch");
  }
  if (value.cmsOverlay.homeHealth !== VA_LOCKED.cmsHomeHealth) {
    throw new Error("CMS HHA overlay mismatch");
  }
  if (value.cmsOverlay.hospice !== VA_LOCKED.cmsHospice) {
    throw new Error("CMS Hospice overlay mismatch");
  }
  if (value.dssAlf.notNursingHome !== true || value.dssAlf.notCmsCcn !== true) {
    throw new Error("ALF must stay distinct from nursing homes and CMS CCN");
  }
  if (value.dssAlfInspections.complaintRelatedIsNotSubstantiatedComplaint !== true) {
    throw new Error("Complaint-related must not mean substantiated complaint");
  }
  if (value.dssAlfInspections.violationFlagIsNotViolationCount !== true) {
    throw new Error("Violation flag must not mean violation count");
  }
  if (value.dssAlf.capacityGrain !== "licensed_capacity_not_occupancy") {
    throw new Error("Capacity must stay licensed-capacity grain");
  }
  if (value.dssAlf.licenseTypeIsNotQuality !== true) {
    throw new Error("License type must not be treated as quality");
  }
  if (value.sourceAsOf !== null || value.sourceAsOfState !== "UNKNOWN") {
    throw new Error("DSS sourceAsOf must remain unknown");
  }
  if (value.crosswalk.alfToCmsNh.attempted !== false) {
    throw new Error("ALF must not be joined to CMS Nursing Homes");
  }
  if (value.crosswalk.nameOnlyJoins !== "UNSAFE") {
    throw new Error("Name-only joins must stay unsafe");
  }
  if (value.expansionLedger.NET_NEW_CANONICAL_FACILITIES !== 0) {
    throw new Error("Do not mint canonical facilities from DSS research identities");
  }
  if (value.expansionLedger.NET_NEW_PUBLIC_PROFILES !== 0) {
    throw new Error("Do not mint claimable ALF profiles");
  }
  if (value.publication.claimableAlfProfiles !== false) {
    throw new Error("Claimable ALF profiles are forbidden");
  }
  if (value.claimEligibility.broadened !== false) {
    throw new Error("VA-SEN-001 must not broaden claim eligibility");
  }
  if (value.noCombinedDenominator !== true) {
    throw new Error("Combined Virginia senior-provider denominator is forbidden");
  }
  if (value.noTrustScore !== true || value.noRanking !== true || value.noAggregateRating !== true) {
    throw new Error("Virginia page must not publish a Trust Score, ranking, or AggregateRating");
  }
  if (value.publicationPath !== VA_PUBLIC_PATH) {
    throw new Error("Virginia publication path must be /virginia");
  }
  if (
    value.noCountyRoutes !== true ||
    value.noCityRoutes !== true ||
    value.statewideOnly !== true
  ) {
    throw new Error("Virginia local routes are forbidden");
  }
  if (value.unknownIsNotZero !== true) {
    throw new Error("Unknown must not be published as zero");
  }
  const combined =
    VA_LOCKED.alfCount +
    VA_LOCKED.adcCount +
    VA_LOCKED.cmsNursingHomes +
    VA_LOCKED.cmsHomeHealth +
    VA_LOCKED.cmsHospice;
  if (JSON.stringify(value).includes(`virginiaSeniorProviders":${combined}`)) {
    throw new Error("Combined Virginia senior-provider total leaked");
  }
  return value;
}
