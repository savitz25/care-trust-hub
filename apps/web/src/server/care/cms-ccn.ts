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
 * Prefer the provider's canonical CMS identifier. A five-digit canonical value
 * is restored to six characters. A five-digit membership value with no canonical
 * identifier stays unresolved so the link layer does not invent a provider.
 */
export function chainFacilityCcn(
  canonical: string | null | undefined,
  stored: string | null | undefined,
): string | null {
  const canonicalCcn = normalizeLinkableCmsCcn(canonical);
  if (canonicalCcn) return canonicalCcn;
  return sixCharacterCcn(stored);
}

/** Link only an already resolved six-character CCN. */
export function chainFacilityHref(ccn: string, providerName: string): string | null {
  const normalized = sixCharacterCcn(ccn);
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
