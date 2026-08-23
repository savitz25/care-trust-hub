/**
 * ASK-SEARCH-SENIOR-001 — thin nursing-facility discovery projection helpers.
 * Pure functions (no DB / network). Used by export script + vitest.
 */

export const ASK_NETWORK_DISCOVERY_SCHEMA = 'ask-network-discovery-v1' as const;
export const SENIOR_HUB = 'senior' as const;
export const CANONICAL_HOST = 'www.seniortrusthub.com';
export const CANONICAL_ORIGIN = `https://${CANONICAL_HOST}`;
export const PILOT_BANNER = 'PILOT / NOT YET CONSUMED BY ASK PRODUCTION';
export const PILOT_TARGET = 200;
export const ENTITY_TYPE_NURSING = 'nursing_facility' as const;

export type SeniorDiscoveryEntityType = typeof ENTITY_TYPE_NURSING;

export type DiscoveryStatus = 'eligible' | 'held' | 'ineligible';

export type SeniorDiscoveryEntity = {
  network_entity_id: string;
  hub: typeof SENIOR_HUB;
  source_entity_id: string;
  entity_type: SeniorDiscoveryEntityType;
  display_name: string;
  legal_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  categories?: string[];
  regulatory_status_summary?: string;
  trust_report_available: boolean;
  canonical_profile_url: string;
  canonical_search_url?: string;
  search_terms?: string[];
  discovery_status: DiscoveryStatus;
  source_version?: string;
  updated_at?: string;
  physical_location?: {
    city: string | null;
    state: string | null;
    postal_code: string | null;
    county: string | null;
    country: 'US' | null;
  };
};

export type FacilityDiscoverySourceRow = {
  ccn: string;
  slug?: string;
  displayName: string;
  legalName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  county?: string | null;
  currentlyIndexable?: boolean;
  trustReportEligible?: boolean;
  isSynthetic?: boolean;
};

export type DiscoveryIneligibilityReason =
  | 'synthetic'
  | 'missing_ccn'
  | 'malformed_ccn'
  | 'missing_name'
  | 'missing_usable_us_state'
  | 'missing_usable_city_or_zip'
  | 'not_wave_indexable'
  | 'not_trust_report_eligible'
  | 'invalid_canonical_url'
  | 'duplicate_ccn';

/** CMS CCN: typically 6 alphanumeric chars (e.g. 015009, 05A189). */
export function normalizeCcn(raw: string): string {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function isValidCcn(raw: string | null | undefined): boolean {
  const ccn = normalizeCcn(raw || '');
  return /^[A-Z0-9]{6}$/.test(ccn);
}

export function buildSeniorNetworkId(ccn: string): string {
  return `senior:ccn-${normalizeCcn(ccn)}`;
}

export function providerSlugFromName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/g, '');
  return slug || 'provider';
}

export function buildCanonicalFacilityProfileUrl(ccn: string, displayName: string): string {
  return `${CANONICAL_ORIGIN}/facility/cms/${normalizeCcn(ccn)}/${providerSlugFromName(displayName)}`;
}

export function validateCanonicalFacilityUrl(url: string): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reasons: ['malformed_url'] };
  }
  if (parsed.protocol !== 'https:') reasons.push('not_https');
  if (parsed.hostname !== CANONICAL_HOST) reasons.push('wrong_host');
  if (parsed.port) reasons.push('non_default_port');
  if (parsed.username || parsed.password) reasons.push('userinfo');
  if (parsed.search || parsed.hash) reasons.push('query_or_hash');
  if (/localhost|127\.0\.0\.1|vercel\.app/i.test(parsed.hostname)) {
    reasons.push('forbidden_host');
  }
  const m = parsed.pathname.match(/^\/facility\/cms\/([A-Z0-9]{6})\/([a-z0-9-]+)$/i);
  if (!m || !isValidCcn(m[1])) reasons.push('malformed_path');
  return { ok: reasons.length === 0, reasons };
}

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DC','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY',
]);

export function isUsStateCode(value: string | null | undefined): boolean {
  if (!value) return false;
  return US_STATES.has(value.trim().toUpperCase());
}

export function evaluateDiscoveryEligibility(
  row: FacilityDiscoverySourceRow
): { ok: true } | { ok: false; reasons: DiscoveryIneligibilityReason[] } {
  const reasons: DiscoveryIneligibilityReason[] = [];
  if (row.isSynthetic) reasons.push('synthetic');
  if (!row.ccn?.trim()) reasons.push('missing_ccn');
  else if (!isValidCcn(row.ccn)) reasons.push('malformed_ccn');
  if (!row.displayName?.trim()) reasons.push('missing_name');
  if (row.trustReportEligible === false) reasons.push('not_trust_report_eligible');
  if (row.currentlyIndexable === false) reasons.push('not_wave_indexable');
  const state = (row.state || '').trim().toUpperCase();
  if (!isUsStateCode(state)) reasons.push('missing_usable_us_state');
  const city = (row.city || '').trim();
  const zip = (row.zip || '').replace(/\D/g, '').slice(0, 5);
  if (!city && zip.length !== 5) reasons.push('missing_usable_city_or_zip');
  if (row.ccn && isValidCcn(row.ccn) && row.displayName?.trim()) {
    const url = buildCanonicalFacilityProfileUrl(row.ccn, row.displayName);
    if (!validateCanonicalFacilityUrl(url).ok) reasons.push('invalid_canonical_url');
  }
  if (reasons.length) return { ok: false, reasons };
  return { ok: true };
}

export function mapFacilityToDiscovery(
  row: FacilityDiscoverySourceRow,
  opts?: { sourceVersion?: string; updatedAt?: string }
): SeniorDiscoveryEntity {
  const ccn = normalizeCcn(row.ccn);
  const state = isUsStateCode(row.state) ? row.state!.trim().toUpperCase() : undefined;
  const city = row.city?.trim() || undefined;
  const zip = row.zip?.replace(/\D/g, '').slice(0, 5) || undefined;
  const zipOk = zip && zip.length === 5 ? zip : undefined;
  const county = row.county?.trim() || undefined;
  const categories = [
    'nursing_facility',
    'nursing_home',
    'skilled_nursing_facility',
    'snf',
  ].sort();
  const search_terms = [
    row.displayName,
    row.legalName,
    'nursing home',
    'nursing facility',
    'skilled nursing facility',
    'snf',
    city,
    state,
    county,
    `ccn ${ccn}`,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase());

  return {
    network_entity_id: buildSeniorNetworkId(ccn),
    hub: SENIOR_HUB,
    source_entity_id: `ccn-${ccn}`,
    entity_type: ENTITY_TYPE_NURSING,
    display_name: row.displayName.trim(),
    legal_name: row.legalName?.trim() || undefined,
    city,
    state,
    zip: zipOk,
    county,
    categories,
    regulatory_status_summary: 'CMS-certified nursing facility (Medicare provider information)',
    trust_report_available: row.trustReportEligible !== false,
    canonical_profile_url: buildCanonicalFacilityProfileUrl(ccn, row.displayName),
    canonical_search_url: state
      ? `${CANONICAL_ORIGIN}/search?state=${encodeURIComponent(state)}`
      : `${CANONICAL_ORIGIN}/search`,
    search_terms: [...new Set(search_terms)],
    discovery_status: 'eligible',
    source_version: opts?.sourceVersion,
    updated_at: opts?.updatedAt,
    physical_location: {
      city: city ?? null,
      state: state ?? null,
      postal_code: zipOk ?? null,
      county: county ?? null,
      country: state ? 'US' : null,
    },
  };
}

/**
 * Deterministic cohort: stable sort by network_entity_id, optional state
 * round-robin for geographic diversity, final sort by network_entity_id.
 * No Five-Star / Trust Score / Premium / popularity.
 */
export function selectPilotCohort(
  eligible: SeniorDiscoveryEntity[],
  target = PILOT_TARGET
): SeniorDiscoveryEntity[] {
  const byState = new Map<string, SeniorDiscoveryEntity[]>();
  for (const e of [...eligible].sort((a, b) =>
    a.network_entity_id.localeCompare(b.network_entity_id)
  )) {
    const st = e.state || '_NONE';
    const list = byState.get(st) || [];
    list.push(e);
    byState.set(st, list);
  }
  const states = [...byState.keys()].sort();
  const queues = states.map((st) => [...(byState.get(st) || [])]);
  const picked: SeniorDiscoveryEntity[] = [];
  let progress = true;
  while (picked.length < target && progress) {
    progress = false;
    for (const q of queues) {
      if (picked.length >= target) break;
      if (q.length) {
        picked.push(q.shift()!);
        progress = true;
      }
    }
  }
  return picked.sort((a, b) => a.network_entity_id.localeCompare(b.network_entity_id));
}

export function rejectDuplicateCcns(entities: SeniorDiscoveryEntity[]): {
  ok: boolean;
  duplicates: string[];
} {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const e of entities) {
    const ccn = e.source_entity_id.replace(/^ccn-/i, '');
    if (seen.has(ccn)) duplicates.push(ccn);
    seen.add(ccn);
  }
  return { ok: duplicates.length === 0, duplicates };
}

export function slugifyCityToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function matchesPhysicalCity(
  entity: SeniorDiscoveryEntity,
  city: string,
  state?: string
): boolean {
  if (!city?.trim() || !entity.city) return false;
  if (slugifyCityToken(entity.city) !== slugifyCityToken(city)) return false;
  if (state) {
    return (entity.state || '') === state.trim().toUpperCase();
  }
  return true;
}

export function matchesPhysicalState(entity: SeniorDiscoveryEntity, state: string): boolean {
  return (entity.state || '') === state.trim().toUpperCase();
}

/** Nursing / SNF synonym matching — all map to nursing_facility entity. */
export const NURSING_SNF_QUERY_SYNONYMS = [
  'nursing home',
  'nursing facility',
  'skilled nursing facility',
  'snf',
] as const;

export function nursingSynonymMatchesFacility(_query: string): boolean {
  return true; // synonyms resolve to nursing_facility rows only
}

/** Fail-closed unsupported care types for this nursing pilot. */
export const UNSUPPORTED_CARE_TYPE_QUERIES = [
  'memory care Austin TX',
  'assisted living Austin TX',
  'home care agency Austin TX',
] as const;

export function unsupportedCareTypeMatchesNursingFacility(_query: string): never[] {
  // Do not substitute nursing facilities for AL / memory care / home care.
  return [];
}

export function contentFingerprintPayload(entities: SeniorDiscoveryEntity[]): unknown {
  return entities.map((e) => {
    const { updated_at: _u, ...rest } = e;
    return rest;
  });
}
