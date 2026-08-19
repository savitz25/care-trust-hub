/**
 * Assisted living / residential-care regulatory foundation (021A).
 *
 * Non-CMS identity is state-scoped and license-based. Name similarity is never
 * enough to publish. Memory-care designations must be explicit regulator evidence.
 */

import type { HistoryEventType } from "./facility-history";
import type { ResolutionState } from "./facility-intelligence";

export const ASSISTED_LIVING_IDENTITY_VERSION = "assisted-living-identity-v1" as const;
export const ASSISTED_LIVING_ADAPTER_VERSION = "assisted-living-adapter-v1" as const;
export const FUTURE_ASSISTED_LIVING_ROUTE = "/assisted-living/[state]/[provider-id]/[slug]";

export const ASSISTED_LIVING_PILOT_STATES = ["CA", "NY", "TX"] as const;
export type AssistedLivingPilotState = (typeof ASSISTED_LIVING_PILOT_STATES)[number];

export const ASSISTED_LIVING_CANDIDATE_STATES = [
  "CA",
  "NY",
  "TX",
  "FL",
  "NC",
  "PA",
  "OH",
  "NJ",
] as const;
export type AssistedLivingCandidateState = (typeof ASSISTED_LIVING_CANDIDATE_STATES)[number];

export const CONSUMER_CARE_CATEGORIES = [
  "assisted_living",
  "residential_care",
  "memory_supportive",
  "adult_care_home",
  "personal_care_home",
] as const;
export type ConsumerCareCategory = (typeof CONSUMER_CARE_CATEGORIES)[number];

export const MEMORY_CARE_DESIGNATIONS = [
  "explicit_memory_or_dementia_license",
  "secured_or_special_care_unit",
  "specialty_endorsement",
  "general_assisted_living_only",
  "not_reported",
] as const;
export type MemoryCareDesignation = (typeof MEMORY_CARE_DESIGNATIONS)[number];

export const ORGANIZATION_ROLES = [
  "licensee",
  "operator",
  "management_company",
  "administrator",
  "owner",
  "parent_organization",
] as const;
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const LICENSE_STATUS_PRESERVED = [
  "Active",
  "Closed",
  "Suspended",
  "Provisional",
  "Conditional",
] as const;

export interface AssistedLivingRegulatorSource {
  readonly stateCode: AssistedLivingCandidateState;
  readonly regulatorCode: string;
  readonly regulatorName: string;
  readonly officialTerminology: readonly string[];
  readonly officialSourceUrl: string;
  readonly sourceFormat: string;
  readonly facilityIdField: string;
  readonly automation: "high" | "medium" | "low";
  readonly memoryEvidence: string;
  readonly inspections: string;
  readonly enforcement: string;
  readonly updateFrequency: string;
  readonly historicalAvailability: string;
  readonly notes: string;
}

export const ASSISTED_LIVING_STATE_SOURCES: Record<
  AssistedLivingCandidateState,
  AssistedLivingRegulatorSource
> = {
  CA: {
    stateCode: "CA",
    regulatorCode: "CA_CDSS_CCL",
    regulatorName: "California Department of Social Services, Community Care Licensing Division",
    officialTerminology: ["Residential Care Facility for the Elderly"],
    officialSourceUrl: "https://data.chhs.ca.gov/dataset/ccl-facilities",
    sourceFormat: "CHHS Open Data CSV (RCFE resource)",
    facilityIdField: "Facility Number",
    automation: "high",
    memoryEvidence:
      "Not a separate license. Dementia-care plan / secured unit is not reliably present in the RCFE listing; treat as not_reported unless a later official column is added.",
    inspections:
      "CCLD Facility Search / Transparency site; five years of inspection and complaint reports.",
    enforcement:
      "License actions appear in CCLD Transparency comments; structured statewide enforcement extract is uneven.",
    updateFrequency: "CHHS open-data refresh; listing dated on the dataset page.",
    historicalAvailability:
      "Current listing plus CCLD portal history. Prior paper files remain regional.",
    notes: "RCFE is not a CDPH/CMS identity. Do not merge to SNF FACID/CCN by address.",
  },
  NY: {
    stateCode: "NY",
    regulatorCode: "NY_DOH_ACF",
    regulatorName:
      "New York State Department of Health, Adult Care Facility / Assisted Living Surveillance",
    officialTerminology: [
      "Adult Care Facility",
      "Adult Home",
      "Enriched Housing Program",
      "Assisted Living Residence",
      "Assisted Living Program",
      "Enhanced Assisted Living Residence",
      "Special Needs Assisted Living Residence",
    ],
    officialSourceUrl:
      "https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r",
    sourceFormat: "Socrata API + Health Facility Certification Information (2g9y-7kqm)",
    facilityIdField: "Facility ID",
    automation: "high",
    memoryEvidence:
      "Special Needs Assisted Living Residence (SNALR) is an official certification. Enhanced Assisted Living Residence (EALR) is not by itself a dementia license.",
    inspections:
      "NYS Health Profiles / surveillance datasets; complaint investigations exist separately.",
    enforcement:
      "Enforcement and surveillance are official but not always one tidy download; ingest only ID-linked rows.",
    updateFrequency: "As needed / current as of last Health Data NY update.",
    historicalAvailability: "HFIS current snapshot; profiles retain inspection history.",
    notes:
      "Join General Information to Certification Information on Facility ID. Operating certificate is not a CCN.",
  },
  TX: {
    stateCode: "TX",
    regulatorCode: "TX_HHSC_ALF",
    regulatorName: "Texas Health and Human Services Commission",
    officialTerminology: [
      "Assisted Living Facility",
      "Type A Assisted Living",
      "Type B Assisted Living",
    ],
    officialSourceUrl:
      "https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living-facilities-alf",
    sourceFormat: "Official Excel directory (al.xlsx)",
    facilityIdField: "Facility ID / License Number as published in the ALF directory",
    automation: "medium",
    memoryEvidence:
      "Alzheimer's Certified / Alzheimer's Disclosure is an official directory field when present. Never infer from a facility name.",
    inspections: "TULIP / LTC provider search; not a single open API.",
    enforcement:
      "Closures Excel is official. Broader enforcement is portal-bound; defer unstable extracts.",
    updateFrequency: "HHSC replaces the directory Excel periodically.",
    historicalAvailability:
      "Current directory plus a closures workbook. Limited machine-readable history.",
    notes:
      "Do not reuse the nursing-facility Excel mapping. TX ALF fields are a separate directory.",
  },
  FL: {
    stateCode: "FL",
    regulatorCode: "FL_AHCA_ALF",
    regulatorName: "Florida Agency for Health Care Administration",
    officialTerminology: ["Assisted Living Facility"],
    officialSourceUrl: "https://quality.healthfinder.fl.gov/Facility-Provider/ALF?type=0",
    sourceFormat: "FloridaHealthFinder XLSX export / AHCA locator",
    facilityIdField: "AHCA file / license number",
    automation: "medium",
    memoryEvidence:
      "Specialty licenses (ECC, LNS, Limited Mental Health) are not dementia licenses. Memory care is usually not_reported.",
    inspections: "AHCA inspection details from 2008 onward in the locator.",
    enforcement: "Sanctions appear in Health Finder; structured bulk extract is not first-class.",
    updateFrequency: "Locator is current; export is on demand.",
    historicalAvailability: "Inspection history in the locator; listing is current licensure.",
    notes: "Strong consumer market, weaker explicit memory designation than NY or TX.",
  },
  NC: {
    stateCode: "NC",
    regulatorCode: "NC_DHSR_ACLS",
    regulatorName:
      "North Carolina DHHS, Division of Health Service Regulation, Adult Care Licensure Section",
    officialTerminology: ["Adult Care Home"],
    officialSourceUrl: "https://info.ncdhhs.gov/dhsr/acls/faclistings.html",
    sourceFormat: "Official XLSX Adult Care Home listing",
    facilityIdField: "License number in the DHSR listing",
    automation: "high",
    memoryEvidence:
      "Special Care Unit is an official designation when the listing or later file includes it.",
    inspections: "DHSR star-rating / inspection pages; not always in the listing workbook.",
    enforcement: "License actions are official but often PDF/portal.",
    updateFrequency: "Listing date is posted on the DHSR page (updated periodically).",
    historicalAvailability: "Current listing. Inspection history is a separate DHSR product.",
    notes: "Adult Care Home is the official term. Do not relabel the source as assisted living.",
  },
  PA: {
    stateCode: "PA",
    regulatorCode: "PA_DHS_BHSL",
    regulatorName: "Pennsylvania Department of Human Services, Bureau of Human Services Licensing",
    officialTerminology: ["Personal Care Home", "Assisted Living Residence"],
    officialSourceUrl: "https://www.humanservices.dhs.pa.gov/human_service_provider_directory/",
    sourceFormat: "Human Services Provider Directory search (no first-class bulk API)",
    facilityIdField: "DHS license / provider ID in the directory",
    automation: "low",
    memoryEvidence:
      "Not a statewide dementia license. Leave not_reported unless an official endorsement appears.",
    inspections: "BHSL compliance records posted per facility.",
    enforcement: "Available through DHS regional/compliance pages; not a single table.",
    updateFrequency: "Directory is current; no published cadence.",
    historicalAvailability: "Compliance records exist; bulk history is weak.",
    notes: "DOH licenses nursing facilities, not PCH/ALR. Two official residential types.",
  },
  OH: {
    stateCode: "OH",
    regulatorCode: "OH_ODH_RCF",
    regulatorName: "Ohio Department of Health, Bureau of Regulatory Operations",
    officialTerminology: ["Residential Care Facility"],
    officialSourceUrl:
      "https://odh.ohio.gov/know-our-programs/residential-care-facilities-assisted-living/residentialcarefacilitiesassistedliving",
    sourceFormat: "Health Care Provider extract / eID portal",
    facilityIdField: "ODH facility identifier in the provider extract",
    automation: "medium",
    memoryEvidence:
      "No separate statewide dementia license in the RCF program. Default not_reported.",
    inspections: "ODH survey reports through the provider portal.",
    enforcement: "Portal reports; no tidy statewide enforcement CSV identified.",
    updateFrequency: "Portal is current.",
    historicalAvailability: "Survey history in eID; listing extract is current.",
    notes: "Assisted living is the consumer label. Official license is Residential Care Facility.",
  },
  NJ: {
    stateCode: "NJ",
    regulatorCode: "NJ_DOH_LTC",
    regulatorName: "New Jersey Department of Health",
    officialTerminology: [
      "Assisted Living Residence",
      "Comprehensive Personal Care Home",
      "Assisted Living Program",
    ],
    officialSourceUrl: "https://healthapps.nj.gov/facilities/fsSearch.aspx",
    sourceFormat: "LTC search plus an Excel listing linked from the search page",
    facilityIdField: "NJ DOH facility / license number",
    automation: "medium",
    memoryEvidence: "Memory/dementia is not a distinct statewide AL license. Default not_reported.",
    inspections: "Annual unannounced inspections; reports via the facility search.",
    enforcement: "Portal-bound.",
    updateFrequency: "Search/Excel listing current.",
    historicalAvailability: "Current listing; inspection PDFs vary.",
    notes: "Useful later. Weaker open-data surface than NY/CA.",
  },
};

export interface StateProviderIdentity {
  readonly stateCode: string;
  readonly regulatorCode: string;
  readonly sourceFacilityId: string;
  readonly licenseId: string | null;
  readonly officialName: string;
  readonly officialStreet: string | null;
  readonly officialCity: string | null;
  readonly officialZip: string | null;
}

export interface OrganizationParty {
  readonly role: OrganizationRole;
  readonly name: string;
  readonly sourceField: string;
}

export function normalizeStateScopedId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "");
  return normalized || null;
}

export function assistedLivingExternalKey(input: {
  stateCode: string;
  regulatorCode: string;
  sourceFacilityId: string;
}): string {
  const state = input.stateCode.trim().toUpperCase();
  const regulator = input.regulatorCode.trim();
  const id = normalizeStateScopedId(input.sourceFacilityId);
  if (!/^[A-Z]{2}$/.test(state) || !regulator || !id) {
    throw new RangeError(
      "Assisted-living identity requires state, regulator, and a source facility ID",
    );
  }
  return `${state}:${regulator}:${id}`;
}

export function isCmsCcnIdentity(value: string): boolean {
  return /^[A-Z0-9]{6}$/.test(value.trim().toUpperCase()) && !value.includes(":");
}

export function resolveAssistedLivingIdentity(input: {
  stateCode: string | null | undefined;
  regulatorCode: string | null | undefined;
  sourceFacilityId: string | null | undefined;
  licenseId?: string | null;
  officialName?: string | null;
  officialStreet?: string | null;
  officialCity?: string | null;
  officialZip?: string | null;
}): { state: ResolutionState; reason: string; key: string | null } {
  const stateCode = input.stateCode?.trim().toUpperCase() ?? "";
  const regulator = input.regulatorCode?.trim() ?? "";
  const facilityId = normalizeStateScopedId(input.sourceFacilityId);
  const name = input.officialName?.trim() ?? "";
  if (!/^[A-Z]{2}$/.test(stateCode) || !regulator) {
    return { state: "UNRESOLVED", reason: "Missing issuing state or regulator.", key: null };
  }
  if (!facilityId && !normalizeStateScopedId(input.licenseId)) {
    if (name) {
      return {
        state: "REVIEW_REQUIRED",
        reason: "Name without a state facility or license ID is not a publishable identity.",
        key: null,
      };
    }
    return { state: "UNRESOLVED", reason: "No authoritative state identifier.", key: null };
  }
  if (!facilityId) {
    return {
      state: "REVIEW_REQUIRED",
      reason: "License ID is present but the source facility ID is missing.",
      key: null,
    };
  }
  if (!name) {
    return {
      state: "REVIEW_REQUIRED",
      reason: "Authoritative ID without an official name needs review.",
      key: assistedLivingExternalKey({
        stateCode,
        regulatorCode: regulator,
        sourceFacilityId: facilityId,
      }),
    };
  }
  return {
    state: "VERIFIED",
    reason: "State, regulator, official facility ID, and official name are present.",
    key: assistedLivingExternalKey({
      stateCode,
      regulatorCode: regulator,
      sourceFacilityId: facilityId,
    }),
  };
}

const MEMORY_NAME_HINT = /\b(memory|dementia|alzheimer|alzheimer's)\b/i;

export function classifyMemoryCareDesignation(input: {
  explicitLicenseOrCertification?: string | null;
  securedOrSpecialCareUnit?: boolean | null;
  specialtyEndorsement?: string | null;
  facilityName?: string | null;
}): MemoryCareDesignation {
  const explicit = input.explicitLicenseOrCertification?.trim() ?? "";
  if (explicit) return "explicit_memory_or_dementia_license";
  if (input.securedOrSpecialCareUnit === true) return "secured_or_special_care_unit";
  if (input.specialtyEndorsement?.trim()) return "specialty_endorsement";
  if (input.facilityName && MEMORY_NAME_HINT.test(input.facilityName)) {
    return "not_reported";
  }
  if (input.securedOrSpecialCareUnit === false && !explicit) {
    return "general_assisted_living_only";
  }
  return "not_reported";
}

export function mapOfficialTypeToConsumerCategory(input: {
  officialType: string;
  memory?: MemoryCareDesignation;
}): { officialType: string; consumerCategory: ConsumerCareCategory } {
  const officialType = input.officialType.trim();
  const normalized = officialType.toLowerCase();
  if (input.memory === "explicit_memory_or_dementia_license") {
    return { officialType, consumerCategory: "memory_supportive" };
  }
  if (normalized.includes("personal care home")) {
    return { officialType, consumerCategory: "personal_care_home" };
  }
  if (normalized.includes("adult care home") || normalized.includes("adult home")) {
    return { officialType, consumerCategory: "adult_care_home" };
  }
  if (
    normalized.includes("residential care") ||
    normalized.includes("residential care facility") ||
    normalized.includes("enriched housing") ||
    normalized.startsWith("rcfe")
  ) {
    return { officialType, consumerCategory: "residential_care" };
  }
  return { officialType, consumerCategory: "assisted_living" };
}

export function organizationParty(
  role: OrganizationRole,
  name: string | null | undefined,
  sourceField: string,
): OrganizationParty | null {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return null;
  return { role, name: trimmed, sourceField };
}

export function isPublishableAssistedLivingRecord(input: {
  identityState: ResolutionState;
  officialName: string | null | undefined;
  officialStreet: string | null | undefined;
  officialCity: string | null | undefined;
  officialZip: string | null | undefined;
  consumerCategory: ConsumerCareCategory | null | undefined;
  retrievedAt: string | null | undefined;
}): boolean {
  if (input.identityState !== "VERIFIED") return false;
  if (!input.officialName?.trim()) return false;
  if (!input.consumerCategory) return false;
  if (!input.retrievedAt) return false;
  const hasPlace =
    Boolean(input.officialStreet?.trim()) &&
    (Boolean(input.officialCity?.trim()) || Boolean(input.officialZip?.trim()));
  return hasPlace;
}

export const ASSISTED_LIVING_HISTORY_EVENTS = [
  "STATE_INSPECTION",
  "STATE_COMPLAINT",
  "STATE_COMPLAINT_INSPECTION",
  "STATE_ENFORCEMENT",
  "STATE_ENFORCEMENT_ACTION",
  "STATE_FINE",
  "STATE_ADMINISTRATIVE_ORDER",
  "STATE_LICENSE_RESTRICTION",
  "STATE_LICENSE_SUSPENSION",
  "STATE_CLOSURE",
  "STATE_CLOSURE_ACTION",
  "STATE_OPERATOR_CHANGE",
] as const satisfies readonly HistoryEventType[];

export function futureAssistedLivingPath(input: {
  stateCode: string;
  sourceFacilityId: string;
  officialName: string;
}): string {
  const state = input.stateCode.trim().toLowerCase();
  const id = encodeURIComponent(normalizeStateScopedId(input.sourceFacilityId) ?? "");
  const slug =
    input.officialName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "provider";
  return `/assisted-living/${state}/${id}/${slug}`;
}

export function licensedCapacityLabel(value: number | null | undefined): string {
  if (value == null) return "Licensed capacity not reported";
  return `Licensed capacity ${value}`;
}
