import {
  ASSISTED_LIVING_STATE_SOURCES,
  licensedCapacityLabel,
  type ConsumerCareCategory,
  type MemoryCareDesignation,
  type OrganizationRole,
} from "./assisted-living-identity";

export const ASSISTED_LIVING_COVERAGE_NOTE =
  "SeniorTrustHub currently publishes state-regulator provider evidence for California, New York, and Texas.";

export const ASSISTED_LIVING_INSPECTION_GAP =
  "SeniorTrustHub currently publishes state licensing evidence for this provider. State inspection and enforcement history is not yet integrated for this care setting. Absence of inspection data is not a clean record.";

export const ASSISTED_LIVING_SEARCH_PATH = "/assisted-living";

export const EXPLICIT_MEMORY_DESIGNATIONS: readonly MemoryCareDesignation[] = [
  "explicit_memory_or_dementia_license",
  "secured_or_special_care_unit",
  "specialty_endorsement",
];

export const ASSISTED_LIVING_STATE_LANDINGS = {
  california: { code: "CA", slug: "california", name: "California" },
  "new-york": { code: "NY", slug: "new-york", name: "New York" },
  texas: { code: "TX", slug: "texas", name: "Texas" },
} as const;

export type AssistedLivingLandingSlug = keyof typeof ASSISTED_LIVING_STATE_LANDINGS;

export const CONSUMER_CATEGORY_LABELS: Record<ConsumerCareCategory, string> = {
  assisted_living: "Assisted living",
  residential_care: "Residential care",
  memory_supportive: "Memory-supportive care",
  adult_care_home: "Adult care home",
  personal_care_home: "Personal care home",
};

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  licensee: "Licensee",
  operator: "Operator",
  management_company: "Management company",
  administrator: "Administrator",
  owner: "Owner (source label)",
  parent_organization: "Parent organization",
};

export function isExplicitMemoryDesignation(value: MemoryCareDesignation): boolean {
  return EXPLICIT_MEMORY_DESIGNATIONS.includes(value);
}

export function memoryCarePublicLabel(value: MemoryCareDesignation): string | null {
  if (value === "explicit_memory_or_dementia_license") {
    return "Official memory / dementia designation";
  }
  if (value === "secured_or_special_care_unit") {
    return "Secured or special care unit";
  }
  if (value === "specialty_endorsement") {
    return "Alzheimer / memory specialty endorsement";
  }
  return null;
}

export function assistedLivingNameSlug(officialName: string): string {
  return (
    officialName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "provider"
  );
}

export function publishedAssistedLivingPath(input: {
  stateCode: string;
  id: string;
  officialName: string;
}): string {
  const state = input.stateCode.trim().toLowerCase();
  return `/assisted-living/${state}/${input.id}/${assistedLivingNameSlug(input.officialName)}`;
}

export function assistedLivingLandingPath(slug: AssistedLivingLandingSlug): string {
  return `/assisted-living/${slug}`;
}

export function resolveAssistedLivingLanding(
  value: string,
): (typeof ASSISTED_LIVING_STATE_LANDINGS)[AssistedLivingLandingSlug] | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "ca") return ASSISTED_LIVING_STATE_LANDINGS.california;
  if (normalized === "ny") return ASSISTED_LIVING_STATE_LANDINGS["new-york"];
  if (normalized === "tx") return ASSISTED_LIVING_STATE_LANDINGS.texas;
  if (normalized in ASSISTED_LIVING_STATE_LANDINGS) {
    return ASSISTED_LIVING_STATE_LANDINGS[normalized as AssistedLivingLandingSlug];
  }
  return null;
}

export function regulatorDisplayName(stateCode: string): string {
  const source =
    ASSISTED_LIVING_STATE_SOURCES[stateCode.trim().toUpperCase() as "CA" | "NY" | "TX"];
  return source?.regulatorName ?? "State regulator";
}

export function officialAssistedLivingSourceUrl(stateCode: string): string | null {
  const source =
    ASSISTED_LIVING_STATE_SOURCES[stateCode.trim().toUpperCase() as "CA" | "NY" | "TX"];
  return source?.officialSourceUrl ?? null;
}

export function officialAssistedLivingDatasetName(stateCode: string): string {
  const code = stateCode.trim().toUpperCase();
  if (code === "CA") return "CDSS Community Care Licensing RCFE listing";
  if (code === "NY") return "NYS DOH Health Facility General Information (Adult Care Facilities)";
  if (code === "TX") return "HHSC Directory of Assisted Living Facility Providers";
  return "State regulator listing";
}

export interface AssistedLivingStatusCopy {
  readonly headline: string | null;
  readonly detail: string;
  readonly prominent: boolean;
}

export function assistedLivingStatusCopy(input: {
  stateCode: string;
  licenseStatusReported: boolean;
  consumerStatus: string | null;
  sourceDirectoryContext: string;
}): AssistedLivingStatusCopy {
  const state = input.stateCode.trim().toUpperCase();
  const status = (input.consumerStatus ?? "").trim();
  if (state === "CA" && status.toUpperCase() === "ON PROBATION") {
    return {
      headline: "Regulator status: On Probation",
      detail:
        "California Community Care Licensing currently lists this facility as On Probation. This is the official regulator status, not a SeniorTrustHub rating.",
      prominent: true,
    };
  }
  if (state === "CA" && input.licenseStatusReported && status) {
    return {
      headline: `Regulator-reported status: ${status}`,
      detail: "Status comes from the official CDSS Community Care Licensing listing.",
      prominent: false,
    };
  }
  if (state === "NY") {
    return {
      headline: null,
      detail: "Listed in the current NYS DOH Adult Care Facility dataset.",
      prominent: false,
    };
  }
  if (state === "TX") {
    return {
      headline: null,
      detail: "Listed in the current HHSC Assisted Living Facility directory.",
      prominent: false,
    };
  }
  return {
    headline: input.licenseStatusReported && status ? `Regulator-reported status: ${status}` : null,
    detail: "Status is shown only when the official source reports it.",
    prominent: false,
  };
}

export function formatRetrievedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Retrieval date not reported";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

export function capacityLine(value: number | null | undefined): string {
  return licensedCapacityLabel(value);
}

export interface AssistedLivingPublicOrganization {
  readonly role: OrganizationRole;
  readonly name: string;
}

export interface AssistedLivingPublicProvider {
  readonly id: string;
  readonly stateCode: string;
  readonly regulatorCode: string;
  readonly sourceFacilityId: string;
  readonly licenseId: string | null;
  readonly officialName: string;
  readonly officialStreet: string | null;
  readonly officialCity: string | null;
  readonly officialState: string | null;
  readonly officialZip: string | null;
  readonly officialType: string;
  readonly consumerCategory: ConsumerCareCategory;
  readonly licensedCapacity: number | null;
  readonly memoryDesignation: MemoryCareDesignation;
  readonly consumerStatus: string | null;
  readonly licenseStatusReported: boolean;
  readonly sourceDirectoryContext: string;
  readonly organizations: readonly AssistedLivingPublicOrganization[];
  readonly retrievedAt: string;
  readonly sourceLocator: string;
}
