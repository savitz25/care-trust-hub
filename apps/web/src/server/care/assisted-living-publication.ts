import "server-only";
import {
  classifyAssistedLivingPublication,
  isAssistedLivingDiscoveryEligible,
  type AssistedLivingPublicationDecision,
  type ConsumerCareCategory,
  type MemoryCareDesignation,
  type OrganizationRole,
  type ResolutionState,
} from "@care/domain";
import { getCareDatabasePool } from "./db";
import { isAssistedLivingIntelligenceEnabled } from "./feature-flags";

export interface PublishedAssistedLivingOrganization {
  readonly role: OrganizationRole;
  readonly name: string;
}

export interface PublishedAssistedLivingProvider {
  readonly id: string;
  readonly stateCode: string;
  readonly regulatorCode: string;
  readonly sourceFacilityId: string;
  readonly licenseId: string | null;
  readonly officialName: string;
  readonly officialStreet: string | null;
  readonly officialCity: string | null;
  readonly officialState: string | null;
  readonly officialZip: string | null;
  readonly officialType: string;
  readonly consumerCategory: ConsumerCareCategory;
  readonly licensedCapacity: number | null;
  readonly memoryDesignation: MemoryCareDesignation;
  readonly consumerStatus: string | null;
  readonly licenseStatusReported: boolean;
  readonly sourceDirectoryContext: string;
  readonly organizations: readonly PublishedAssistedLivingOrganization[];
  readonly retrievedAt: string;
  readonly sourceLocator: string;
}

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
    `SELECT id, state_code, regulator_code, source_facility_id, license_id, official_name,
            official_street, official_city, official_state, official_zip, official_type,
            consumer_category, license_status, license_status_reported, source_directory_context,
            licensed_capacity, memory_designation, identity_state, publication_state,
            discovery_eligible, retrieved_at, source_locator
       FROM assisted_living_provider
      WHERE id = $1
        AND identity_state = 'VERIFIED'
        AND discovery_eligible
        AND publication_state IN ('PUBLISHABLE_CURRENT', 'PUBLISHABLE_WITH_STATUS')`,
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
    `SELECT id, state_code, regulator_code, source_facility_id, license_id, official_name,
            official_street, official_city, official_state, official_zip, official_type,
            consumer_category, license_status, license_status_reported, source_directory_context,
            licensed_capacity, memory_designation, identity_state, publication_state,
            discovery_eligible, retrieved_at, source_locator
       FROM assisted_living_provider
      WHERE identity_state = 'VERIFIED'
        AND discovery_eligible
        AND publication_state IN ('PUBLISHABLE_CURRENT', 'PUBLISHABLE_WITH_STATUS')
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
