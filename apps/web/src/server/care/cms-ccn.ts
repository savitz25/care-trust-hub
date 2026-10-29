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

export type CanonicalCmsCcnResolution = {
  kind: "none" | "one" | "many";
  ccn: string | null;
};

/**
 * Current CMS CCN rows for one provider. Leading-zero forms of the same
 * identifier count once. Two distinct identifiers is ambiguous: return no CCN
 * rather than picking one by sort order.
 */
export function resolveUniqueCanonicalCmsCcn(
  values: readonly (string | null | undefined)[] | null | undefined,
): CanonicalCmsCcnResolution {
  const distinct = new Set<string>();
  for (const value of values ?? []) {
    const normalized = normalizeLinkableCmsCcn(value);
    if (normalized) distinct.add(normalized);
  }
  if (distinct.size === 0) return { kind: "none", ccn: null };
  if (distinct.size > 1) return { kind: "many", ccn: null };
  return { kind: "one", ccn: [...distinct][0] ?? null };
}

export type ChainMembershipCandidate<T extends string | null = string | null> = {
  providerId: T;
  cmsChainId: string;
  sourceModifiedAt?: Date | string | null;
  retrievedAt?: Date | string | null;
};

/**
 * One chain and one provider is a membership. Several releases of that same
 * pair keep the newest source timestamp. More than one chain or provider is
 * ambiguous and matches nothing.
 */
export function resolveChainMembership<T extends ChainMembershipCandidate>(
  rows: readonly T[],
): T | null {
  if (rows.length === 0) return null;
  const chainIds = new Set(rows.map((row) => row.cmsChainId));
  if (chainIds.size !== 1) return null;
  const providerIds = new Set(rows.map((row) => row.providerId));
  if (providerIds.size !== 1) return null;
  return rows.reduce((latest, row) =>
    membershipTime(row) > membershipTime(latest) ? row : latest,
  );
}

export type ChainFacilitySource = {
  storedCcn: string | null | undefined;
  canonicalCcns: unknown;
  providerName: string;
  state: string;
  overallRating: number | null;
};

/** Current CMS CCN values from a driver array or a PostgreSQL text-array literal. */
export function canonicalCmsCcnList(value: unknown): {
  values: readonly (string | null)[];
  unreadable: boolean;
} {
  if (value == null) return { values: [], unreadable: false };
  if (Array.isArray(value)) {
    return {
      values: value.map((item) => (item == null ? null : String(item))),
      unreadable: false,
    };
  }
  if (typeof value === "string") return postgresCcnArray(value);
  return { values: [], unreadable: true };
}

export type ChainFacilityIdentity = {
  ccn: string;
  providerName: string;
  state: string;
  overallRating: number | null;
};

export type CmsCcnAuthorityRow = {
  providerId: string | null;
  identifierValue: string | null | undefined;
};

/**
 * Lookup keys for one chain page. A leading-zero CCN also probes the five-digit
 * spelling. The caller must pass only that page's candidate values.
 */
export function cmsCcnAuthorityKeys(values: readonly (string | null | undefined)[]): string[] {
  const keys = new Set<string>();
  for (const value of values) {
    const linkable = normalizeLinkableCmsCcn(value);
    if (!linkable) continue;
    keys.add(linkable);
    if (/^0\d{5}$/.test(linkable)) keys.add(linkable.slice(1));
  }
  return [...keys];
}

export function cmsCcnAuthorityKeysFromSources(
  sources: readonly Pick<ChainFacilitySource, "storedCcn" | "canonicalCcns">[],
): string[] {
  const values: (string | null | undefined)[] = [];
  for (const source of sources) {
    values.push(source.storedCcn);
    const listed = canonicalCmsCcnList(source.canonicalCcns);
    if (!listed.unreadable) values.push(...listed.values);
  }
  return cmsCcnAuthorityKeys(values);
}

/** Normalized CCNs whose current rows belong to more than one provider id. */
export function collidingCanonicalCmsCcns(
  rows: readonly CmsCcnAuthorityRow[],
): ReadonlySet<string> {
  const providersByCcn = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.providerId) continue;
    const ccn = normalizeLinkableCmsCcn(row.identifierValue);
    if (!ccn) continue;
    const providers = providersByCcn.get(ccn) ?? new Set<string>();
    providers.add(row.providerId);
    providersByCcn.set(ccn, providers);
  }
  const colliding = new Set<string>();
  for (const [ccn, providers] of providersByCcn) {
    if (providers.size > 1) colliding.add(ccn);
  }
  return colliding;
}

export function chainFacilitiesFromSources(
  sources: readonly ChainFacilitySource[],
  authorityRows: readonly CmsCcnAuthorityRow[],
  excludeCcn?: string | null,
): ChainFacilityIdentity[] {
  const blocked = collidingCanonicalCmsCcns(authorityRows);
  return sources.flatMap((source) => {
    const facility = chainFacilityFromSources(source, excludeCcn, blocked);
    return facility ? [facility] : [];
  });
}

/**
 * A single canonical CCN becomes the link. No canonical CCN keeps a stored
 * six-character CCN and leaves a five-digit value unlinked. Multiple canonical
 * CCNs, and a CCN owned by more than one provider, stay on the list without a
 * profile link.
 */
export function chainFacilityFromSources(
  source: ChainFacilitySource,
  excludeCcn?: string | null,
  blockedCcns?: ReadonlySet<string> | null,
): ChainFacilityIdentity | null {
  const listed = canonicalCmsCcnList(source.canonicalCcns);
  const canonical = listed.unreadable
    ? { kind: "many" as const, ccn: null }
    : resolveUniqueCanonicalCmsCcn(listed.values);
  const storedRaw = typeof source.storedCcn === "string" ? source.storedCcn.trim() : "";
  const exclude = normalizeLinkableCmsCcn(excludeCcn);
  const storedIdentity = normalizeLinkableCmsCcn(source.storedCcn);
  const excluded =
    exclude !== null &&
    (storedIdentity === exclude ||
      (canonical.kind === "one" && canonical.ccn === exclude) ||
      listed.values.some((value) => normalizeLinkableCmsCcn(value) === exclude));
  if (excluded) return null;

  if (canonical.kind === "many") {
    return {
      ccn: unlinkableChainCcn(storedRaw),
      providerName: source.providerName,
      state: source.state,
      overallRating: source.overallRating,
    };
  }

  const resolved = chainFacilityCcn(
    canonical.kind === "one" ? canonical.ccn : null,
    source.storedCcn,
  );
  const preserved = resolved ?? storedRaw;
  if (!preserved) return null;
  const linked = normalizeLinkableCmsCcn(preserved);
  if (linked && blockedCcns?.has(linked)) {
    return {
      ccn: unlinkableChainCcn(storedRaw || preserved),
      providerName: source.providerName,
      state: source.state,
      overallRating: source.overallRating,
    };
  }
  return {
    ccn: preserved,
    providerName: source.providerName,
    state: source.state,
    overallRating: source.overallRating,
  };
}

function unlinkableChainCcn(stored: string): string {
  if (chainFacilityHref(stored, "facility")) return `unresolved:${stored}`;
  return stored || "unresolved";
}

function membershipTime(row: ChainMembershipCandidate): number {
  const modified = timestamp(row.sourceModifiedAt);
  if (modified !== Number.NEGATIVE_INFINITY) return modified;
  return timestamp(row.retrievedAt);
}

function postgresCcnArray(value: string): {
  values: (string | null)[];
  unreadable: boolean;
} {
  const text = value.trim();
  if (text === "{}") return { values: [], unreadable: false };
  if (!(text.startsWith("{") && text.endsWith("}"))) return { values: [], unreadable: true };
  const values: (string | null)[] = [];
  for (const part of text.slice(1, -1).split(",")) {
    const raw = part.trim();
    const quoted = raw.startsWith('"') && raw.endsWith('"');
    const token = quoted ? raw.slice(1, -1).replace(/""/g, '"') : raw;
    if (!quoted && token === "NULL") {
      values.push(null);
      continue;
    }
    if (!/^[A-Za-z0-9]+$/.test(token)) return { values: [], unreadable: true };
    values.push(token);
  }
  return { values, unreadable: false };
}

function timestamp(value: Date | string | null | undefined): number {
  if (value == null || value === "") return Number.NEGATIVE_INFINITY;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time;
}

function sixCharacterCcn(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(normalized) ? normalized : null;
}
