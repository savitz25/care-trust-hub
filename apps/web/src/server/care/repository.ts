import "server-only";
import type { QueryResultRow } from "pg";
import { getCareDatabasePool } from "./db";
import { CMS_PROVIDER_INFORMATION_SOURCE } from "./source-contracts";
import type {
  CareProviderDetail,
  CareProviderHistoryMetadata,
  CareProviderSummary,
  DevelopmentProviderSearch,
  ProviderDistanceResult,
} from "./types";

const CURRENT_SNAPSHOT_CTE = `
  WITH current_ingest AS (
    SELECT ir.id AS ingest_run_id, sr.id AS source_release_id,
      sr.release_key, sr.source_modified_at, sr.source_published_at,
      sr.retrieved_at AS source_retrieved_at,
      sd.display_name AS dataset_name, sd.source_organization, sd.official_url,
      ir.completed_at AS ingest_completed_at
    FROM source_dataset sd
    JOIN source_release sr ON sr.source_dataset_id=sd.id
    JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
    WHERE sd.dataset_key='${CMS_PROVIDER_INFORMATION_SOURCE.datasetKey}'
    ORDER BY sr.source_modified_at DESC NULLS LAST,
      sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
      ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
    LIMIT 1
  ), current_snapshots AS (
    SELECT fs.*, pi.identifier_value AS ccn, ci.release_key,
      ci.source_modified_at, ci.source_published_at, ci.source_retrieved_at,
      ci.dataset_name, ci.source_organization, ci.official_url,
      ci.ingest_completed_at
    FROM current_ingest ci
    JOIN facility_snapshot fs ON fs.source_release_id=ci.source_release_id
      AND fs.ingest_run_id=ci.ingest_run_id
    JOIN provider_identifier pi ON pi.provider_id=fs.provider_id
      AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
  )`;

const APPROVED_COLUMNS = `
  provider_id, ccn, provider_name, legal_business_name, address, city,
  state_code, zip_code, county_name, telephone, ownership_type, certified_beds,
  participation_type, participates_medicare, participates_medicaid,
  overall_rating, health_inspection_rating, staffing_rating, quality_measure_rating,
  source_latitude, source_longitude, release_key, source_modified_at,
  source_published_at, source_retrieved_at, source_organization, dataset_name,
  official_url, source_record_locator, transformation_version, ingest_completed_at`;

interface ProviderRow extends QueryResultRow {
  provider_id: string;
  ccn: string;
  provider_name: string;
  legal_business_name: string | null;
  address: string | null;
  city: string | null;
  state_code: string;
  zip_code: string | null;
  county_name: string | null;
  telephone: string | null;
  ownership_type: string | null;
  certified_beds: number | null;
  participation_type: string | null;
  participates_medicare: boolean | null;
  participates_medicaid: boolean | null;
  overall_rating: number | null;
  health_inspection_rating: number | null;
  staffing_rating: number | null;
  quality_measure_rating: number | null;
  source_latitude: number | null;
  source_longitude: number | null;
  release_key: string;
  source_modified_at: Date | null;
  source_published_at: Date | null;
  source_retrieved_at: Date;
  source_organization: string;
  dataset_name: string;
  official_url: string;
  source_record_locator: string;
  transformation_version: string;
  ingest_completed_at: Date;
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function summary(row: ProviderRow): CareProviderSummary {
  return {
    ccn: row.ccn,
    providerName: row.provider_name,
    location: {
      address: row.address,
      city: row.city,
      state: row.state_code,
      zipCode: row.zip_code,
      county: row.county_name,
      latitude: row.source_latitude,
      longitude: row.source_longitude,
    },
    certifiedBeds: row.certified_beds,
    ratings: {
      overall: row.overall_rating,
      healthInspection: row.health_inspection_rating,
      staffing: row.staffing_rating,
      qualityMeasure: row.quality_measure_rating,
    },
  };
}

function detail(row: ProviderRow): CareProviderDetail {
  return {
    ...summary(row),
    legalBusinessName: row.legal_business_name,
    telephone: row.telephone,
    ownershipType: row.ownership_type,
    participationType: row.participation_type,
    participatesMedicare: row.participates_medicare,
    participatesMedicaid: row.participates_medicaid,
    source: {
      sourceOrganization: row.source_organization,
      datasetName: row.dataset_name,
      cmsDatasetIdentifier: CMS_PROVIDER_INFORMATION_SOURCE.datasetIdentifier,
      releaseIdentifier: row.release_key,
      officialSourceUrl: row.official_url,
      providerIdentifier: row.ccn,
      sourceRecordLocator: row.source_record_locator,
      freshness: {
        sourceModifiedAt: iso(row.source_modified_at),
        sourcePublishedAt: iso(row.source_published_at),
        retrievedAt: row.source_retrieved_at.toISOString(),
        ingestCompletedAt: row.ingest_completed_at.toISOString(),
      },
    },
  };
}

function validateCcn(ccn: string): string {
  const normalized = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(normalized))
    throw new RangeError("CCN must be six alphanumeric characters");
  return normalized;
}

function validateLimit(limit = 25): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new RangeError("limit must be between 1 and 50");
  return limit;
}

function escapedLike(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function getProviderByCcn(ccn: string): Promise<CareProviderDetail | null> {
  const result = await getCareDatabasePool().query<ProviderRow>(
    `${CURRENT_SNAPSHOT_CTE} SELECT ${APPROVED_COLUMNS} FROM current_snapshots WHERE ccn=$1`,
    [validateCcn(ccn)],
  );
  return result.rows[0] ? detail(result.rows[0]) : null;
}

export async function getProviderCurrentSnapshot(ccn: string) {
  return getProviderByCcn(ccn);
}

export async function getProviderSourceDisclosure(ccn: string) {
  return (await getProviderByCcn(ccn))?.source ?? null;
}

export async function getProviderHistoryMetadata(
  ccn: string,
): Promise<CareProviderHistoryMetadata[]> {
  const result = await getCareDatabasePool().query<{
    release_key: string;
    source_modified_at: Date | null;
    retrieved_at: Date;
    transformation_version: string;
  }>(
    `SELECT sr.release_key, sr.source_modified_at, fs.retrieved_at, fs.transformation_version
     FROM provider_identifier pi JOIN facility_snapshot fs ON fs.provider_id=pi.provider_id
     JOIN source_release sr ON sr.id=fs.source_release_id
     JOIN ingest_run ir ON ir.id=fs.ingest_run_id AND ir.status='succeeded'
     WHERE pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.identifier_value=$1
     ORDER BY sr.source_modified_at DESC NULLS LAST, sr.release_key DESC`,
    [validateCcn(ccn)],
  );
  return result.rows.map((row) => ({
    releaseIdentifier: row.release_key,
    sourceModifiedAt: iso(row.source_modified_at),
    retrievedAt: row.retrieved_at.toISOString(),
    transformationVersion: row.transformation_version,
  }));
}

export async function getProvidersByState(
  state: string,
  limit = 25,
): Promise<CareProviderSummary[]> {
  const normalizedState = state.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalizedState)) throw new RangeError("state must be a two-letter code");
  const result = await getCareDatabasePool().query<ProviderRow>(
    `${CURRENT_SNAPSHOT_CTE} SELECT ${APPROVED_COLUMNS} FROM current_snapshots
     WHERE state_code=$1 ORDER BY provider_name, ccn LIMIT $2`,
    [normalizedState, validateLimit(limit)],
  );
  return result.rows.map(summary);
}

export async function searchProvidersDevelopmentOnly(criteria: DevelopmentProviderSearch) {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const parameter = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };
  if (criteria.query?.trim()) {
    const query = criteria.query.trim();
    const ccnParameter = parameter(validateCcnOrSearch(query));
    const nameParameter = parameter(escapedLike(query));
    conditions.push(`(ccn=${ccnParameter} OR provider_name ILIKE ${nameParameter} ESCAPE '\\')`);
  }
  if (criteria.state?.trim()) {
    const state = criteria.state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) throw new RangeError("state must be a two-letter code");
    conditions.push(`state_code=${parameter(state)}`);
  }
  if (criteria.city?.trim()) {
    conditions.push(`city ILIKE ${parameter(escapedLike(criteria.city.trim()))} ESCAPE '\\'`);
  }
  if (criteria.zip?.trim()) {
    const zip = criteria.zip.trim();
    if (!/^\d{5}$/.test(zip)) throw new RangeError("ZIP must contain five digits");
    conditions.push(`zip_code=${parameter(zip)}`);
  }
  const limitParameter = parameter(validateLimit(criteria.limit));
  const result = await getCareDatabasePool().query<ProviderRow>(
    `${CURRENT_SNAPSHOT_CTE} SELECT ${APPROVED_COLUMNS} FROM current_snapshots
     ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY provider_name, ccn LIMIT ${limitParameter}`,
    values,
  );
  return result.rows.map(summary);
}

function validateCcnOrSearch(value: string): string {
  return /^[A-Z0-9]{6}$/i.test(value) ? value.toUpperCase() : "";
}

export async function providersWithinRadius(
  latitude: number,
  longitude: number,
  radiusMiles: number,
  limit = 25,
): Promise<ProviderDistanceResult[]> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    throw new RangeError("invalid latitude");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    throw new RangeError("invalid longitude");
  if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 250)
    throw new RangeError("radius must be between 0 and 250 miles");
  const result = await getCareDatabasePool().query<ProviderRow & { distance_miles: number }>(
    `${CURRENT_SNAPSHOT_CTE} SELECT ${APPROVED_COLUMNS},
       ST_Distance(location, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography)/1609.344 AS distance_miles
     FROM current_snapshots WHERE location IS NOT NULL
       AND ST_DWithin(location, ST_SetSRID(ST_MakePoint($2,$1),4326)::geography, $3*1609.344)
     ORDER BY distance_miles, ccn LIMIT $4`,
    [latitude, longitude, radiusMiles, validateLimit(limit)],
  );
  return result.rows.map((row) => ({ ...summary(row), distanceMiles: row.distance_miles }));
}
