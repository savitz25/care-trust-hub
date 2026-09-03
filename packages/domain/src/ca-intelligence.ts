import { CA_PUBLIC_SNAPSHOT } from "./ca-public-snapshot";

export { CA_PUBLIC_SNAPSHOT };

export const CA_INTEL_VERSION = "senior-ca-state-intel-v1" as const;
export const CA_PUBLIC_FINGERPRINT =
  "13dd705e7d3e3896f4e8cb03fcae731d3a38bb3070b1943e84e9bd015b7879e0";
export const CA_PUBLIC_PATH = "/california";

export type CaPublicSnapshot = typeof CA_PUBLIC_SNAPSHOT;

export type CaCoverageState =
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "ACQUIRED_DATED_SNAPSHOT"
  | "PARTIAL_SOURCE_COVERAGE"
  | "RESEARCHED_NOT_PUBLISHED"
  | "NO_BULK_ACQUIRED";

export interface CaSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  rows: number | null;
  asOf: string | null;
  grain: string;
  identityKey: string;
  contactCoverage: string;
  statusCoverage: string;
  profileAttachment: string;
  coverage: CaCoverageState;
  limitations: string;
}

export interface CaTraceMetric {
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
  coverageState: CaCoverageState;
  caveat: string;
}

export const CA_LOCKED = {
  elmsRows: 15097,
  elmsActive: 13401,
  elmsOpen: 15097,
  elmsPhone: 13560,
  elmsEmail: 12435,
  elmsAddress: 15097,
  elmsTypes: 21,
  snf: 1186,
  homeHealth: 4137,
  hospice: 2114,
  hospiceFacility: 14,
  rcfeRows: 12522,
  rcfeLicensed: 7939,
  rcfeClosed: 3821,
  rcfePending: 739,
  rcfeOnProbation: 23,
  hcoRows: 3654,
  hcoLicensed: 2247,
  hcoClosed: 1197,
  hcoPending: 210,
  arfRows: 10498,
  hcaiRows: 10871,
  hcaiOpen: 10856,
  cmsNursingHomes: 1165,
  cmsHomeHealth: 3213,
  cmsHospice: 1913,
  liveHospiceCcn: 1822,
  snfExact: 1152,
  homeHealthExact: 1449,
  hospiceExact: 956,
  crosswalkRows: 15553,
  elmsHcaiExact: 14746,
  elmsCcnExact: 9632,
} as const;

export const CA_SOURCE_CATALOG: CaSourceCatalogRow[] = [
  {
    id: "cdph-elms",
    source: "CDPH ELMS healthcare facility locations",
    agency: "California Department of Public Health — Center for Health Care Quality",
    rows: CA_LOCKED.elmsRows,
    asOf: CA_PUBLIC_SNAPSHOT.elms.source_as_of,
    grain: "licensed/certified facility location (FACID)",
    identityKey: "FACID; CCN when source-native; LICENSE_NUMBER; HCAI_ID",
    contactCoverage: "phone 13,560 / email 12,435 / address 15,097 of 15,097",
    statusCoverage: "LICENSE_STATUS_DESCRIPTION and FAC_STATUS_TYPE_CODE",
    profileAttachment: "EXACT FACID or exact CCN only; no California profile routes minted here",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "OPEN facility status is not the same as ACTIVE license status. Not RCFE. Not summed with HCAI or CMS.",
  },
  {
    id: "ccld-rcfe",
    source: "CDSS CCLD Residential Care Facilities for the Elderly",
    agency: "California Department of Social Services — Community Care Licensing Division",
    rows: CA_LOCKED.rcfeRows,
    asOf: CA_PUBLIC_SNAPSHOT.rcfe.source_as_of,
    grain: "RCFE / CCRC facility (facility_number)",
    identityKey: "facility_number",
    contactCoverage: "phone and address present on the listing; no email field",
    statusCoverage: "LICENSED, CLOSED, PENDING, ON PROBATION",
    profileAttachment: "EXACT facility_number; RCFE is not a CMS CCN",
    coverage: "ACQUIRED_DATED_SNAPSHOT",
    limitations:
      "file_date 2025-05-25 is not a September 2026 current count. LICENSED is not CMS certified. RCFE is not SNF. ON PROBATION is not a quality score.",
  },
  {
    id: "ccld-hco",
    source: "CDSS CCLD Home Care Organization",
    agency: "California Department of Social Services — Community Care Licensing Division",
    rows: CA_LOCKED.hcoRows,
    asOf: CA_PUBLIC_SNAPSHOT.hco.source_as_of,
    grain: "home care organization (facility_number)",
    identityKey: "facility_number",
    contactCoverage: "phone and address on the listing; no email field",
    statusCoverage: "LICENSED / CLOSED / PENDING in this extract",
    profileAttachment: "EXACT facility_number; not a Home Health CCN",
    coverage: "ACQUIRED_DATED_SNAPSHOT",
    limitations: "HOME CARE ORGANIZATION is not a Home Health Agency. Same May 2025 CCLD clock.",
  },
  {
    id: "hcai-listing",
    source: "HCAI current healthcare facility listing",
    agency: "Department of Health Care Access and Information",
    rows: CA_LOCKED.hcaiRows,
    asOf: CA_PUBLIC_SNAPSHOT.hcai.source_as_of,
    grain: "HCAI facility listing (OSHPD_ID)",
    identityKey: "OSHPD_ID / PERM_ID / LICENSE_NUM",
    contactCoverage: "address only; no phone or email",
    statusCoverage: "FACILITY_STATUS_DESC",
    profileAttachment: "EXACT HCAI ID via official crosswalk only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "HCAI record is not a unique new provider. Do not add to CDPH or CCLD.",
  },
  {
    id: "cms-nh",
    source: "CMS Nursing Home Provider Information (CA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CA_LOCKED.cmsNursingHomes,
    asOf: CA_PUBLIC_SNAPSHOT.cmsOverlay.asOf,
    grain: "CMS Nursing Home CCN in California geography",
    identityKey: "CMS CCN",
    contactCoverage: "federal directory; not used as CA state contact",
    statusCoverage: "current CMS directory identity",
    profileAttachment: "existing national CCN routes only on exact CCN",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Not summed with CDPH SNF rows. CDPH != CMS.",
  },
  {
    id: "cms-hha",
    source: "CMS Home Health Care Agencies (CA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CA_LOCKED.cmsHomeHealth,
    asOf: CA_PUBLIC_SNAPSHOT.cmsOverlay.asOf,
    grain: "CMS Home Health CCN; office is not a service area",
    identityKey: "CMS Home Health CCN",
    contactCoverage: "federal directory",
    statusCoverage: "current CMS directory identity",
    profileAttachment: "exact CCN only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations: "Office geography is not a service area. Not a CCLD Home Care Organization.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (CA overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    rows: CA_LOCKED.cmsHospice,
    asOf: CA_PUBLIC_SNAPSHOT.cmsOverlay.asOf,
    grain: "CMS Hospice CCN",
    identityKey: "CMS Hospice CCN",
    contactCoverage: "federal directory",
    statusCoverage: "current CMS directory identity",
    profileAttachment: "exact CCN only",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    limitations:
      "National overlay count (1,913) and the live downloaded CA CCN set (1,822) are reported separately. Not a CDPH Hospice row total.",
  },
  {
    id: "state-enforcement",
    source: "CDPH / CCLD structured enforcement extract",
    agency: "CDPH / CDSS CCLD",
    rows: null,
    asOf: null,
    grain: "not acquired",
    identityKey: "none in this snapshot",
    contactCoverage: "n/a",
    statusCoverage: "n/a",
    profileAttachment: "none",
    coverage: "NO_BULK_ACQUIRED",
    limitations:
      "No official structured statewide enforcement CSV was acquired in the easy-win pass. Missing is unknown, not zero. CMS federal inspection evidence remains on CMS class profiles.",
  },
];

export function caTraceMetrics(snapshot: CaPublicSnapshot = CA_PUBLIC_SNAPSHOT): CaTraceMetric[] {
  const elms = snapshot.elms;
  const rcfe = snapshot.rcfe;
  const cms = snapshot.cmsOverlay;
  const snf = snapshot.crosswalk.snf;
  return [
    {
      id: "elms-rows",
      label: "CDPH ELMS location rows",
      display: elms.source_row_count.toLocaleString("en-US"),
      value: elms.source_row_count,
      source: elms.source_url,
      sourceDate: elms.source_as_of,
      sourceGrain: "ELMS facility location row (FACID)",
      numerator: elms.source_row_count,
      denominator: elms.source_row_count,
      computation: "Count of rows in the official ELMS locations dump.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not added to RCFE, HCAI, or CMS. Not a combined California senior-provider total.",
    },
    {
      id: "elms-active",
      label: "ELMS LICENSE_STATUS ACTIVE",
      display: elms.activeLicenseStatus.toLocaleString("en-US"),
      value: elms.activeLicenseStatus,
      source: elms.source_url,
      sourceDate: elms.source_as_of,
      sourceGrain: "LICENSE_STATUS_DESCRIPTION = ACTIVE",
      numerator: elms.activeLicenseStatus,
      denominator: elms.source_row_count,
      computation: "Rows whose LICENSE_STATUS_DESCRIPTION is exactly ACTIVE.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "OPEN facility status is not the same as ACTIVE license status unless the source says so.",
    },
    {
      id: "elms-phone",
      label: "ELMS rows with a facility phone",
      display: `${elms.contact_fields.phone.present.toLocaleString("en-US")} (${elms.phonePct}%)`,
      value: elms.contact_fields.phone.present,
      source: elms.source_url,
      sourceDate: elms.source_as_of,
      sourceGrain: "non-empty CONTACT_PHONE_NUMBER",
      numerator: elms.contact_fields.phone.present,
      denominator: elms.source_row_count,
      computation: "Non-empty CONTACT_PHONE_NUMBER divided by ELMS rows.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Facility contact from California state record. Not a TrustHub endorsement and not an administrator personal directory.",
    },
    {
      id: "elms-email",
      label: "ELMS rows with a facility email",
      display: `${elms.contact_fields.email.present.toLocaleString("en-US")} (${elms.emailPct}%)`,
      value: elms.contact_fields.email.present,
      source: elms.source_url,
      sourceDate: elms.source_as_of,
      sourceGrain: "non-empty CONTACT_EMAIL",
      numerator: elms.contact_fields.email.present,
      denominator: elms.source_row_count,
      computation:
        "Non-empty CONTACT_EMAIL divided by ELMS rows. Administrator names are withheld.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Public facility email is not a personal email harvest.",
    },
    {
      id: "rcfe-licensed",
      label: "CCLD RCFE LICENSED rows",
      display: rcfe.licensed.toLocaleString("en-US"),
      value: rcfe.licensed,
      source: rcfe.source_url,
      sourceDate: rcfe.source_as_of,
      sourceGrain: "facility_status = LICENSED",
      numerator: rcfe.licensed,
      denominator: rcfe.source_row_count,
      computation: "Rows whose facility_status is exactly LICENSED.",
      coverageState: "ACQUIRED_DATED_SNAPSHOT",
      caveat:
        "As of 2025-05-25. Not a current September 2026 count. LICENSED is not CMS certified. RCFE is not SNF.",
    },
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in California (overlay)",
      display: cms.nursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.source,
      sourceDate: cms.asOf,
      sourceGrain: "CMS Nursing Home CCN with state = CA",
      numerator: cms.nursingHomes,
      denominator: cms.nursingHomes,
      computation: "Canonical national CMS Nursing Home directory identities in California.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not summed with CDPH SNF. Exact joins require a source-native CCN.",
    },
    {
      id: "snf-ccn-exact",
      label: "Exact CDPH SNF CCN matches to CMS Nursing Homes",
      display: String(snf.exact_matches),
      value: snf.exact_matches,
      source: "ELMS CCN padded to 6 digits ∩ CMS NH CA CCN set",
      sourceDate: elms.source_as_of,
      sourceGrain: "exact CCN",
      numerator: snf.exact_matches,
      denominator: snf.source_native_ccns,
      computation:
        "Intersection of distinct padded ELMS CCN values on SKILLED NURSING FACILITY rows with the live CMS Nursing Home CA CCN set. Name and city are not used.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Unmatched CDPH and unmatched CMS remain unmatched. No name-only attachment.",
    },
  ];
}

export function assertCaIntelligence(
  value: CaPublicSnapshot = CA_PUBLIC_SNAPSHOT,
): CaPublicSnapshot {
  if (value.version !== CA_INTEL_VERSION) {
    throw new Error(`Unexpected California contract ${value.version}`);
  }
  if (value.fingerprint !== CA_PUBLIC_FINGERPRINT) {
    throw new Error("California public snapshot fingerprint drifted");
  }
  if (value.elms.source_row_count !== CA_LOCKED.elmsRows) {
    throw new Error("ELMS row count drifted");
  }
  if (value.elms.activeLicenseStatus !== CA_LOCKED.elmsActive) {
    throw new Error("ELMS ACTIVE count drifted");
  }
  if (value.elms.openFacStatus !== CA_LOCKED.elmsOpen) {
    throw new Error("ELMS OPEN count drifted");
  }
  if (value.elms.contact_fields.phone.present !== CA_LOCKED.elmsPhone) {
    throw new Error("ELMS phone count drifted");
  }
  if (value.elms.contact_fields.email.present !== CA_LOCKED.elmsEmail) {
    throw new Error("ELMS email count drifted");
  }
  if (value.elms.snf !== CA_LOCKED.snf || value.elms.homeHealth !== CA_LOCKED.homeHealth) {
    throw new Error("ELMS SNF/Home Health counts drifted");
  }
  if (value.elms.hospice !== CA_LOCKED.hospice) {
    throw new Error("ELMS Hospice count drifted");
  }
  if (value.elms.byType.length !== CA_LOCKED.elmsTypes) {
    throw new Error("ELMS source types must stay uncombined");
  }
  const typeSum = value.elms.byType.reduce((sum, row) => sum + row.count, 0);
  if (typeSum !== value.elms.source_row_count) {
    throw new Error("ELMS type counts must sum to ELMS rows");
  }
  if (
    value.rcfe.source_row_count !== CA_LOCKED.rcfeRows ||
    value.rcfe.licensed !== CA_LOCKED.rcfeLicensed ||
    value.rcfe.closed !== CA_LOCKED.rcfeClosed ||
    value.rcfe.pending !== CA_LOCKED.rcfePending ||
    value.rcfe.onProbation !== CA_LOCKED.rcfeOnProbation
  ) {
    throw new Error("RCFE status counts drifted");
  }
  if (
    value.rcfe.licensed + value.rcfe.closed + value.rcfe.pending + value.rcfe.onProbation !==
    value.rcfe.source_row_count
  ) {
    throw new Error("RCFE status counts must sum to RCFE rows");
  }
  if (value.rcfe.source_as_of !== "2025-05-25") {
    throw new Error("RCFE source clock must stay 2025-05-25");
  }
  if (value.hco.source_row_count !== CA_LOCKED.hcoRows) {
    throw new Error("HCO row count drifted");
  }
  if (value.arf.source_row_count !== CA_LOCKED.arfRows) {
    throw new Error("Adult Residential row count drifted");
  }
  if (value.arf.publication_eligibility !== "RESEARCHED_NOT_PUBLISHED") {
    throw new Error("Adult Residential must stay unpublished as a senior universe");
  }
  if (
    value.hcai.source_row_count !== CA_LOCKED.hcaiRows ||
    value.hcai.open !== CA_LOCKED.hcaiOpen
  ) {
    throw new Error("HCAI counts drifted");
  }
  if (value.cmsOverlay.nursingHomes !== CA_LOCKED.cmsNursingHomes) {
    throw new Error("CMS NH overlay drifted");
  }
  if (value.crosswalk.snf.exact_matches !== CA_LOCKED.snfExact) {
    throw new Error("SNF exact CCN matches drifted");
  }
  return value;
}
