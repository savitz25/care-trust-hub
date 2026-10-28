import { providerHref } from "./consumer";

/**
 * CMS source files sometimes drop one leading zero from a numeric CCN.
 * This matches care_ingest.ownership.normalize_cms_ccn: only a five-digit
 * numeric value is padded. An existing six-character CCN is unchanged.
 */
export function normalizeCmsCcn(value: string): string {
  const normalized = value.trim().toUpperCase();
  return /^\d{5}$/.test(normalized) ? normalized.padStart(6, "0") : normalized;
}

/** A CCN the facility route can look up. Anything else must not become a URL. */
export function normalizeLinkableCmsCcn(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = normalizeCmsCcn(value);
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}

/**
 * Prefer a six-character CMS identifier already on the provider.
 * Pad the stored membership identifier only when that canonical value is absent.
 */
export function chainFacilityCcn(
  canonical: string | null | undefined,
  stored: string | null | undefined,
): string | null {
  const canonicalSix = sixCharacterCcn(canonical);
  if (canonicalSix) return canonicalSix;
  const storedSix = sixCharacterCcn(stored);
  if (storedSix) return storedSix;
  return normalizeLinkableCmsCcn(canonical) ?? normalizeLinkableCmsCcn(stored);
}

export function chainFacilityHref(ccn: string, providerName: string): string | null {
  const normalized = normalizeLinkableCmsCcn(ccn);
  if (!normalized) return null;
  return providerHref({ ccn: normalized, providerName });
}

/** Exact membership keys for a facility-page CCN, including one dropped leading zero. */
export function cmsCcnMembershipKeys(ccn: string): string[] {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) return [];
  if (/^0\d{5}$/.test(value)) return [value, value.slice(1)];
  return [value];
}

function sixCharacterCcn(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}
