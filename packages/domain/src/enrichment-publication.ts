import type { ResolutionState, WebsiteClassification } from "./facility-intelligence";

/** Field-level claims that may appear on consumer pages once VERIFIED and eligible. */
export const CONSUMER_PUBLISHABLE_CLAIM_TYPES = [
  "google_official_website",
  "google_public_phone",
  "google_public_name",
] as const;

export type ConsumerPublishableClaimType = (typeof CONSUMER_PUBLISHABLE_CLAIM_TYPES)[number];

/** Internal identity / corroboration — never consumer-published. */
export const CONSUMER_INTERNAL_CLAIM_TYPES = [
  "google_place_identity",
  "google_physical_address",
  "google_business_status",
] as const;

export const PUBLISHABLE_WEBSITE_CLASSIFICATIONS = [
  "FACILITY_OFFICIAL",
  "OPERATOR_FACILITY_PAGE",
  "HEALTH_SYSTEM_FACILITY_PAGE",
] as const;

export interface FacilityClaimRecord {
  claimType: string;
  resolutionState: ResolutionState;
  publicationEligible: boolean;
  value: string | null;
  resolvedAt: string;
}

export interface PublishedFacilityField {
  value: string;
  resolvedAt: string;
  claimType: ConsumerPublishableClaimType;
}

export interface PublishedFacilityEnrichment {
  website: PublishedFacilityField | null;
  phone: PublishedFacilityField | null;
  publicAlias: PublishedFacilityField | null;
}

export function isConsumerPublishableClaimType(
  claimType: string,
): claimType is ConsumerPublishableClaimType {
  return (CONSUMER_PUBLISHABLE_CLAIM_TYPES as readonly string[]).includes(claimType);
}

export function isConsumerPublishableClaim(claim: FacilityClaimRecord): boolean {
  return (
    claim.resolutionState === "VERIFIED" &&
    isConsumerPublishableClaimType(claim.claimType) &&
    Boolean(claim.value?.trim())
  );
}

export function classifyPublicWebsite(url: string): WebsiteClassification {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "UNKNOWN";
  }
  if (parsed.protocol !== "https:") return "INSECURE_HTTP";
  const host = parsed.hostname.toLowerCase();
  if (/facebook|instagram|linkedin|youtube|x\.com|twitter/.test(host)) return "SOCIAL_MEDIA";
  if (/nursinghomes|caring\.com|senioradvisor|yelp|yellowpages|mapquest/.test(host)) {
    return "THIRD_PARTY_DIRECTORY";
  }
  if (/aplaceformom|seniorly|assistedliving/.test(host)) return "LEAD_GENERATION";
  if (parsed.pathname !== "/" && parsed.pathname.length > 1) return "OPERATOR_FACILITY_PAGE";
  return "FACILITY_OFFICIAL";
}

export function isPublishableOfficialWebsite(url: string): boolean {
  return (PUBLISHABLE_WEBSITE_CLASSIFICATIONS as readonly string[]).includes(
    classifyPublicWebsite(url),
  );
}

export function normalizePublicPhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "").slice(-10);
}

export function publicPhonesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const a = normalizePublicPhone(left);
  const b = normalizePublicPhone(right);
  return a.length === 10 && a === b;
}

export function normalizeComparableName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|inc|corp|co|ltd|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isMeaningfulPublicAlias(cmsName: string, publicName: string): boolean {
  const cms = normalizeComparableName(cmsName);
  const alias = normalizeComparableName(publicName);
  return Boolean(cms && alias && cms !== alias);
}

/**
 * Consumer publication selector. Field-level VERIFIED only.
 * A VERIFIED Place identity never promotes an unpublished field.
 */
export function selectPublishedFacilityEnrichment(input: {
  claims: readonly FacilityClaimRecord[];
  identityState: ResolutionState | null;
  cmsName: string;
  cmsPhone: string | null;
}): PublishedFacilityEnrichment {
  const published = input.claims.filter(isConsumerPublishableClaim);
  const byType = new Map(published.map((claim) => [claim.claimType, claim]));

  const websiteClaim = byType.get("google_official_website");
  const website =
    websiteClaim?.value && isPublishableOfficialWebsite(websiteClaim.value)
      ? {
          value: websiteClaim.value,
          resolvedAt: websiteClaim.resolvedAt,
          claimType: "google_official_website" as const,
        }
      : null;

  const phoneClaim = byType.get("google_public_phone");
  const phone =
    phoneClaim?.value && normalizePublicPhone(phoneClaim.value).length === 10
      ? {
          value: phoneClaim.value,
          resolvedAt: phoneClaim.resolvedAt,
          claimType: "google_public_phone" as const,
        }
      : null;

  const aliasClaim = byType.get("google_public_name");
  const publicAlias =
    input.identityState === "VERIFIED" &&
    aliasClaim?.value &&
    isMeaningfulPublicAlias(input.cmsName, aliasClaim.value)
      ? {
          value: aliasClaim.value,
          resolvedAt: aliasClaim.resolvedAt,
          claimType: "google_public_name" as const,
        }
      : null;

  return { website, phone, publicAlias };
}

export function formatVerifiedCheckedLabel(resolvedAt: string): string {
  const date = new Date(resolvedAt);
  if (Number.isNaN(date.getTime())) return "Verified public information";
  const checked = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  return `Verified public information · checked ${checked}`;
}
