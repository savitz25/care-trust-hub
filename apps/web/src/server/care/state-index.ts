import "server-only";
import { connection } from "next/server";
import { getCareDatabasePool } from "./db";
import { CMS_PROVIDER_INFORMATION_SOURCE } from "./source-contracts";
import {
  STATE_INDEX_PLACE_LIMIT,
  STATE_INDEX_ROW_LIMIT,
  buildStateIndexFacts,
  cityIndexHref,
  facilityIndexHref,
  stateIndexAbout,
  type StateIndexFacility,
  type StateIndexModel,
  type StateIndexPlace,
} from "./state-index-model";

const SNAPSHOT = `
  WITH current_ingest AS (
    SELECT ir.id AS ingest_run_id, sr.id AS source_release_id
    FROM source_dataset sd
    JOIN source_release sr ON sr.source_dataset_id=sd.id
    JOIN ingest_run ir ON ir.source_release_id=sr.id AND ir.status='succeeded'
    WHERE sd.dataset_key='${CMS_PROVIDER_INFORMATION_SOURCE.datasetKey}'
    ORDER BY sr.source_modified_at DESC NULLS LAST,
      sr.source_release_date DESC NULLS LAST, sr.release_key DESC,
      ir.completed_at DESC, ir.transformation_version DESC, ir.id DESC
    LIMIT 1
  ), current_snapshots AS (
    SELECT fs.provider_id, fs.provider_name, fs.city, fs.state_code,
      fs.overall_rating, fs.health_inspection_rating, fs.staffing_rating,
      pi.identifier_value AS ccn
    FROM current_ingest ci
    JOIN facility_snapshot fs ON fs.source_release_id=ci.source_release_id
      AND fs.ingest_run_id=ci.ingest_run_id
    JOIN provider_identifier pi ON pi.provider_id=fs.provider_id
      AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
  )`;

type FacilityRow = {
  ccn: string;
  provider_name: string;
  city: string | null;
  overall_rating: number | null;
  health_inspection_rating: number | null;
  staffing_rating: number | null;
  deficiency_count: number | null;
  fine_amount: string | null;
};

type SummaryRow = {
  facility_count: number;
  rated_count: number;
  average_overall: string | null;
  high_overall_count: number;
  staffing_rated_count: number;
};

type PlaceRow = { name: string; n: number };

function stateCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new RangeError("state must be a two-letter code");
  return code;
}

function money(value: string | null): number | null {
  if (value == null || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export async function loadStateIndex(
  code: string,
  stateName: string,
): Promise<StateIndexModel | null> {
  await connection();
  const normalized = stateCode(code);
  const pool = getCareDatabasePool();
  const [summaryResult, placeResult, facilityResult] = await Promise.all([
    pool.query<SummaryRow>(
      `${SNAPSHOT}
       SELECT count(*)::int AS facility_count,
         count(overall_rating)::int AS rated_count,
         round(avg(overall_rating)::numeric, 1)::text AS average_overall,
         count(*) FILTER (WHERE overall_rating >= 4)::int AS high_overall_count,
         count(staffing_rating)::int AS staffing_rated_count
       FROM current_snapshots WHERE state_code=$1`,
      [normalized],
    ),
    pool.query<PlaceRow>(
      `${SNAPSHOT}
       SELECT btrim(city) AS name, count(*)::int AS n
       FROM current_snapshots
       WHERE state_code=$1 AND city IS NOT NULL AND btrim(city) <> ''
       GROUP BY btrim(city)
       ORDER BY n DESC, name
       LIMIT ${STATE_INDEX_PLACE_LIMIT}`,
      [normalized],
    ),
    pool.query<FacilityRow>(
      `${SNAPSHOT}
       SELECT c.ccn, c.provider_name, NULLIF(btrim(c.city), '') AS city,
         c.overall_rating, c.health_inspection_rating, c.staffing_rating,
         inspect.deficiency_count, penalty.fine_amount
       FROM current_snapshots c
       LEFT JOIN LATERAL (
         SELECT (SELECT count(*)::int FROM deficiency_finding d WHERE d.inspection_event_id=i.id) AS deficiency_count
         FROM inspection_event i
         WHERE i.provider_id=c.provider_id
           AND i.survey_type ILIKE '%standard%'
           AND i.survey_type NOT ILIKE '%complaint%'
           AND i.survey_type NOT ILIKE '%fire%'
         ORDER BY i.survey_date DESC
         LIMIT 1
       ) inspect ON true
       LEFT JOIN LATERAL (
         SELECT fine_amount FROM penalty_enforcement pe
         WHERE pe.provider_id=c.provider_id
         ORDER BY penalty_date DESC
         LIMIT 1
       ) penalty ON true
       WHERE c.state_code=$1
       ORDER BY c.provider_name, c.ccn
       LIMIT ${STATE_INDEX_ROW_LIMIT}`,
      [normalized],
    ),
  ]);
  const summary = summaryResult.rows[0];
  if (!summary || summary.facility_count === 0) return null;
  const places: StateIndexPlace[] = placeResult.rows.map((row) => ({
    name: row.name,
    count: row.n,
    href: cityIndexHref(normalized, row.name),
  }));
  const facilities: StateIndexFacility[] = facilityResult.rows.map((row) => ({
    ccn: row.ccn,
    name: row.provider_name,
    city: row.city,
    href: facilityIndexHref(row.ccn, row.provider_name),
    overall: row.overall_rating,
    healthInspection: row.health_inspection_rating,
    staffing: row.staffing_rating,
    deficiencyCount: row.deficiency_count,
    fineAmount: money(row.fine_amount),
  }));
  const factsInput = {
    stateName,
    facilityCount: summary.facility_count,
    ratedCount: summary.rated_count,
    averageOverall: summary.average_overall == null ? null : Number(summary.average_overall),
    highOverallCount: summary.high_overall_count,
    staffingRatedCount: summary.staffing_rated_count,
    topCity: places[0] ? { name: places[0].name, count: places[0].count } : null,
  };
  return {
    stateCode: normalized,
    ...factsInput,
    facilities,
    places,
    facts: buildStateIndexFacts(factsInput),
    about: stateIndexAbout(),
  };
}
