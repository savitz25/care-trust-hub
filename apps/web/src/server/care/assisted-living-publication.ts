import "server-only";
import {
  classifyAssistedLivingPublication,
  isAssistedLivingDiscoveryEligible,
  type AssistedLivingPublicationDecision,
  type ConsumerCareCategory,
  type MemoryCareDesignation,
  type AssistedLivingPublicProvider,
  type OrganizationRole,
  type ResolutionState,
} from "@care/domain";
import { getCareDatabasePool } from "./db";
import { isAssistedLivingIntelligenceEnabled } from "./feature-flags";

export type PublishedAssistedLivingOrganization =
  AssistedLivingPublicProvider["organizations"][number];
export type PublishedAssistedLivingProvider = AssistedLivingPublicProvider;

const DISCOVERY_SQL = `identity_state = 'VERIFIED'
        AND discovery_eligible
        AND publication_state IN ('PUBLISHABLE_CURRENT', 'PUBLISHABLE_WITH_STATUS')`;

const PROVIDER_COLUMNS = `id, state_code, regulator_code, source_facility_id, license_id, official_name,
            official_street, official_city, official_state, official_zip, official_type,
            consumer_category, license_status, license_status_reported, source_directory_context,
            licensed_capacity, memory_designation, identity_state, publication_state,
            discovery_eligible, retrieved_at, source_locator`;

interface ProviderRow {
  id: string;
  state_code: string;
  regulator_code: string;
  source_facility_id: string;
  license_id: string | null;
  official_name: string;
  official_street: string | null;
  official_city: string | null;
  official_state: string | null;
  official_zip: string | null;
  official_type: string;
  consumer_category: ConsumerCareCategory;
  license_status: string | null;
  license_status_reported: boolean;
  source_directory_context: string;
  licensed_capacity: number | null;
  memory_designation: MemoryCareDesignation;
  identity_state: ResolutionState;
  publication_state: string;
  discovery_eligible: boolean;
  retrieved_at: Date;
  source_locator: string;
}

interface PartyRow {
  provider_id: string;
  role: OrganizationRole;
  name: string;
}

export function selectPublishedAssistedLivingProvider(input: {
  identityState: ResolutionState;
  stateCode: string;
  officialName?: string | null;
  officialStreet?: string | null;
  officialCity?: string | null;
  officialZip?: string | null;
  consumerCategory?: ConsumerCareCategory | null;
  retrievedAt?: string | null;
  licenseStatus?: string | null;
}): AssistedLivingPublicationDecision | null {
  const decision = classifyAssistedLivingPublication(input);
  return isAssistedLivingDiscoveryEligible(decision) ? decision : null;
}

export async function getPublishedAssistedLivingProvider(
  id: string,
): Promise<PublishedAssistedLivingProvider | null> {
  if (!isAssistedLivingIntelligenceEnabled()) return null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const result = await getCareDatabasePool().query<ProviderRow>(
    `SELECT ${PROVIDER_COLUMNS}
       FROM assisted_living_provider
      WHERE id = $1
        AND ${DISCOVERY_SQL}`,
    [id],
  );
  const row = result.rows[0];
  if (!row) return null;
  const parties = await getCareDatabasePool().query<PartyRow>(
    `SELECT provider_id, role, name
       FROM assisted_living_organization_party
      WHERE provider_id = $1
      ORDER BY role, name`,
    [row.id],
  );
  return mapPublished(row, parties.rows);
}

export async function listPublishedAssistedLivingProviders(
  input: {
    stateCode?: string;
    limit?: number;
  } = {},
): Promise<PublishedAssistedLivingProvider[]> {
  if (!isAssistedLivingIntelligenceEnabled()) return [];
  const limit = Math.min(Math.max(input.limit ?? 25, 1), 50);
  const state = input.stateCode?.trim().toUpperCase();
  const result = await getCareDatabasePool().query<ProviderRow>(
    `SELECT ${PROVIDER_COLUMNS}
       FROM assisted_living_provider
      WHERE ${DISCOVERY_SQL}
        AND ($1::text IS NULL OR state_code = $1)
      ORDER BY official_name, source_facility_id
      LIMIT $2`,
    [state && /^[A-Z]{2}$/.test(state) ? state : null, limit],
  );
  if (result.rows.length === 0) return [];
  const parties = await getCareDatabasePool().query<PartyRow>(
    `SELECT provider_id, role, name
       FROM assisted_living_organization_party
      WHERE provider_id = ANY($1::uuid[])
      ORDER BY role, name`,
    [result.rows.map((row) => row.id)],
  );
  const byProvider = new Map<string, PartyRow[]>();
  for (const party of parties.rows) {
    byProvider.set(party.provider_id, [...(byProvider.get(party.provider_id) ?? []), party]);
  }
  return result.rows.map((row) => mapPublished(row, byProvider.get(row.id) ?? []));
}

function mapPublished(
  row: ProviderRow,
  parties: readonly PartyRow[],
): PublishedAssistedLivingProvider {
  return {
    id: row.id,
    stateCode: row.state_code,
    regulatorCode: row.regulator_code,
    sourceFacilityId: row.source_facility_id,
    licenseId: row.license_id,
    officialName: row.official_name,
    officialStreet: row.official_street,
    officialCity: row.official_city,
    officialState: row.official_state,
    officialZip: row.official_zip,
    officialType: row.official_type,
    consumerCategory: row.consumer_category,
    licensedCapacity: row.licensed_capacity,
    memoryDesignation: row.memory_designation,
    consumerStatus: row.license_status_reported ? row.license_status : null,
    licenseStatusReported: row.license_status_reported,
    sourceDirectoryContext: row.source_directory_context,
    organizations: parties.map((party) => ({ role: party.role, name: party.name })),
    retrievedAt: row.retrieved_at.toISOString(),
    sourceLocator: row.source_locator,
  };
}

export interface AssistedLivingSearchInput {
  readonly stateCode?: string;
  readonly city?: string;
  readonly zip?: string;
  readonly consumerCategory?: string;
  readonly explicitMemory?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface AssistedLivingSearchResult {
  readonly results: readonly PublishedAssistedLivingProvider[];
  readonly total: number;
  readonly hasMore: boolean;
}

const CONSUMER_CATEGORIES = new Set([
  "assisted_living",
  "residential_care",
  "memory_supportive",
  "adult_care_home",
  "personal_care_home",
]);

export async function searchPublishedAssistedLivingProviders(
  input: AssistedLivingSearchInput = {},
): Promise<AssistedLivingSearchResult> {
  if (!isAssistedLivingIntelligenceEnabled()) return { results: [], total: 0, hasMore: false };
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  const offset = Math.max(input.offset ?? 0, 0);
  const state = input.stateCode?.trim().toUpperCase();
  const city = input.city?.trim() || null;
  const zip = input.zip?.replace(/\D/g, "").slice(0, 5) || null;
  const category =
    input.consumerCategory && CONSUMER_CATEGORIES.has(input.consumerCategory)
      ? input.consumerCategory
      : null;
  const result = await getCareDatabasePool().query<ProviderRow & { total_count: string }>(
    `SELECT ${PROVIDER_COLUMNS}, count(*) OVER() AS total_count
       FROM assisted_living_provider
      WHERE ${DISCOVERY_SQL}
        AND ($1::text IS NULL OR state_code = $1)
        AND ($2::text IS NULL OR upper(official_city) = upper($2))
        AND ($3::text IS NULL OR official_zip = $3)
        AND ($4::text IS NULL OR consumer_category = $4)
        AND ($5::boolean IS NOT TRUE OR memory_designation IN (
              'explicit_memory_or_dementia_license',
              'secured_or_special_care_unit',
              'specialty_endorsement'
            ))
      ORDER BY official_name, source_facility_id
      LIMIT $6 OFFSET $7`,
    [
      state && /^[A-Z]{2}$/.test(state) ? state : null,
      city,
      zip && zip.length === 5 ? zip : null,
      category,
      Boolean(input.explicitMemory),
      limit + 1,
      offset,
    ],
  );
  const total = Number(result.rows[0]?.total_count ?? 0);
  const page = result.rows.slice(0, limit);
  const hasMore = result.rows.length > limit;
  if (page.length === 0) return { results: [], total, hasMore: false };
  const parties = await getCareDatabasePool().query<PartyRow>(
    `SELECT provider_id, role, name
       FROM assisted_living_organization_party
      WHERE provider_id = ANY($1::uuid[])
      ORDER BY role, name`,
    [page.map((row) => row.id)],
  );
  const byProvider = new Map<string, PartyRow[]>();
  for (const party of parties.rows) {
    byProvider.set(party.provider_id, [...(byProvider.get(party.provider_id) ?? []), party]);
  }
  return {
    results: page.map((row) => mapPublished(row, byProvider.get(row.id) ?? [])),
    total,
    hasMore,
  };
}

export interface AssistedLivingStateCoverage {
  readonly stateCode: string;
  readonly providers: number;
  readonly explicitMemory: number;
}

export async function getAssistedLivingStateCoverage(): Promise<AssistedLivingStateCoverage[]> {
  if (!isAssistedLivingIntelligenceEnabled()) return [];
  const result = await getCareDatabasePool().query<AssistedLivingStateCoverage>(
    `SELECT state_code AS "stateCode",
            count(*)::int AS providers,
            count(*) FILTER (
              WHERE memory_designation IN (
                'explicit_memory_or_dementia_license',
                'secured_or_special_care_unit',
                'specialty_endorsement'
              )
            )::int AS "explicitMemory"
       FROM assisted_living_provider
      WHERE ${DISCOVERY_SQL}
      GROUP BY state_code
      ORDER BY state_code`,
  );
  return result.rows;
}

export const ASSISTED_LIVING_SITEMAP_PAGE_SIZE = 5000;

export async function getAssistedLivingSitemapCount(): Promise<number> {
  if (!isAssistedLivingIntelligenceEnabled()) return 0;
  const result = await getCareDatabasePool().query<{ count: string }>(
    `SELECT count(*) FROM assisted_living_provider WHERE ${DISCOVERY_SQL}`,
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getAssistedLivingSitemapPage(page: number) {
  if (!Number.isInteger(page) || page < 0 || page > 20)
    throw new RangeError("Invalid sitemap page");
  if (!isAssistedLivingIntelligenceEnabled()) return [];
  const result = await getCareDatabasePool().query<{
    id: string;
    state_code: string;
    official_name: string;
    retrieved_at: Date;
  }>(
    `SELECT id, state_code, official_name, retrieved_at
       FROM assisted_living_provider
      WHERE ${DISCOVERY_SQL}
      ORDER BY state_code, official_name, id
      LIMIT $1 OFFSET $2`,
    [ASSISTED_LIVING_SITEMAP_PAGE_SIZE, page * ASSISTED_LIVING_SITEMAP_PAGE_SIZE],
  );
  return result.rows;
}
