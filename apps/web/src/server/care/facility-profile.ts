import "server-only";
import { getCareDatabasePool } from "./db";
import { CMS_PROVIDER_INFORMATION_SOURCE } from "./source-contracts";
import type { CareProviderDetail } from "./types";
import { FACILITY_NEARBY_LIMIT, type FacilityComparisons } from "./facility-profile-model";

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
    SELECT fs.provider_id, fs.provider_name, fs.city, fs.county_name, fs.state_code,
      fs.overall_rating, fs.health_inspection_rating, fs.staffing_rating,
      pi.identifier_value AS ccn
    FROM current_ingest ci
    JOIN facility_snapshot fs ON fs.source_release_id=ci.source_release_id
      AND fs.ingest_run_id=ci.ingest_run_id
    JOIN provider_identifier pi ON pi.provider_id=fs.provider_id
      AND pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
  )`;

type AverageRow = {
  overall_average: string | null;
  health_average: string | null;
  deficiency_average: string | null;
  staffing_hours_average: string | null;
};

type NearbyRow = { ccn: string; provider_name: string; city: string | null };

function numeric(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stateCode(value: string): string | null {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

export async function loadFacilityComparisons(
  provider: Pick<CareProviderDetail, "ccn" | "location">,
): Promise<FacilityComparisons | null> {
  const code = stateCode(provider.location.state);
  if (!code || !provider.ccn) return null;
  const city = provider.location.city?.trim() || null;
  const county = provider.location.county?.trim() || null;
  const pool = getCareDatabasePool();
  const [averages, cityHomes, countyHomes] = await Promise.all([
    pool.query<AverageRow>(
      `${SNAPSHOT}
       SELECT
         (SELECT round(avg(overall_rating)::numeric, 1)::text FROM current_snapshots WHERE state_code=$1) AS overall_average,
         (SELECT round(avg(health_inspection_rating)::numeric, 1)::text FROM current_snapshots WHERE state_code=$1) AS health_average,
         (SELECT round(avg(inspect.deficiency_count)::numeric, 1)::text
          FROM current_snapshots c
          JOIN LATERAL (
            SELECT (SELECT count(*)::int FROM deficiency_finding d WHERE d.inspection_event_id=i.id) AS deficiency_count
            FROM inspection_event i
            WHERE i.provider_id=c.provider_id
              AND i.survey_type ILIKE '%standard%'
              AND i.survey_type NOT ILIKE '%complaint%'
              AND i.survey_type NOT ILIKE '%fire%'
            ORDER BY i.survey_date DESC
            LIMIT 1
          ) inspect ON true
          WHERE c.state_code=$1) AS deficiency_average,
         (SELECT round(avg(staff.total_nurse_hprd)::numeric, 2)::text
          FROM current_snapshots c
          JOIN LATERAL (
            SELECT total_nurse_hprd FROM pbj_staffing_quarter_summary s
            WHERE s.provider_id=c.provider_id AND s.total_nurse_hprd IS NOT NULL
            ORDER BY s.coverage_end DESC
            LIMIT 1
          ) staff ON true
          WHERE c.state_code=$1) AS staffing_hours_average`,
      [code],
    ),
    city
      ? pool.query<NearbyRow>(
          `${SNAPSHOT}
           SELECT ccn, provider_name, NULLIF(btrim(city), '') AS city
           FROM current_snapshots
           WHERE state_code=$1 AND ccn<>$2 AND lower(btrim(city))=lower($3)
           ORDER BY provider_name, ccn
           LIMIT ${FACILITY_NEARBY_LIMIT}`,
          [code, provider.ccn, city],
        )
      : Promise.resolve({ rows: [] as NearbyRow[] }),
    county
      ? pool.query<NearbyRow>(
          `${SNAPSHOT}
           SELECT ccn, provider_name, NULLIF(btrim(city), '') AS city
           FROM current_snapshots
           WHERE state_code=$1 AND ccn<>$2 AND lower(btrim(county_name))=lower($3)
             AND ($4::text IS NULL OR lower(btrim(city)) IS DISTINCT FROM lower($4))
           ORDER BY provider_name, ccn
           LIMIT ${FACILITY_NEARBY_LIMIT}`,
          [code, provider.ccn, county, city],
        )
      : Promise.resolve({ rows: [] as NearbyRow[] }),
  ]);
  const seen = new Set<string>([provider.ccn]);
  const nearby: FacilityComparisons["nearby"] = [];
  for (const row of [...cityHomes.rows, ...countyHomes.rows]) {
    if (seen.has(row.ccn)) continue;
    seen.add(row.ccn);
    nearby.push({ ccn: row.ccn, name: row.provider_name, city: row.city });
    if (nearby.length === FACILITY_NEARBY_LIMIT) break;
  }
  const average = averages.rows[0];
  return {
    overallStateAverage: numeric(average?.overall_average ?? null),
    healthStateAverage: numeric(average?.health_average ?? null),
    deficiencyStateAverage: numeric(average?.deficiency_average ?? null),
    staffingHoursStateAverage: numeric(average?.staffing_hours_average ?? null),
    nearby,
  };
}
