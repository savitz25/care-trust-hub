import "server-only";
import { homeHealthHref, hospiceHref } from "./consumer";
import { getCareDatabasePool } from "./db";

export type AgencySearchClass = "home_health" | "hospice";

export interface AgencySearchCriteria {
  providerClass: AgencySearchClass;
  query?: string;
  state?: string;
  city?: string;
  zip?: string;
  qualityAvailable?: boolean;
  experienceAvailable?: boolean;
  ownershipAvailable?: boolean;
  cmsStar?: number;
  limit?: number;
  offset?: number;
}

export interface AgencySearchResult {
  providerClass: AgencySearchClass;
  ccn: string;
  providerName: string;
  city: string | null;
  state: string;
  zipCode: string | null;
  telephone: string | null;
  href: string;
  cmsQualityStar: number | null;
  qualityAvailable: boolean;
  experienceAvailable: boolean;
  ownershipAvailable: boolean;
  serviceEvidenceAvailable: boolean;
}

export interface AgencySourceClock {
  datasetKey: string;
  sourceFamily: string;
  officialAsOf: string | null;
}

const TABLES = {
  home_health: "home_health_snapshot",
  hospice: "hospice_snapshot",
} as const;

const DATASET_KEYS = {
  home_health: "home-health-care-agencies",
  hospice: "hospice-general-information",
} as const;

export async function getCurrentAgencySourceClock(
  providerClass: AgencySearchClass,
): Promise<AgencySourceClock> {
  const table = TABLES[providerClass];
  const datasetKey = DATASET_KEYS[providerClass];
  const result = await getCareDatabasePool().query<{
    display_name: string;
    source_organization: string;
    source_modified_at: Date | null;
  }>(
    `SELECT sd.display_name, sd.source_organization, sr.source_modified_at
     FROM ${table} snapshot
     JOIN source_release sr ON sr.id=snapshot.source_release_id
     JOIN source_dataset sd ON sd.id=sr.source_dataset_id
     WHERE sd.dataset_key=$1
     ORDER BY sr.source_modified_at DESC NULLS LAST, sr.retrieved_at DESC
     LIMIT 1`,
    [datasetKey],
  );
  const row = result.rows[0];
  return {
    datasetKey,
    sourceFamily: row
      ? `${row.display_name} (${row.source_organization})`
      : `CMS Care Compare (${datasetKey})`,
    officialAsOf: row?.source_modified_at?.toISOString() ?? null,
  };
}

const QUALITY_FAMILY = {
  home_health: "hh_quality",
  hospice: "hospice_quality",
} as const;

const EXPERIENCE_FAMILY = {
  home_health: "hh_hhcahps",
  hospice: "hospice_cahps",
} as const;

function escapedLike(value: string): string {
  return `%${value.replace(/[\\%_]/g, "\\$&")}%`;
}

function compactToken(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
}

function validateLimit(limit = 21): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new RangeError("limit must be between 1 and 50");
  }
  return limit;
}

function validateOffset(offset = 0): number {
  if (!Number.isInteger(offset) || offset < 0 || offset > 10000) {
    throw new RangeError("offset must be between 0 and 10000");
  }
  return offset;
}

export async function countCurrentAgencyDirectory(
  providerClass: AgencySearchClass,
): Promise<number> {
  const table = TABLES[providerClass];
  const result = await getCareDatabasePool().query<{ n: string }>(
    `SELECT count(DISTINCT cms_ccn)::text AS n FROM ${table}`,
  );
  return Number(result.rows[0]?.n ?? 0);
}

export async function searchCurrentAgencies(
  criteria: AgencySearchCriteria,
): Promise<AgencySearchResult[]> {
  const table = TABLES[criteria.providerClass];
  const qualityFamily = QUALITY_FAMILY[criteria.providerClass];
  const experienceFamily = EXPERIENCE_FAMILY[criteria.providerClass];
  const conditions: string[] = [];
  const values: unknown[] = [];
  const parameter = (value: unknown) => {
    values.push(value);
    return `$${values.length}`;
  };

  const query = criteria.query?.trim() ?? "";
  const ccn = /^[A-Z0-9]{6}$/i.test(query) ? query.toUpperCase() : "";
  if (query) {
    const nameParts = [`c.provider_name ILIKE ${parameter(escapedLike(query))} ESCAPE '\\'`];
    const compact = compactToken(query);
    if (compact.length >= 3) {
      nameParts.push(
        `regexp_replace(upper(c.provider_name), '[^A-Z0-9]+', '', 'g') LIKE ${parameter(`%${compact}%`)}`,
      );
    }
    if (ccn) nameParts.unshift(`c.cms_ccn=${parameter(ccn)}`);
    conditions.push(`(${nameParts.join(" OR ")})`);
  }
  if (criteria.state?.trim()) {
    const state = criteria.state.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(state)) throw new RangeError("state must be a two-letter code");
    conditions.push(`c.state_code=${parameter(state)}`);
  }
  if (criteria.city?.trim()) {
    conditions.push(`c.city ILIKE ${parameter(escapedLike(criteria.city.trim()))} ESCAPE '\\'`);
  }
  if (criteria.zip?.trim()) {
    const zip = criteria.zip.trim();
    if (!/^\d{5}$/.test(zip)) throw new RangeError("ZIP must contain five digits");
    conditions.push(`c.zip_code=${parameter(zip)}`);
  }
  if (criteria.cmsStar !== undefined) {
    if (criteria.providerClass !== "home_health") {
      throw new RangeError("CMS Quality of Patient Care star filter applies only to Home Health");
    }
    if (!Number.isInteger(criteria.cmsStar) || criteria.cmsStar < 1 || criteria.cmsStar > 5) {
      throw new RangeError("CMS star must be between 1 and 5");
    }
    conditions.push(`c.quality_of_patient_care_star=${parameter(criteria.cmsStar)}`);
  }
  if (criteria.qualityAvailable === true) {
    conditions.push(
      `EXISTS (SELECT 1 FROM cms_agency_quality_observation q WHERE q.cms_ccn=c.cms_ccn AND q.provider_type=${parameter(criteria.providerClass)} AND q.measure_family=${parameter(qualityFamily)})`,
    );
  }
  if (criteria.experienceAvailable === true) {
    conditions.push(
      `EXISTS (SELECT 1 FROM cms_agency_quality_observation q WHERE q.cms_ccn=c.cms_ccn AND q.provider_type=${parameter(criteria.providerClass)} AND q.measure_family=${parameter(experienceFamily)})`,
    );
  }
  if (criteria.ownershipAvailable === true) {
    conditions.push(
      `EXISTS (SELECT 1 FROM provider_organization_edge e WHERE e.provider_id=c.provider_id AND e.relationship_type='OWNED_BY')`,
    );
  }

  const limitParameter = parameter(validateLimit(criteria.limit));
  const offsetParameter = parameter(validateOffset(criteria.offset));
  const exactName = query ? parameter(query.toUpperCase()) : "NULL";
  const exactCcn = ccn ? parameter(ccn) : "NULL";
  const starSelect =
    criteria.providerClass === "home_health" ? "c.quality_of_patient_care_star" : "NULL::smallint";
  const sql = `
    WITH current_directory AS (
      SELECT DISTINCT ON (cms_ccn)
        cms_ccn, provider_id, provider_name, city, state_code, zip_code, telephone
        ${criteria.providerClass === "home_health" ? ", quality_of_patient_care_star" : ""}
      FROM ${table}
      ORDER BY cms_ccn, id DESC
    )
    SELECT c.cms_ccn, c.provider_name, c.city, c.state_code, c.zip_code, c.telephone,
           ${starSelect} AS quality_of_patient_care_star,
           EXISTS (
             SELECT 1 FROM cms_agency_quality_observation q
             WHERE q.cms_ccn=c.cms_ccn AND q.provider_type='${criteria.providerClass}'
               AND q.measure_family='${qualityFamily}'
           ) AS quality_available,
           EXISTS (
             SELECT 1 FROM cms_agency_quality_observation q
             WHERE q.cms_ccn=c.cms_ccn AND q.provider_type='${criteria.providerClass}'
               AND q.measure_family='${experienceFamily}'
           ) AS experience_available,
           EXISTS (
             SELECT 1 FROM provider_organization_edge e
             WHERE e.provider_id=c.provider_id AND e.relationship_type='OWNED_BY'
           ) AS ownership_available,
           EXISTS (
             SELECT 1 FROM cms_agency_service_zip z WHERE z.provider_id=c.provider_id
           ) AS service_evidence_available
    FROM current_directory c
    ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
    ORDER BY
      CASE WHEN c.cms_ccn = ${exactCcn} THEN 0 ELSE 1 END,
      CASE WHEN upper(c.provider_name) = ${exactName} THEN 0 ELSE 1 END,
      c.provider_name, c.cms_ccn, c.city, c.state_code
    LIMIT ${limitParameter} OFFSET ${offsetParameter}`;

  const result = await getCareDatabasePool().query<{
    cms_ccn: string;
    provider_name: string;
    city: string | null;
    state_code: string;
    zip_code: string | null;
    telephone: string | null;
    quality_of_patient_care_star: number | null;
    quality_available: boolean;
    experience_available: boolean;
    ownership_available: boolean;
    service_evidence_available: boolean;
  }>(sql, values);

  return result.rows.map((row) => ({
    providerClass: criteria.providerClass,
    ccn: row.cms_ccn,
    providerName: row.provider_name,
    city: row.city,
    state: row.state_code,
    zipCode: row.zip_code,
    telephone: row.telephone,
    href:
      criteria.providerClass === "home_health"
        ? homeHealthHref(row.cms_ccn, row.provider_name)
        : hospiceHref(row.cms_ccn, row.provider_name),
    cmsQualityStar: row.quality_of_patient_care_star,
    qualityAvailable: row.quality_available,
    experienceAvailable: row.experience_available,
    ownershipAvailable: row.ownership_available,
    serviceEvidenceAvailable: row.service_evidence_available,
  }));
}
