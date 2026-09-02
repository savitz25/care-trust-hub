import { NJ_PUBLIC_SNAPSHOT } from "./nj-public-snapshot";

export const NJ_INTEL_VERSION = "nj-sen-005-public-v1" as const;
export const NJ_PUBLIC_FINGERPRINT =
  "92e0742f77f2f55a5ccd6217c5caa779f3281fd26b1d91c14e2df11ae144011a";
export const NJ_PUBLIC_PATH = "/new-jersey";

export type NjPublicSnapshot = typeof NJ_PUBLIC_SNAPSHOT;
export type NjIdentityLinkage = "exact" | "partial" | "unavailable";
export type NjCoverageState =
  | "ACQUIRED_COMPLETE"
  | "ACQUIRED_CURRENT_SNAPSHOT"
  | "ACQUIRED_PARTIAL_HISTORY"
  | "SOURCE_ACCESS_BLOCKED"
  | "SOURCE_AVAILABLE_BY_REQUEST"
  | "PARTIAL_SOURCE_COVERAGE"
  | "SOURCE_NOT_PUBLIC_AT_FIRM_GRAIN"
  | "Unknown"
  | "source unavailable"
  | "partial coverage";

export interface NjSourceCatalogRow {
  id: string;
  source: string;
  agency: string;
  asOf: string | null;
  grain: string;
  coverage: NjCoverageState;
  identityLinkage: NjIdentityLinkage;
  notes: string;
}

export interface NjTraceMetric {
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
  coverageState: NjCoverageState;
  caveat: string;
}

export type NjProfileMatch =
  | "EXACT"
  | "HIGH_CONFIDENCE"
  | "REVIEW_REQUIRED"
  | "UNRESOLVED"
  | "NONE";

export interface NjProfileAttachment {
  match: "EXACT" | "HIGH_CONFIDENCE";
  kind: "license_identity" | "regulatory" | "staffing" | "source_information";
  ccn?: string;
  facId?: string;
  licenseNumber?: string;
  label: string;
  detail: string;
  adverse: boolean;
}

export interface NjProfileEvidence {
  match: NjProfileMatch;
  attachments: NjProfileAttachment[];
  withheldReviewOrUnresolved: number;
  render: boolean;
}

export const NJ_LOCKED = {
  ltcRows: 893,
  ltcTypes: 19,
  ltcCounties: 21,
  acuteRows: 1430,
  acuteTypes: 26,
  hha: 39,
  hospiceProgram: 68,
  hospiceBranch: 27,
  hospiceInpatient: 9,
  acuteOther: 1287,
  inventoryRows: 2323,
  staffingQuarters: 30,
  staffingLatest: "2026 Q2",
  medicaidRows: 236,
  medicaidMin: 81.1,
  medicaidMax: 126.1,
  paceOrganizations: 8,
  paceOperatingOrganizations: 6,
  paceAwardedOrganizations: 2,
  paceOperatingCenters: 10,
  cmsNursingHomes: 348,
  cmsHomeHealth: 38,
  cmsHospice: 61,
  enforcementIndexed: 1146,
  enforcementDownloaded: 1144,
  enforcementUniqueHashes: 1131,
  enforcementExact: 300,
  enforcementHighConfidence: 76,
  enforcementReviewRequired: 3,
  enforcementUnsafeRejected: 291,
  enforcementUnresolved: 476,
  enforcementExactFacilities: 224,
} as const;

const LTC_TYPE_KEYS = [
  "NJ_NF_SNF",
  "NJ_NF_SNF_HOME_FOR_AGED",
  "NJ_NF_SNF_DP",
  "NJ_NF_SNF_HOSPITAL",
  "NJ_NF_SNF_SUBACUTE_HOSPITAL",
  "NJ_LTC_UNSPECIFIED",
  "NJ_LTC_PRIV",
  "NJ_LTC_PRIV_HOME_FOR_AGED",
  "NJ_ALR",
  "NJ_CPCH",
  "NJ_ALP",
  "NJ_RHCF_IN_LTC",
  "NJ_RDCH",
  "NJ_ADHS",
  "NJ_PDHS",
  "NJ_ADHS_IN_LTC",
  "NJ_ADHS_HOSPITAL",
  "NJ_ADHS_IN_ALR",
  "NJ_AFC",
] as const;

export const NJ_LTC_TYPE_KEYS = LTC_TYPE_KEYS;

export const NJ_SOURCE_CATALOG: NjSourceCatalogRow[] = [
  {
    id: "njdoh-all-ltc",
    source: "NJDOH All_LTC.xlsx",
    agency: "New Jersey Department of Health",
    asOf: NJ_PUBLIC_SNAPSHOT.ltcAsOf,
    grain: "licensed long-term-care facility identity (FacID and license kept separate)",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    identityLinkage: "exact",
    notes: "Current All_LTC workbook. FacID is not a license number. 19 official types preserved.",
  },
  {
    id: "njdoh-all-acute",
    source: "NJDOH All_Acute.xlsx",
    agency: "New Jersey Department of Health",
    asOf: NJ_PUBLIC_SNAPSHOT.acuteAsOf,
    grain: "licensed acute-care facility identity; office county is not a service area",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    identityLinkage: "exact",
    notes:
      "Home Health Agency, Hospice Program, Hospice Branch, and Hospice Inpatient stay separate. 26 official types preserved.",
  },
  {
    id: "njdoh-enforcement",
    source: "NJDOH enforcement document corpus",
    agency: "New Jersey Department of Health",
    asOf: NJ_PUBLIC_SNAPSHOT.asOf,
    grain: "document occurrence; occurrence is not a canonical unique document",
    coverage: "ACQUIRED_PARTIAL_HISTORY",
    identityLinkage: "partial",
    notes:
      "Exact FacID/license matches may attach to profiles. Unresolved, review-required, and unsafe-rejected documents are not facility-attached.",
  },
  {
    id: "njdoh-staffing",
    source: "NJDOH quarterly staffing HTML reports",
    agency: "New Jersey Department of Health",
    asOf: NJ_PUBLIC_SNAPSHOT.staffing.latest,
    grain: "statewide and nursing-facility quarterly residents-per-staff-member ratios",
    coverage: "ACQUIRED_PARTIAL_HISTORY",
    identityLinkage: "partial",
    notes:
      "Official values are 1RN:#Res (residents per one staff member). Missing quarters are not zero. Not copied to ALR, CPCH, ALP, Home Health, Hospice, PACE, or CCRC.",
  },
  {
    id: "njmmis-al-rates",
    source: "NJMMIS SFY 2026 Assisted Living Rates PDF",
    agency: "New Jersey Medicaid (NJMMIS)",
    asOf: NJ_PUBLIC_SNAPSHOT.medicaid.effectiveOn,
    grain: "listed daily rate row on the official schedule",
    coverage: "PARTIAL_SOURCE_COVERAGE",
    identityLinkage: "partial",
    notes:
      "A listed rate is not Medicaid participation elsewhere and is not a quality score. Name-only rows are not profile-attached. Default unlisted rates do not create participation.",
  },
  {
    id: "doas-pace",
    source: "NJ DoAS PACE page",
    agency: "New Jersey Division of Aging Services",
    asOf: NJ_PUBLIC_SNAPSHOT.asOf,
    grain: "PACE organization and center; service geography as published",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    identityLinkage: "exact",
    notes:
      "Organization is not a center. Operating is not awarded. Center address is not a full service area. Partial counties stay partial.",
  },
  {
    id: "cms-nursing-homes",
    source: "CMS Nursing Home Provider Information (NJ geography overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    asOf: NJ_PUBLIC_SNAPSHOT.cmsOverlay.asOf,
    grain: "CMS CCN in the current Nursing Home directory",
    coverage: "ACQUIRED_CURRENT_SNAPSHOT",
    identityLinkage: "unavailable",
    notes:
      "Independent CMS class overlay. Not summed with All_LTC. Exact NJDOH↔CMS joins are not in this snapshot.",
  },
  {
    id: "cms-home-health",
    source: "CMS Home Health Care Agencies (NJ geography overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    asOf: NJ_PUBLIC_SNAPSHOT.cmsOverlay.asOf,
    grain: "CMS Home Health CCN; office is not a service area",
    coverage: "partial coverage",
    identityLinkage: "unavailable",
    notes: "CMS Home Health crosswalk to NJDOH All_Acute rows remains incomplete.",
  },
  {
    id: "cms-hospice",
    source: "CMS Hospice General Information (NJ geography overlay)",
    agency: "Centers for Medicare & Medicaid Services",
    asOf: NJ_PUBLIC_SNAPSHOT.cmsOverlay.asOf,
    grain: "CMS Hospice CCN; not a Hospice Branch inheritance",
    coverage: "partial coverage",
    identityLinkage: "unavailable",
    notes:
      "CMS Hospice crosswalk to NJDOH Program/Branch/Inpatient rows remains incomplete. Branches do not inherit a CCN from a program.",
  },
  {
    id: "ccrc-framework",
    source: "New Jersey CCRC Certificate of Authority roster",
    agency: "New Jersey CCRC regulator",
    asOf: null,
    grain: "Certificate of Authority identity",
    coverage: "SOURCE_AVAILABLE_BY_REQUEST",
    identityLinkage: "unavailable",
    notes:
      "Complete CCRC roster is not in the acquired public files. Missing roster is unknown, not zero CCRCs.",
  },
];

export function njTraceMetrics(snapshot: NjPublicSnapshot = NJ_PUBLIC_SNAPSHOT): NjTraceMetric[] {
  const ltc = snapshot.ltc;
  const acute = snapshot.acute;
  const staffing = snapshot.staffing;
  const enforcement = snapshot.enforcement;
  const medicaid = snapshot.medicaid;
  const pace = snapshot.pace;
  const cms = snapshot.cmsOverlay;
  return [
    {
      id: "ltc-rows",
      label: "NJDOH All_LTC licensed identities",
      display: ltc.rows.toLocaleString("en-US"),
      value: ltc.rows,
      source: ltc.source,
      sourceDate: snapshot.ltcAsOf,
      sourceGrain: "All_LTC facility row",
      numerator: ltc.rows,
      denominator: ltc.rows,
      computation: "Count of current All_LTC identities after parse; quarantined rows excluded.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not added to All_Acute or CMS Nursing Homes. Not a senior-provider total.",
    },
    {
      id: "acute-rows",
      label: "NJDOH All_Acute licensed identities",
      display: acute.rows.toLocaleString("en-US"),
      value: acute.rows,
      source: acute.source,
      sourceDate: snapshot.acuteAsOf,
      sourceGrain: "All_Acute facility row",
      numerator: acute.rows,
      denominator: acute.rows,
      computation: "Count of current All_Acute identities after parse; quarantined rows excluded.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not added to All_LTC. Home Health and Hospice subclasses stay inside this universe.",
    },
    {
      id: "hha-offices",
      label: "NJDOH Home Health Agency offices",
      display: acute.hha.toLocaleString("en-US"),
      value: acute.hha,
      source: acute.source,
      sourceDate: snapshot.acuteAsOf,
      sourceGrain: "All_Acute type HOME HEALTH AGENCY",
      numerator: acute.hha,
      denominator: acute.rows,
      computation: "Rows whose canonical type is NJ_HHA.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Office county is not a service area.",
    },
    {
      id: "hospice-program",
      label: "NJDOH Hospice Care Program",
      display: acute.hospiceProgram.toLocaleString("en-US"),
      value: acute.hospiceProgram,
      source: acute.source,
      sourceDate: snapshot.acuteAsOf,
      sourceGrain: "All_Acute type HOSPICE CARE PROGRAM",
      numerator: acute.hospiceProgram,
      denominator: acute.rows,
      computation: "Rows whose canonical type is NJ_HOSPICE_PROGRAM.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Not a Hospice Branch and not inpatient hospice.",
    },
    {
      id: "staffing-latest-rn",
      label: `Statewide day RN residents per staff (${staffing.latest})`,
      display: String(staffing.trend[staffing.trend.length - 1]?.dayRn ?? "Unknown"),
      value: staffing.trend[staffing.trend.length - 1]?.dayRn ?? null,
      source: "NJDOH quarterly staffing HTML",
      sourceDate: staffing.latest,
      sourceGrain: "statewide day RN 1RN:#Res",
      numerator: null,
      denominator: null,
      computation:
        "Official statewide day RN residents-per-one-RN value. Not inverted to staff-per-resident.",
      coverageState: "ACQUIRED_PARTIAL_HISTORY",
      caveat: "A higher number means more residents per one RN. Missing quarters are not zero.",
    },
    {
      id: "enforcement-indexed",
      label: "NJDOH enforcement occurrences indexed",
      display: enforcement.indexed.toLocaleString("en-US"),
      value: enforcement.indexed,
      source: "NJDOH enforcement corpus (NJ-SEN-002)",
      sourceDate: snapshot.asOf,
      sourceGrain: "acquired document occurrence",
      numerator: enforcement.indexed,
      denominator: enforcement.indexed,
      computation: "Indexed occurrence count. Unique content hashes are a different metric.",
      coverageState: "ACQUIRED_PARTIAL_HISTORY",
      caveat: "Occurrence is not a canonical unique document. Not an enforcement ranking.",
    },
    {
      id: "medicaid-listed-rows",
      label: "NJMMIS listed assisted-living rate rows",
      display: medicaid.listedRows.toLocaleString("en-US"),
      value: medicaid.listedRows,
      source: medicaid.source,
      sourceDate: medicaid.effectiveOn,
      sourceGrain: "printed schedule row",
      numerator: medicaid.listedRows,
      denominator: medicaid.listedRows,
      computation: "Count of listed provider rows on the SFY 2026 schedule.",
      coverageState: "PARTIAL_SOURCE_COVERAGE",
      caveat: "Listed rate is not inferred Medicaid participation and is not a quality score.",
    },
    {
      id: "pace-organizations",
      label: "PACE organizations on the current DoAS listing",
      display: pace.organizations.toLocaleString("en-US"),
      value: pace.organizations,
      source: "NJ DoAS PACE page",
      sourceDate: snapshot.asOf,
      sourceGrain: "PACE organization",
      numerator: pace.operatingOrganizations,
      denominator: pace.organizations,
      computation: "Organizations on the current DoAS page. Operating and awarded stay separate.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: "Organization is not a center. Awarded is not operating.",
    },
    {
      id: "cms-nh-overlay",
      label: "CMS Nursing Homes in New Jersey (overlay)",
      display: cms.nursingHomes.toLocaleString("en-US"),
      value: cms.nursingHomes,
      source: cms.source,
      sourceDate: cms.asOf,
      sourceGrain: "CMS Nursing Home CCN in NJ geography",
      numerator: cms.nursingHomes,
      denominator: cms.nursingHomes,
      computation: "Current CMS Nursing Home directory identities with state = NJ.",
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat:
        "Not summed with All_LTC. Exact profile links require a CCN join that is not in this snapshot.",
    },
    {
      id: "ccrc-roster",
      label: "CCRC Certificate of Authority identities",
      display: "Unknown",
      value: null,
      source: "CCRC Certificate of Authority roster",
      sourceDate: null,
      sourceGrain: "Certificate of Authority",
      numerator: null,
      denominator: null,
      computation: "Not computed. Roster was not in the acquired public files.",
      coverageState: "SOURCE_AVAILABLE_BY_REQUEST",
      caveat: "Missing roster is unknown, not zero CCRCs.",
    },
  ];
}

export function assertNjIntelligence(value: NjPublicSnapshot): NjPublicSnapshot {
  if (value.version !== NJ_INTEL_VERSION) {
    throw new Error(`Unexpected New Jersey contract ${value.version}`);
  }
  if (!/^[0-9a-f]{64}$/.test(value.fingerprint)) {
    throw new Error("New Jersey snapshot fingerprint must be sha256 hex");
  }
  if (value.fingerprint !== NJ_PUBLIC_FINGERPRINT) {
    throw new Error("New Jersey public snapshot fingerprint drifted");
  }
  if (value.ltc.rows !== NJ_LOCKED.ltcRows || value.ltc.types !== NJ_LOCKED.ltcTypes) {
    throw new Error("All_LTC locked counts drifted");
  }
  if (value.ltc.byType.length !== NJ_LOCKED.ltcTypes) {
    throw new Error("All_LTC must preserve 19 official types");
  }
  const ltcTypeSum = value.ltc.byType.reduce((sum, row) => sum + row.count, 0);
  if (ltcTypeSum !== value.ltc.rows) {
    throw new Error("All_LTC type counts must sum to All_LTC rows");
  }
  if (value.acute.rows !== NJ_LOCKED.acuteRows || value.acute.types !== NJ_LOCKED.acuteTypes) {
    throw new Error("All_Acute locked counts drifted");
  }
  if (value.acute.byType.length !== NJ_LOCKED.acuteTypes) {
    throw new Error("All_Acute must preserve 26 official types");
  }
  if (
    value.acute.hha !== NJ_LOCKED.hha ||
    value.acute.hospiceProgram !== NJ_LOCKED.hospiceProgram ||
    value.acute.hospiceBranch !== NJ_LOCKED.hospiceBranch ||
    value.acute.hospiceInpatient !== NJ_LOCKED.hospiceInpatient
  ) {
    throw new Error("Home Health / Hospice subclass counts drifted");
  }
  if (
    value.acute.hha +
      value.acute.hospiceProgram +
      value.acute.hospiceBranch +
      value.acute.hospiceInpatient +
      value.acute.other !==
    value.acute.rows
  ) {
    throw new Error("Acute subclasses plus other must equal All_Acute rows");
  }
  if (value.counties.length !== NJ_LOCKED.ltcCounties) {
    throw new Error("County intelligence must cover all 21 New Jersey counties");
  }
  if (value.staffing.populatedQuarters !== NJ_LOCKED.staffingQuarters) {
    throw new Error("Staffing populated-quarter count drifted");
  }
  if (value.staffing.latest !== NJ_LOCKED.staffingLatest) {
    throw new Error("Latest staffing quarter drifted");
  }
  if (value.medicaid.listedRows !== NJ_LOCKED.medicaidRows) {
    throw new Error("Medicaid listed-row count drifted");
  }
  if (value.pace.organizations !== NJ_LOCKED.paceOrganizations) {
    throw new Error("PACE organization count drifted");
  }
  if (value.pace.operatingOrganizations !== NJ_LOCKED.paceOperatingOrganizations) {
    throw new Error("Operating PACE organization count drifted");
  }
  if (value.pace.awardedOrganizations !== NJ_LOCKED.paceAwardedOrganizations) {
    throw new Error("Awarded PACE organization count drifted");
  }
  if (value.ccrc.countPublished !== null) {
    throw new Error("Missing CCRC roster must stay unknown, not a published zero");
  }
  if (value.cmsOverlay.nursingHomes !== NJ_LOCKED.cmsNursingHomes) {
    throw new Error("CMS Nursing Home overlay drifted");
  }
  const classSum = Object.values(value.enforcement.byClass).reduce((sum, n) => sum + n, 0);
  if (classSum !== value.enforcement.indexed) {
    throw new Error("Enforcement action classes must sum to indexed occurrences");
  }
  const bucketSum = Object.values(value.enforcement.matchBuckets).reduce((sum, n) => sum + n, 0);
  if (bucketSum !== value.enforcement.indexed) {
    throw new Error("Enforcement identity buckets must sum to indexed occurrences");
  }
  if (value.profileAttachments.length !== 0) {
    throw new Error("This snapshot has no production-approved profile attachments");
  }
  return value;
}

export function selectNjProfileEvidence(input: {
  ccn?: string | null;
  state?: string | null;
  facId?: string | null;
  licenseNumber?: string | null;
}): NjProfileEvidence {
  const snapshot = assertNjIntelligence(NJ_PUBLIC_SNAPSHOT);
  const withheld =
    snapshot.enforcement.matchBuckets.REVIEW_REQUIRED +
    snapshot.enforcement.matchBuckets.UNRESOLVED;
  if (input.state && input.state.toUpperCase() !== "NJ") {
    return {
      match: "NONE",
      attachments: [],
      withheldReviewOrUnresolved: withheld,
      render: false,
    };
  }
  const attachments = (snapshot.profileAttachments as readonly NjProfileAttachment[]).filter(
    (row) => {
      if (input.ccn && row.ccn && row.ccn === input.ccn) return true;
      if (input.facId && row.facId && row.facId === input.facId) return true;
      if (input.licenseNumber && row.licenseNumber && row.licenseNumber === input.licenseNumber) {
        return true;
      }
      return false;
    },
  );
  const exactOrHigh = attachments.filter(
    (row) => row.match === "EXACT" || (row.match === "HIGH_CONFIDENCE" && !row.adverse),
  );
  const adverseExact = attachments.filter((row) => row.adverse && row.match === "EXACT");
  const publishable = [...exactOrHigh.filter((row) => !row.adverse), ...adverseExact];
  if (publishable.length === 0) {
    return {
      match: "NONE",
      attachments: [],
      withheldReviewOrUnresolved: withheld,
      render: false,
    };
  }
  return {
    match: publishable.some((row) => row.match === "EXACT") ? "EXACT" : "HIGH_CONFIDENCE",
    attachments: publishable,
    withheldReviewOrUnresolved: withheld,
    render: true,
  };
}

export { NJ_PUBLIC_SNAPSHOT };
