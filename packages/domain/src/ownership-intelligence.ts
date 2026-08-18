import type { ResolutionState } from "./facility-intelligence";

export const PORTFOLIO_MIN_FACILITIES = 3;
export const PORTFOLIO_MIN_METRIC_SAMPLE = 3;
export const HIGH_VALUE_FINE_USD = 10_000;
export const RECENT_ENFORCEMENT_MONTHS = 18;
export const PORTFOLIO_METRICS_DISCLAIMER =
  "These figures summarize currently connected CMS-certified nursing homes. Some facilities have incomplete measures; missing values are omitted, not treated as zero. Ownership structures can change. State operator or licensee evidence may differ from CMS ownership disclosures.";

export type MembershipStatus = "current" | "historical" | "uncertain";
export type OrganizationRisk = "clear" | "generic" | "person_like";
export type OrganizationMatchMethod = "authoritative_identifier" | "fuzzy_name";

export const OWNERSHIP_ROLES = [
  "individual_owner",
  "organization_owner",
  "indirect_owner",
  "managing_organization",
  "operator",
  "state_licensee",
  "state_management_company",
  "chain",
  "other",
] as const;

export type OwnershipRole = (typeof OWNERSHIP_ROLES)[number];

export interface OwnershipPartyLike {
  kind: "organization" | "individual";
  displayName: string;
  roleText: string;
  organizationId?: string | null;
  connectedProviderCount?: number | null;
}

export interface PortfolioFacilityInput {
  overallRating: number | null;
  staffingRating: number | null;
  healthInspectionRating: number | null;
  qualityMeasureRating: number | null;
  rnHprd: number | null;
  totalNurseHprd: number | null;
  hadPenalty: boolean;
  penaltyAmount: number | null;
  hadOwnershipChange: boolean;
  hadRecentStateEnforcement: boolean;
  hadRecentCmsPenalty: boolean;
  hadRecentHighValueEnforcement: boolean;
  hadRecentComplaintInspection: boolean;
}

export interface RatingMetric {
  average: number | null;
  sampleSize: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface OwnershipPortfolioMetrics {
  facilityCount: number;
  stateCount: number;
  overall: RatingMetric;
  staffing: RatingMetric;
  healthInspection: RatingMetric;
  qualityMeasure: RatingMetric;
  averageRnHprd: number | null;
  rnSampleSize: number;
  averageTotalNurseHprd: number | null;
  totalNurseSampleSize: number;
  facilitiesWithPenalty: number;
  totalFineAmount: number | null;
  facilitiesWithOwnershipChange: number;
  facilitiesWithRecentStateEnforcement: number;
  facilitiesWithRecentCmsPenalty: number;
  facilitiesWithRecentHighValueEnforcement: number;
  facilitiesWithRecentComplaintInspection: number;
}

export function normalizeOrganizationName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/,/g, " ")
    .replace(/\./g, "")
    .replace(/\b(l l c|llc)\b/g, "llc")
    .replace(/\b(inc|incorporated)\b/g, "inc")
    .replace(/\b(corp|corporation)\b/g, "corp")
    .replace(/\b(ltd|limited)\b/g, "ltd")
    .replace(/\s+/g, " ")
    .trim();
}

export function organizationLabelsCompatible(left: string, right: string): boolean {
  const a = normalizeOrganizationName(left);
  const b = normalizeOrganizationName(right);
  return Boolean(a && b && a === b);
}

const GENERIC_STEMS = new Set([
  "care",
  "health",
  "healthcare",
  "health care",
  "holdings",
  "management",
  "medical",
  "nursing",
  "nursing home",
  "properties",
  "property",
  "realty",
  "senior care",
  "senior living",
  "services",
]);

export function classifyOrganizationRisk(name: string): OrganizationRisk {
  const compact = name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (/^[a-z]+(?:[-'][a-z]+)*, [a-z]+(?: [a-z])?$/.test(compact)) return "person_like";
  const normalized = normalizeOrganizationName(name);
  if (!normalized) return "generic";
  const stem = normalized
    .replace(/\b(llc|inc|corp|ltd|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem || stem.length < 4 || GENERIC_STEMS.has(stem)) return "generic";
  return "clear";
}

export function classifyMembershipStatus(input: {
  inLatestSuccessfulRelease: boolean;
  seenInOlderRelease: boolean;
}): MembershipStatus {
  if (input.inLatestSuccessfulRelease) return "current";
  if (input.seenInOlderRelease) return "historical";
  return "uncertain";
}

export function selectCurrentMembers<T extends { membershipStatus: MembershipStatus }>(
  members: readonly T[],
): T[] {
  return members.filter((member) => member.membershipStatus === "current");
}

export function canPublishPortfolioMembership(input: {
  organizationId: string | null | undefined;
  resolutionState: ResolutionState;
  matchMethod: OrganizationMatchMethod;
}): boolean {
  return (
    Boolean(input.organizationId) &&
    input.resolutionState === "VERIFIED" &&
    input.matchMethod === "authoritative_identifier"
  );
}

export function isPortfolioPublicationEligible(input: {
  resolutionState: ResolutionState;
  currentFacilityCount: number;
  risk: OrganizationRisk;
}): boolean {
  return (
    input.resolutionState === "VERIFIED" &&
    input.currentFacilityCount >= PORTFOLIO_MIN_FACILITIES &&
    input.risk === "clear"
  );
}

export function isOrganizationPageIndexable(input: { publicationEligible: boolean }): boolean {
  return input.publicationEligible;
}

export function corroboratesGovernmentSources(input: {
  cmsOrganizationNames: readonly string[];
  stateOperator: string | null;
  stateLicensee: string | null;
}): boolean {
  return input.cmsOrganizationNames.some((name) => {
    if (input.stateOperator && organizationLabelsCompatible(name, input.stateOperator)) {
      return true;
    }
    return Boolean(input.stateLicensee && organizationLabelsCompatible(name, input.stateLicensee));
  });
}

export function classifyOwnershipRole(
  party: Pick<OwnershipPartyLike, "kind" | "roleText">,
): OwnershipRole {
  const role = party.roleText.toLowerCase();
  if (role.includes("managerial") || role.includes("operational") || role.includes("managing")) {
    return "managing_organization";
  }
  if (role.includes("indirect")) return "indirect_owner";
  if (role.includes("ownership") || role.includes("owner")) {
    return party.kind === "individual" ? "individual_owner" : "organization_owner";
  }
  return "other";
}

export function selectPortfolioOrganization<T extends OwnershipPartyLike>(
  parties: readonly T[],
): T | null {
  const eligible = parties.filter(
    (party) =>
      party.kind === "organization" &&
      Boolean(party.organizationId) &&
      (party.connectedProviderCount ?? 0) >= PORTFOLIO_MIN_FACILITIES,
  );
  if (!eligible.length) return null;
  const owners = eligible.filter((party) => {
    const role = classifyOwnershipRole(party);
    return role === "organization_owner" || role === "indirect_owner";
  });
  const pool = owners.length ? owners : eligible;
  return [...pool].sort(
    (left, right) => (right.connectedProviderCount ?? 0) - (left.connectedProviderCount ?? 0),
  )[0]!;
}

function ratingMetric(values: Array<number | null>): RatingMetric {
  const valid = values.filter(
    (value): value is number =>
      value != null && Number.isInteger(value) && value >= 1 && value <= 5,
  );
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const value of valid) distribution[value as 1 | 2 | 3 | 4 | 5] += 1;
  const sampleSize = valid.length;
  const average =
    sampleSize >= PORTFOLIO_MIN_METRIC_SAMPLE
      ? Number((valid.reduce((sum, value) => sum + value, 0) / sampleSize).toFixed(1))
      : null;
  return { average, sampleSize, distribution };
}

function averageNumeric(values: Array<number | null>): {
  average: number | null;
  sampleSize: number;
} {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return {
    sampleSize: valid.length,
    average:
      valid.length >= PORTFOLIO_MIN_METRIC_SAMPLE
        ? Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2))
        : null,
  };
}

export function computePortfolioMetrics(
  facilities: readonly PortfolioFacilityInput[],
  stateCount: number,
): OwnershipPortfolioMetrics {
  const rn = averageNumeric(facilities.map((facility) => facility.rnHprd));
  const total = averageNumeric(facilities.map((facility) => facility.totalNurseHprd));
  const fines = facilities
    .map((facility) => facility.penaltyAmount)
    .filter((value): value is number => value != null && value > 0);
  return {
    facilityCount: facilities.length,
    stateCount,
    overall: ratingMetric(facilities.map((facility) => facility.overallRating)),
    staffing: ratingMetric(facilities.map((facility) => facility.staffingRating)),
    healthInspection: ratingMetric(facilities.map((facility) => facility.healthInspectionRating)),
    qualityMeasure: ratingMetric(facilities.map((facility) => facility.qualityMeasureRating)),
    averageRnHprd: rn.average,
    rnSampleSize: rn.sampleSize,
    averageTotalNurseHprd: total.average,
    totalNurseSampleSize: total.sampleSize,
    facilitiesWithPenalty: facilities.filter((facility) => facility.hadPenalty).length,
    totalFineAmount: fines.length ? fines.reduce((sum, value) => sum + value, 0) : null,
    facilitiesWithOwnershipChange: facilities.filter((facility) => facility.hadOwnershipChange)
      .length,
    facilitiesWithRecentStateEnforcement: facilities.filter(
      (facility) => facility.hadRecentStateEnforcement,
    ).length,
    facilitiesWithRecentCmsPenalty: facilities.filter((facility) => facility.hadRecentCmsPenalty)
      .length,
    facilitiesWithRecentHighValueEnforcement: facilities.filter(
      (facility) => facility.hadRecentHighValueEnforcement,
    ).length,
    facilitiesWithRecentComplaintInspection: facilities.filter(
      (facility) => facility.hadRecentComplaintInspection,
    ).length,
  };
}

export function whoIsBehindItems(input: {
  operator: string | null;
  licensee: string | null;
  organizationOwners: number;
  individuals: number;
  chainName: string | null;
  ownershipChanges: number;
}): string[] {
  const items: string[] = [];
  if (input.operator) items.push("an operating organization identified by the state regulator");
  if (input.licensee) items.push("a state licensee");
  if (input.organizationOwners > 0) {
    items.push(
      `${input.organizationOwners} CMS-reported ownership ${input.organizationOwners === 1 ? "organization" : "organizations"}`,
    );
  }
  if (input.individuals > 0) {
    items.push(
      `CMS reports ${input.individuals} individual ownership ${input.individuals === 1 ? "interest" : "interests"}`,
    );
  }
  if (input.chainName) items.push("a CMS chain / common-control group");
  if (input.ownershipChanges > 0) items.push("recorded ownership-change events");
  return items;
}
