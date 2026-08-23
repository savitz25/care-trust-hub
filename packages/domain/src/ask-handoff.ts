/**
 * ASK-SEARCH-SENIOR-002 — SeniorTrustHub Ask handoff (receiving).
 * Allowlisted structured context only. No raw query, no PHI, no Ask runtime.
 */

import { isUsStateCode, slugifyCityToken } from './network-discovery';

export const ASK_HANDOFF_KEYS = [
  'src',
  'journey',
  'state',
  'county',
  'intent',
  'entity',
  'category',
  'city',
  'zip',
  'sid',
] as const;

export type AskHandoffKey = (typeof ASK_HANDOFF_KEYS)[number];

export const ASK_HANDOFF_FORBIDDEN_KEYS = [
  'query',
  'q',
  'email',
  'phone',
  'name',
  'resident_name',
  'patient_name',
  'family_name',
  'street_address',
  'address',
  'diagnosis',
  'medication',
  'medical_record',
  'health_data',
  'care_plan',
  'account',
  'ssn',
  'income',
  'document',
  'next',
  'redirect',
  'returnUrl',
  'return_url',
  'lat',
  'lng',
  'latitude',
  'longitude',
] as const;

export const SENIOR_ASK_ENTITY = 'nursing_facility' as const;
export type SeniorAskEntity = typeof SENIOR_ASK_ENTITY;

export const SENIOR_ASK_ENTITY_ALIASES = [
  'nursing_facility',
  'nursing_home',
  'skilled_nursing_facility',
  'snf',
] as const;

export const SENIOR_ASK_CATEGORIES = [
  'nursing_home',
  'skilled_nursing_facility',
  'snf',
] as const;
export type SeniorAskCategory = (typeof SENIOR_ASK_CATEGORIES)[number];

export const UNSUPPORTED_SENIOR_ENTITIES = [
  'assisted_living',
  'memory_care',
  'home_care',
  'home_health',
  'home_care_agency',
  'home_health_agency',
  'residential_care',
] as const;

export type SeniorAskUnsupportedReason =
  | 'assisted_living'
  | 'memory_care'
  | 'home_care'
  | 'wrong_entity'
  | 'invalid_context';

export type SeniorAskSearchContext = {
  source: 'ask';
  entityType?: SeniorAskEntity;
  category?: SeniorAskCategory;
  state?: string;
  city?: string;
  zip?: string;
  county?: string;
  journey?: string;
  intent?: string;
  sid?: string;
  unsupported?: SeniorAskUnsupportedReason;
};

export type AskHandoffDestination =
  | {
      kind: 'search';
      href: string;
      context: SeniorAskSearchContext;
      backLabel: string;
    }
  | {
      kind: 'unsupported';
      href: string;
      context: SeniorAskSearchContext;
      reason: SeniorAskUnsupportedReason;
      backLabel: string;
    };

const FORBIDDEN = new Set<string>(ASK_HANDOFF_FORBIDDEN_KEYS);
const ENTITY_ALIAS = new Set<string>(SENIOR_ASK_ENTITY_ALIASES);
const CATEGORY_SET = new Set<string>(SENIOR_ASK_CATEGORIES);
const UNSUPPORTED_SET = new Set<string>(UNSUPPORTED_SENIOR_ENTITIES);

const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
};

function firstParam(v: string | string[] | undefined | null): string | undefined {
  if (v == null) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  if (typeof s !== 'string') return undefined;
  const t = s.trim();
  return t || undefined;
}

function looksUnsafe(raw: string): boolean {
  return /[<>`]|javascript:|data:|\/|\.\./i.test(raw);
}

export function sanitizeAskToken(raw: string, max = 64): string | undefined {
  if (looksUnsafe(raw)) return undefined;
  const cleaned = raw
    .replace(/[<>`"\\]/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
  return cleaned || undefined;
}

export function normalizeAskZip(raw?: string): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 5) return undefined;
  return digits;
}

export function normalizeAskSid(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = sanitizeAskToken(raw, 64);
  if (!cleaned || !/^[a-zA-Z0-9_-]+$/.test(cleaned)) return undefined;
  return cleaned;
}

export function normalizeAskCity(raw?: string): string | undefined {
  if (!raw) return undefined;
  const cleaned = sanitizeAskToken(raw, 64);
  if (!cleaned) return undefined;
  if (/:\/\//.test(cleaned) || cleaned.includes('..') || cleaned.includes('/')) {
    return undefined;
  }
  return slugifyCityToken(cleaned) || undefined;
}

export function normalizeAskCounty(raw?: string): string | undefined {
  return normalizeAskCity(raw);
}

export function physicalPlaceMatches(
  sourceValue: string | null | undefined,
  wantedSlug: string | null | undefined,
): boolean {
  if (!wantedSlug?.trim() || !sourceValue?.trim()) return false;
  return slugifyCityToken(sourceValue) === slugifyCityToken(wantedSlug);
}

function firstParamFrom(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | undefined {
  if (input instanceof URLSearchParams) return firstParam(input.get(key));
  return firstParam(input[key]);
}

function unsupportedFromToken(raw?: string): SeniorAskUnsupportedReason | undefined {
  if (!raw) return undefined;
  if (raw === 'assisted_living') return 'assisted_living';
  if (raw === 'memory_care') return 'memory_care';
  if (
    raw === 'home_care' ||
    raw === 'home_health' ||
    raw === 'home_care_agency' ||
    raw === 'home_health_agency'
  ) {
    return 'home_care';
  }
  if (UNSUPPORTED_SET.has(raw)) return 'wrong_entity';
  return undefined;
}

/**
 * Parse inbound searchParams into allowlisted Ask context.
 * Requires src=ask. Forbidden keys are ignored (never accepted).
 */
export function parseSeniorAskSearchContext(
  input: URLSearchParams | Record<string, string | string[] | undefined> | null | undefined,
): SeniorAskSearchContext | null {
  if (!input) return null;

  const get = (key: string): string | undefined => firstParamFrom(input, key);

  for (const bad of FORBIDDEN) {
    void get(bad);
  }

  const src = get('src')?.toLowerCase();
  if (src !== 'ask') return null;

  const entityRaw = sanitizeAskToken(get('entity')?.toLowerCase() ?? '', 48);
  const categoryRaw = sanitizeAskToken(get('category')?.toLowerCase() ?? '', 48);
  const stateRaw = sanitizeAskToken(get('state') ?? '', 32);
  const state =
    stateRaw && isUsStateCode(stateRaw) ? stateRaw.trim().toUpperCase() : undefined;

  const entityAlias = entityRaw && ENTITY_ALIAS.has(entityRaw) ? entityRaw : undefined;
  const category =
    categoryRaw && CATEGORY_SET.has(categoryRaw)
      ? (categoryRaw as SeniorAskCategory)
      : entityAlias && entityAlias !== 'nursing_facility'
        ? (entityAlias as SeniorAskCategory)
        : undefined;

  const ctx: SeniorAskSearchContext = {
    source: 'ask',
    entityType: entityAlias || category ? SENIOR_ASK_ENTITY : undefined,
    category,
    state,
    city: normalizeAskCity(get('city')),
    zip: normalizeAskZip(get('zip')),
    county: normalizeAskCounty(get('county')),
    intent: sanitizeAskToken(get('intent')?.toLowerCase() ?? '', 32),
    journey: sanitizeAskToken(get('journey')?.toLowerCase() ?? '', 32),
    sid: normalizeAskSid(get('sid')),
  };

  const entityUnsupported = unsupportedFromToken(entityRaw);
  const categoryUnsupported = unsupportedFromToken(categoryRaw);
  if (entityUnsupported) {
    ctx.unsupported = entityUnsupported;
    ctx.entityType = undefined;
    ctx.category = undefined;
  } else if (categoryUnsupported) {
    ctx.unsupported = categoryUnsupported;
    ctx.entityType = undefined;
    ctx.category = undefined;
  } else if (entityRaw && !entityAlias) {
    ctx.unsupported = 'wrong_entity';
    ctx.entityType = undefined;
  } else if (categoryRaw && !category) {
    ctx.unsupported = 'wrong_entity';
    ctx.entityType = undefined;
  } else if (!ctx.entityType) {
    ctx.unsupported = 'invalid_context';
  } else if (stateRaw && !state && !ctx.zip && !ctx.city && !ctx.county) {
    ctx.unsupported = 'invalid_context';
  }

  return ctx;
}

export function serializeAskSearchContext(ctx: SeniorAskSearchContext): string {
  const p = new URLSearchParams();
  p.set('src', 'ask');
  if (ctx.journey) p.set('journey', ctx.journey);
  if (ctx.state) p.set('state', ctx.state);
  if (ctx.county) p.set('county', ctx.county);
  if (ctx.intent) p.set('intent', ctx.intent);
  if (ctx.entityType) p.set('entity', ctx.entityType);
  if (ctx.category) p.set('category', ctx.category);
  if (ctx.city) p.set('city', ctx.city);
  if (ctx.zip) p.set('zip', ctx.zip);
  if (ctx.sid) p.set('sid', ctx.sid);
  return p.toString();
}

export function withAskContext(path: string, ctx: SeniorAskSearchContext): string {
  const q = serializeAskSearchContext(ctx);
  const base = path.split('?')[0] || path;
  if (!base.startsWith('/')) return path;
  return `${base}?${q}`;
}

export function titleCaseSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function entityPhrase(ctx: SeniorAskSearchContext): string {
  if (ctx.category === 'skilled_nursing_facility' || ctx.category === 'snf') {
    return 'skilled nursing facilities';
  }
  return 'nursing facilities';
}

function placePhrase(ctx: SeniorAskSearchContext): string | null {
  const stateName = ctx.state ? US_STATE_NAMES[ctx.state] || ctx.state : null;
  const city = ctx.city ? titleCaseSlug(ctx.city) : null;
  const county = ctx.county ? titleCaseSlug(ctx.county) : null;
  if (city && stateName) return `${city}, ${stateName}`;
  if (city) return city;
  if (county && stateName) return `${county} County, ${stateName}`;
  if (ctx.zip && stateName) return `${ctx.zip}, ${stateName}`;
  if (ctx.zip) return ctx.zip;
  if (stateName) return stateName;
  return null;
}

export function buildAskBackLabel(ctx: SeniorAskSearchContext): string {
  const entity = entityPhrase(ctx);
  const place = placePhrase(ctx);
  if (place) return `← Back to ${entity} in ${place}`;
  return `← Back to ${entity}`;
}

export function buildAskSearchHref(ctx: SeniorAskSearchContext): string {
  const p = new URLSearchParams();
  p.set('src', 'ask');
  p.set('search', '1');
  p.set('sort', 'name');
  if (ctx.entityType) p.set('entity', ctx.entityType);
  if (ctx.category) p.set('category', ctx.category);
  if (ctx.state) p.set('state', ctx.state);
  if (ctx.city) p.set('city', ctx.city);
  if (ctx.zip) p.set('zip', ctx.zip);
  if (ctx.county) p.set('county', ctx.county);
  if (ctx.journey) p.set('journey', ctx.journey);
  if (ctx.intent) p.set('intent', ctx.intent);
  if (ctx.sid) p.set('sid', ctx.sid);
  return `/search?${p.toString()}`;
}

export function facilityHrefWithAskContext(
  ccn: string,
  slug: string,
  ctx: SeniorAskSearchContext,
): string {
  const path = `/facility/cms/${encodeURIComponent(ccn)}/${encodeURIComponent(slug)}`;
  return withAskContext(path, ctx);
}

export const ASK_HANDOFF_SORT = 'name' as const;

export function resolveAskHandoffDestination(
  ctx: SeniorAskSearchContext,
): AskHandoffDestination {
  const backLabel = buildAskBackLabel(ctx);

  if (ctx.unsupported) {
    return {
      kind: 'unsupported',
      href: `/from-ask/unsupported?reason=${ctx.unsupported}`,
      context: ctx,
      reason: ctx.unsupported,
      backLabel,
    };
  }

  return {
    kind: 'search',
    href: buildAskSearchHref(ctx),
    context: ctx,
    backLabel,
  };
}

export function isAskHandoffKey(key: string): boolean {
  return (ASK_HANDOFF_KEYS as readonly string[]).includes(key);
}

export function isForbiddenAskHandoffKey(key: string): boolean {
  return FORBIDDEN.has(key);
}

export function askHandoffUsesCommercialRanking(): boolean {
  return false;
}
