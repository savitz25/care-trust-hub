import { formatVerifiedCheckedLabel } from "./enrichment-publication";
import type { ResolutionState } from "./facility-intelligence";
import type { StateClaimType } from "./state-regulator";

export const PUBLISHABLE_STATE_CODES = ["CA", "NY", "TX"] as const;
export type PublishableStateCode = (typeof PUBLISHABLE_STATE_CODES)[number];

export const CONSUMER_PUBLISHABLE_STATE_CLAIMS = [
  "STATE_LICENSE_ID",
  "STATE_LICENSE_STATUS",
  "STATE_LICENSE_TYPE",
  "STATE_LICENSE_CAPACITY",
  "STATE_LICENSEE",
  "STATE_OPERATOR",
  "STATE_ADMINISTRATOR",
  "STATE_MANAGEMENT_ENTITY",
] as const;

export type ConsumerPublishableStateClaim = (typeof CONSUMER_PUBLISHABLE_STATE_CLAIMS)[number];

const STATE_STATUS_ALLOWED: Record<PublishableStateCode, boolean> = {
  CA: true,
  NY: false,
  TX: false,
};

export const STATE_REGULATOR_PUBLICATION = {
  CA: {
    stateCode: "CA" as const,
    regulator: "California Department of Public Health",
    datasetName: "Licensed and Certified Healthcare Facility Listing",
    officialUrl: "https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
    licenseLabel: "State license",
  },
  NY: {
    stateCode: "NY" as const,
    regulator: "New York State Department of Health",
    datasetName: "Health Facility General Information (HFIS)",
    officialUrl: "https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r",
    licenseLabel: "Operating certificate",
  },
  TX: {
    stateCode: "TX" as const,
    regulator: "Texas Health and Human Services Commission",
    datasetName: "Directory of Nursing Facilities with an Active License",
    officialUrl:
      "https://www.hhs.texas.gov/providers/long-term-care-providers/nursing-facilities-nf",
    licenseLabel: "State license",
  },
} as const;

export interface StateClaimRecord {
  claimType: string;
  resolutionState: ResolutionState;
  value: string | null;
  resolvedAt: string;
}

export interface PublishedStateField {
  value: string;
  resolvedAt: string;
  claimType: ConsumerPublishableStateClaim;
}

export interface PublishedStateIntelligence {
  stateCode: PublishableStateCode;
  regulator: string;
  datasetName: string;
  officialUrl: string;
  licenseLabel: string;
  licenseId: PublishedStateField | null;
  licenseStatus: PublishedStateField | null;
  licenseType: PublishedStateField | null;
  licensedCapacity: PublishedStateField | null;
  licensee: PublishedStateField | null;
  operator: PublishedStateField | null;
  administrator: PublishedStateField | null;
  managementCompany: PublishedStateField | null;
  checkedAt: string | null;
  checkedLabel: string | null;
}

export function isPublishableStateCode(
  value: string | null | undefined,
): value is PublishableStateCode {
  return Boolean(value && (PUBLISHABLE_STATE_CODES as readonly string[]).includes(value));
}

function field(
  claims: Map<string, StateClaimRecord>,
  type: ConsumerPublishableStateClaim,
): PublishedStateField | null {
  const claim = claims.get(type);
  if (!claim?.value?.trim() || claim.resolutionState !== "VERIFIED") return null;
  return { value: claim.value.trim(), resolvedAt: claim.resolvedAt, claimType: type };
}

/**
 * Fail-closed consumer selector. VERIFIED STATE_LICENSE_ID is required.
 * NY/TX license status is never manufactured.
 */
export function selectPublishedStateIntelligence(input: {
  stateCode: string | null | undefined;
  claims: readonly StateClaimRecord[];
}): PublishedStateIntelligence | null {
  if (!isPublishableStateCode(input.stateCode)) return null;
  const byType = new Map(
    input.claims
      .filter(
        (claim) =>
          claim.resolutionState === "VERIFIED" &&
          (CONSUMER_PUBLISHABLE_STATE_CLAIMS as readonly string[]).includes(claim.claimType) &&
          Boolean(claim.value?.trim()),
      )
      .map((claim) => [claim.claimType, claim]),
  );
  const licenseId = field(byType, "STATE_LICENSE_ID");
  if (!licenseId) return null;

  const meta = STATE_REGULATOR_PUBLICATION[input.stateCode];
  const licenseStatus = STATE_STATUS_ALLOWED[input.stateCode]
    ? field(byType, "STATE_LICENSE_STATUS")
    : null;
  const published: PublishedStateIntelligence = {
    stateCode: input.stateCode,
    regulator: meta.regulator,
    datasetName: meta.datasetName,
    officialUrl: meta.officialUrl,
    licenseLabel: meta.licenseLabel,
    licenseId,
    licenseStatus,
    licenseType: field(byType, "STATE_LICENSE_TYPE"),
    licensedCapacity: field(byType, "STATE_LICENSE_CAPACITY"),
    licensee: field(byType, "STATE_LICENSEE"),
    operator: field(byType, "STATE_OPERATOR"),
    administrator: field(byType, "STATE_ADMINISTRATOR"),
    managementCompany: field(byType, "STATE_MANAGEMENT_ENTITY"),
    checkedAt: licenseId.resolvedAt,
    checkedLabel: formatVerifiedCheckedLabel(licenseId.resolvedAt).replace(
      "Verified public information",
      "State regulatory data",
    ),
  };
  return published;
}

export function isConsumerPublishableStateClaim(
  claim: StateClaimRecord,
  stateCode: string | null | undefined,
): boolean {
  if (!isPublishableStateCode(stateCode)) return false;
  if (claim.resolutionState !== "VERIFIED") return false;
  if (!(CONSUMER_PUBLISHABLE_STATE_CLAIMS as readonly string[]).includes(claim.claimType)) {
    return false;
  }
  if (claim.claimType === "STATE_LICENSE_STATUS" && !STATE_STATUS_ALLOWED[stateCode]) return false;
  return Boolean(claim.value?.trim());
}

export type { StateClaimType };
