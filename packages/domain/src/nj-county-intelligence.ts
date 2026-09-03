import { NJ_PUBLIC_FINGERPRINT } from "./nj-intelligence";
import { NJ_COUNTY_PUBLIC_SNAPSHOTS } from "./nj-county-public-snapshots";

export const NJ_COUNTY_INTEL_VERSION = "nj-sen-county-001-public-v1" as const;

export const NJ_COUNTY_SLUGS = [
  "monmouth-county",
  "middlesex-county",
  "somerset-county",
  "union-county",
] as const;

export type NjCountySlug = (typeof NJ_COUNTY_SLUGS)[number];

export const NJ_COUNTY_FINGERPRINTS: Record<NjCountySlug, string> = {
  "monmouth-county": "5c1dbcdea4bfa3f15dad4285d4b6cbecf745c12c06a016209460edc894446006",
  "middlesex-county": "13225785ddd9fffa4299232d477e410a7c42ac1a1c897e84d3f004c46f2d369c",
  "somerset-county": "6a1ad037274fa6990d50c2c7727a699185c4cfbccdda84639b47a18a2e491ac4",
  "union-county": "72cb9792d6ad078639e36c27e5c4794197ec0c08ff4eee6e55251610854cb441",
};

export const NJ_COUNTY_LOCKED = {
  "monmouth-county": {
    name: "Monmouth",
    fips: "34025",
    ltc: 86,
    acute: 99,
    nfSnf: 32,
    alr: 33,
    inventoryRows: 185,
    seniorCenters: 12,
  },
  "middlesex-county": {
    name: "Middlesex",
    fips: "34023",
    ltc: 81,
    acute: 109,
    nfSnf: 23,
    alr: 16,
    inventoryRows: 190,
    seniorCenters: 12,
    congregateMealSites: 8,
  },
  "somerset-county": {
    name: "Somerset",
    fips: "34035",
    ltc: 45,
    acute: 51,
    nfSnf: 12,
    alr: 21,
    inventoryRows: 96,
    housingSeniorRelated: 58,
    housingCcrc: 4,
    nursingHomeGeocode: 14,
  },
  "union-county": {
    name: "Union",
    fips: "34039",
    ltc: 46,
    acute: 74,
    nfSnf: 19,
    alr: 8,
    inventoryRows: 120,
    grantCap: "$10,000",
    grantAge: 62,
    grantAsOf: "2026-01-14",
  },
} as const;

export function isNjCountySlug(value: string): value is NjCountySlug {
  return (NJ_COUNTY_SLUGS as readonly string[]).includes(value);
}

export interface NjCountyTypeCount {
  label: string;
  typeKey: string;
  count: number;
}

export interface NjCountyFinding {
  id: string;
  text: string;
}

export interface NjCountySourceFamily {
  id: string;
  label: string;
  countySpecific: boolean;
  grain: string;
}

export interface NjCountyPaceCenter {
  org: string;
  name: string;
  city: string;
  county: string;
  status: string;
}

export interface NjCountyAdrc {
  agency: string;
  phone: string;
  tollFree?: string | null;
  adrcTollFree?: string | null;
  email?: string | null;
  address?: string | null;
  url?: string | null;
  resourceDirectoryPdf?: string | null;
  resourceDirectoryAsOf?: string | null;
  informationPacketPdf?: string | null;
  informationPacketAsOf?: string | null;
  grain?: string | null;
  notAFacilityLicense?: boolean;
}

export interface NjCountySite {
  name: string | null;
  streetAddress?: string | null;
  municipality?: string | null;
  zip?: string | null;
  phone?: string | null;
  hours?: string | null;
  nutritionSite?: boolean;
}

export interface NjCountyPublicSnapshot {
  version: typeof NJ_COUNTY_INTEL_VERSION;
  ticket: "NJ-SEN-COUNTY-001";
  slug: NjCountySlug;
  path: string;
  county: string;
  countyFips: string;
  asOf: string;
  stateSnapshotVersion: string;
  stateSnapshotFingerprint: string;
  stateAsOf: string;
  fingerprint: string;
  njdoh: {
    ltc: number;
    acute: number;
    nfSnf: number;
    alr: number;
    cpch: number;
    alp: number;
    hha: number;
    hospiceProgram: number;
    hospiceBranch: number;
    hospiceInpatient: number;
    inventoryRows: number;
    ltcAsOf: string;
    acuteAsOf: string;
    ltcByType: NjCountyTypeCount[];
    acuteByType: NjCountyTypeCount[];
    caveat: string;
  };
  cms: {
    treatment: "STATEWIDE_OVERLAY_ONLY";
    nursingHomesStatewide: number;
    homeHealthStatewide: number;
    hospiceStatewide: number;
    asOf: string;
    source: string;
    countyCountPublished: null;
    identityLinkage: "unavailable";
    caveat: string;
  };
  enforcement: {
    treatment: "STATEWIDE_EXACT_CONTEXT_ONLY";
    indexedStatewide: number;
    exactStatewide: number;
    unresolvedStatewide: number;
    exactFacilitiesStatewide: number;
    countyExactPublished: null;
    caveat: string;
  };
  staffing: {
    treatment: "STATEWIDE_CONTEXT_ONLY_NH";
    latest: string;
    statewideDayRn: number;
    statewideDayLpn: number;
    statewideDayCna: number;
    statewideReportingFacilities: number;
    countyAggregatePublished: null;
    semantics: string;
    notAttachedTo: string[];
    caveat: string;
  };
  medicaid: {
    treatment: "STATEWIDE_SCHEDULE_ONLY";
    listedRowsStatewide: number;
    minRate: number;
    maxRate: number;
    fiscalYear: string;
    effectiveOn: string;
    countyListedRowsPublished: null;
    caveat: string;
  };
  pace: {
    treatment: "CENTER_ADDRESS_COUNTY_ONLY";
    centersInCounty: NjCountyPaceCenter[];
    operatingCentersInCounty: number;
    awardedOrInDevelopmentCentersInCounty: number;
    caveat: string;
  };
  ccrc: {
    coverage: string;
    countPublished: null;
    caveat: string;
  };
  localResources: {
    kind: "COUNTY_RESOURCE";
    notALicensedFacility: boolean;
    sourceAsOf: string;
    adrc: NjCountyAdrc | null;
    seniorCenters: {
      sourceUrl: string;
      coverage: string;
      count: number;
      rows: NjCountySite[];
    } | null;
    otherServiceCenters: NjCountySite[];
    congregateMealSites: NjCountySite[] | null;
    congregateMealSitesCoverage: string | null;
    homeDeliveredMeals: Array<{ provider?: string; phone?: string }>;
    seniorCentersNotExtracted: string[] | null;
    housingInventory: {
      source: string;
      serviceUrl: string;
      grain: string;
      semantic: string;
      sourceAsOfNote: string;
      totalRecords: number;
      seniorRelatedRecordCount: number;
      categoryCounts: Record<string, number>;
      notCurrentNjdohLicensure: boolean;
      notCmsDirectory: boolean;
      notCertificateOfAuthorityRoster: boolean;
      noNameOnlyMergeToNjdoh: boolean;
      rows: Array<Record<string, string | null>>;
    } | null;
    nursingHomeGeocode: {
      source: string;
      grain: string;
      semantic: string;
      count: number;
      notNjdohLicenseRoster: boolean;
      notCmsCareCompare: boolean;
      rows: Array<{
        name: string;
        address: string | null;
        municipality: string | null;
        telephone: string | null;
      }>;
    } | null;
    seniorGrant: {
      programName: string;
      sourceUrl: string;
      sourceAsOf: string;
      benefitType: string;
      benefitAmountPublished: string;
      ageRule: string;
      attribution: string;
      notGuaranteedEligibilityOrFunding: boolean;
      notACountyLicense: boolean;
    } | null;
    homeImprovementProgram: {
      programName: string;
      sourceUrl: string;
      sourceAsOf: string;
      benefitType: string;
      benefitAmountPublished: string;
      agingInPlaceNote: string;
      notACountyLicense: boolean;
    } | null;
    notes: Array<string | null>;
  };
  sourceFamilies: NjCountySourceFamily[];
  findings: NjCountyFinding[];
  gaps: string[];
  sourceClocks: Record<string, string>;
  publicationGate: {
    indexable: boolean;
    sourceFamilyCount: number;
    countySpecificLocalSource: boolean;
    findingCount: number;
    deterministicSnapshot: boolean;
    thinStateCopy: boolean;
  };
  disclaimers: string[];
}

export interface NjCountyTraceMetric {
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
  coverageState: string;
  caveat: string;
}

export function njCountyTraceMetrics(snapshot: NjCountyPublicSnapshot): NjCountyTraceMetric[] {
  const n = snapshot.njdoh;
  return [
    {
      id: "ltc-rows",
      label: `${snapshot.county} NJDOH All_LTC licensed identities`,
      display: n.ltc.toLocaleString("en-US"),
      value: n.ltc,
      source: "NJDOH All_LTC.xlsx projected from NJ-SEN-005",
      sourceDate: n.ltcAsOf,
      sourceGrain: "All_LTC facility row with county = physical location",
      numerator: n.ltc,
      denominator: n.ltc,
      computation: `Count of current All_LTC identities whose county is ${snapshot.county}.`,
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: n.caveat,
    },
    {
      id: "acute-rows",
      label: `${snapshot.county} NJDOH All_Acute licensed identities`,
      display: n.acute.toLocaleString("en-US"),
      value: n.acute,
      source: "NJDOH All_Acute.xlsx projected from NJ-SEN-005",
      sourceDate: n.acuteAsOf,
      sourceGrain: "All_Acute facility row; office county is not a service area",
      numerator: n.acute,
      denominator: n.acute,
      computation: `Count of current All_Acute identities whose county is ${snapshot.county}.`,
      coverageState: "ACQUIRED_CURRENT_SNAPSHOT",
      caveat: n.caveat,
    },
    {
      id: "cms-county",
      label: `${snapshot.county} CMS directory identities`,
      display: "Unknown",
      value: null,
      source: snapshot.cms.source,
      sourceDate: snapshot.cms.asOf,
      sourceGrain: "CMS CCN in NJ geography",
      numerator: null,
      denominator: null,
      computation: "Not computed. No manufactured CCN join to county.",
      coverageState: "STATEWIDE_OVERLAY_ONLY",
      caveat: snapshot.cms.caveat,
    },
    {
      id: "enforcement-county",
      label: `${snapshot.county} exact NJDOH enforcement matches`,
      display: "Unknown",
      value: null,
      source: "NJDOH enforcement corpus (NJ-SEN-002)",
      sourceDate: snapshot.stateAsOf,
      sourceGrain: "exact FacID/license match assigned to county",
      numerator: null,
      denominator: null,
      computation: "Not computed. Exact FacID county assignment is not in this snapshot.",
      coverageState: "STATEWIDE_EXACT_CONTEXT_ONLY",
      caveat: snapshot.enforcement.caveat,
    },
    {
      id: "staffing-county",
      label: `${snapshot.county} staffing residents-per-staff aggregate`,
      display: "Omitted",
      value: null,
      source: "NJDOH quarterly staffing HTML",
      sourceDate: snapshot.staffing.latest,
      sourceGrain: "nursing-facility quarterly 1RN:#Res",
      numerator: null,
      denominator: null,
      computation:
        "Omitted. Source-native county numerators and denominators are not in the public snapshot.",
      coverageState: "STATEWIDE_CONTEXT_ONLY_NH",
      caveat: snapshot.staffing.caveat,
    },
    {
      id: "medicaid-county",
      label: `${snapshot.county} Medicaid listed assisted-living rate rows`,
      display: "Unknown",
      value: null,
      source: "NJMMIS SFY 2026 Assisted Living Rates PDF",
      sourceDate: snapshot.medicaid.effectiveOn,
      sourceGrain: "printed schedule row",
      numerator: null,
      denominator: null,
      computation: "Not computed. Name-only schedule rows are not county-assigned.",
      coverageState: "STATEWIDE_SCHEDULE_ONLY",
      caveat: snapshot.medicaid.caveat,
    },
  ];
}

export function assertNjCountyIntelligence(value: NjCountyPublicSnapshot): NjCountyPublicSnapshot {
  if (value.version !== NJ_COUNTY_INTEL_VERSION) {
    throw new Error(`Unexpected New Jersey county contract ${value.version}`);
  }
  if (!isNjCountySlug(value.slug)) {
    throw new Error(`Unexpected county slug ${value.slug}`);
  }
  if (!/^[0-9a-f]{64}$/.test(value.fingerprint)) {
    throw new Error("County snapshot fingerprint must be sha256 hex");
  }
  if (value.fingerprint !== NJ_COUNTY_FINGERPRINTS[value.slug]) {
    throw new Error(`${value.slug} public snapshot fingerprint drifted`);
  }
  if (value.stateSnapshotFingerprint !== NJ_PUBLIC_FINGERPRINT) {
    throw new Error("County snapshot must pin the frozen NJ-SEN-005 fingerprint");
  }
  if (value.path !== `/new-jersey/${value.slug}`) {
    throw new Error("County path must match slug");
  }
  const locked = NJ_COUNTY_LOCKED[value.slug];
  if (value.county !== locked.name || value.countyFips !== locked.fips) {
    throw new Error("County identity drifted");
  }
  if (value.njdoh.ltc !== locked.ltc || value.njdoh.acute !== locked.acute) {
    throw new Error("NJDOH county counts drifted");
  }
  if (value.njdoh.nfSnf !== locked.nfSnf || value.njdoh.alr !== locked.alr) {
    throw new Error("NJDOH SNF/ALR county counts drifted");
  }
  if (value.njdoh.inventoryRows !== locked.inventoryRows) {
    throw new Error("Inventory county row count drifted");
  }
  const ltcSum = value.njdoh.ltcByType.reduce((sum, row) => sum + row.count, 0);
  const acuteSum = value.njdoh.acuteByType.reduce((sum, row) => sum + row.count, 0);
  if (ltcSum !== value.njdoh.ltc || acuteSum !== value.njdoh.acute) {
    throw new Error("County type counts must sum to universe totals");
  }
  if (value.njdoh.ltc + value.njdoh.acute !== value.njdoh.inventoryRows) {
    throw new Error("Inventory rows must equal All_LTC plus All_Acute");
  }
  if (value.cms.countyCountPublished !== null) {
    throw new Error("County CMS counts must stay unknown");
  }
  if (value.enforcement.countyExactPublished !== null) {
    throw new Error("County enforcement exact counts must stay unknown");
  }
  if (value.staffing.countyAggregatePublished !== null) {
    throw new Error("County staffing aggregate must stay omitted");
  }
  if (value.medicaid.countyListedRowsPublished !== null) {
    throw new Error("County Medicaid listed rows must stay unknown");
  }
  if (value.ccrc.countPublished !== null) {
    throw new Error("Missing CCRC roster must stay unknown, not zero");
  }
  if (
    value.localResources.kind !== "COUNTY_RESOURCE" ||
    !value.localResources.notALicensedFacility
  ) {
    throw new Error("Local resources must be labeled county resources, not licensed facilities");
  }
  if (
    value.publicationGate.sourceFamilyCount < 3 ||
    !value.publicationGate.countySpecificLocalSource ||
    value.publicationGate.findingCount < 2 ||
    !value.publicationGate.indexable ||
    value.publicationGate.thinStateCopy
  ) {
    throw new Error("County publication gate failed");
  }
  if (value.staffing.notAttachedTo.includes("ALR") === false) {
    throw new Error("Staffing must not attach to ALR");
  }
  return value;
}

export function getNjCountySnapshot(slug: NjCountySlug): NjCountyPublicSnapshot {
  return assertNjCountyIntelligence(
    NJ_COUNTY_PUBLIC_SNAPSHOTS[slug] as unknown as NjCountyPublicSnapshot,
  );
}

export { NJ_COUNTY_PUBLIC_SNAPSHOTS };
