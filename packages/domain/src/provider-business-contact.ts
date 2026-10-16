/** National provider types that can carry a business contact row. */
export const PROVIDER_BUSINESS_CONTACT_TYPES = [
  "nursing_home",
  "home_health",
  "hospice",
  "assisted_living",
] as const;

export type ProviderBusinessContactType = (typeof PROVIDER_BUSINESS_CONTACT_TYPES)[number];

const CMS_KEY = /^[A-Z0-9]{6}$/;
const ASSISTED_LIVING_KEY = /^[A-Z]{2}:[A-Z0-9_]+:[^:\s]+$/;
const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

export interface ProviderBusinessContactRow {
  providerType: string;
  providerKey: string;
  websiteUrl: string | null;
  email: string | null;
  phoneOverride: string | null;
  sourceUrls: readonly string[];
  sourceType: string;
  confidence: number | null;
  verifiedAt: string | null;
  isPublic: boolean;
  updatedAt: string | null;
}

/** Values a profile may render. Null means show nothing. */
export interface PublicProviderBusinessContact {
  websiteUrl: string | null;
  email: string | null;
  phoneOverride: string | null;
  sourceType: string;
  sourceUrls: readonly string[];
  verifiedAt: string | null;
  updatedAt: string | null;
}

export function isProviderBusinessContactType(value: string): value is ProviderBusinessContactType {
  return (PROVIDER_BUSINESS_CONTACT_TYPES as readonly string[]).includes(value);
}

/**
 * CMS rows use the uppercase CCN. Assisted living uses
 * STATE:REGULATOR:SOURCE_FACILITY_ID (assisted_living_provider.external_key).
 */
export function normalizeProviderBusinessContactKey(
  providerType: string,
  providerKey: string,
): { providerType: ProviderBusinessContactType; providerKey: string } | null {
  if (!isProviderBusinessContactType(providerType)) return null;
  const compact = providerKey.trim().replace(/\s+/g, "").toUpperCase();
  if (!compact) return null;
  if (providerType === "assisted_living") {
    return ASSISTED_LIVING_KEY.test(compact) ? { providerType, providerKey: compact } : null;
  }
  return CMS_KEY.test(compact) ? { providerType, providerKey: compact } : null;
}

export function assistedLivingBusinessContactKey(
  stateCode: string,
  regulatorCode: string,
  sourceFacilityId: string,
): string | null {
  return (
    normalizeProviderBusinessContactKey(
      "assisted_living",
      `${stateCode}:${regulatorCode}:${sourceFacilityId}`,
    )?.providerKey ?? null
  );
}

/** https only. Credentials and non-URLs stay off the page. */
export function publicBusinessWebsite(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 500) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (!url.hostname) return null;
  return url.href;
}

export function publicBusinessEmail(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || trimmed.length > 254 || !EMAIL.test(trimmed)) return null;
  return trimmed;
}

export function publicBusinessPhone(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length < 7 || trimmed.length > 40) return null;
  if (!/^[\d\s().+-]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Publication rule for profile pages: a row renders only when is_public is
 * true and at least one of website, email, or phone survives validation.
 */
export function selectPublicProviderBusinessContact(
  row: ProviderBusinessContactRow | null | undefined,
): PublicProviderBusinessContact | null {
  if (!row || row.isPublic !== true) return null;
  const identity = normalizeProviderBusinessContactKey(row.providerType, row.providerKey);
  if (!identity) return null;
  const sourceType = row.sourceType.trim();
  if (!sourceType || sourceType.length > 80) return null;
  const websiteUrl = publicBusinessWebsite(row.websiteUrl);
  const email = publicBusinessEmail(row.email);
  const phoneOverride = publicBusinessPhone(row.phoneOverride);
  if (!websiteUrl && !email && !phoneOverride) return null;
  const sourceUrls = row.sourceUrls
    .map((url) => publicBusinessWebsite(url))
    .filter((url): url is string => Boolean(url))
    .slice(0, 8);
  return {
    websiteUrl,
    email,
    phoneOverride,
    sourceType,
    sourceUrls,
    verifiedAt: timestampOrNull(row.verifiedAt),
    updatedAt: timestampOrNull(row.updatedAt),
  };
}

function timestampOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}
