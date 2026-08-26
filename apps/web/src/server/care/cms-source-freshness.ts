import "server-only";
import { getCareDatabasePool } from "./db";

export interface CmsSourceFreshnessRow {
  datasetKey: string;
  displayName: string;
  cmsIdentifier: string | null;
  refreshCadence: string | null;
  checkFrequency: string | null;
  freshnessSlaDays: number | null;
  currentRelease: string | null;
  sourceModifiedAt: string | null;
  sourcePeriod: string | null;
  retrievedAt: string | null;
  lastSuccessAt: string | null;
  lastIngestStatus: string | null;
  freshnessBand: "CURRENT" | "AGING" | "STALE" | "UNKNOWN" | null;
  ageDays: number | null;
  lastSourceRunStatus: string | null;
  lastFailureAt: string | null;
  lastHealthyStatus: string | null;
  officialUrl: string | null;
}

interface FreshnessQueryRow {
  dataset_key: string;
  display_name: string;
  cms_identifier: string | null;
  refresh_cadence: string | null;
  check_frequency: string | null;
  freshness_sla_days: number | null;
  current_release: string | null;
  source_modified_at: Date | null;
  source_period: string | null;
  retrieved_at: Date | null;
  last_success_at: Date | null;
  last_ingest_status: string | null;
  freshness_band: CmsSourceFreshnessRow["freshnessBand"];
  age_days: string | number | null;
  last_source_run_status: string | null;
  last_failure_at: Date | null;
  last_healthy_status: string | null;
  official_url: string | null;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export async function loadCmsSourceFreshness(): Promise<CmsSourceFreshnessRow[]> {
  const result = await getCareDatabasePool().query<FreshnessQueryRow>(
    `SELECT dataset_key, display_name, cms_identifier, refresh_cadence, check_frequency,
            freshness_sla_days, current_release, source_modified_at, source_period,
            retrieved_at, last_success_at, last_ingest_status, freshness_band, age_days,
            last_source_run_status, last_failure_at, last_healthy_status, official_url
     FROM cms_source_freshness
     ORDER BY dataset_key`,
  );
  return result.rows.map((row) => ({
    datasetKey: row.dataset_key,
    displayName: row.display_name,
    cmsIdentifier: row.cms_identifier,
    refreshCadence: row.refresh_cadence,
    checkFrequency: row.check_frequency,
    freshnessSlaDays: row.freshness_sla_days,
    currentRelease: row.current_release,
    sourceModifiedAt: iso(row.source_modified_at),
    sourcePeriod: row.source_period,
    retrievedAt: iso(row.retrieved_at),
    lastSuccessAt: iso(row.last_success_at),
    lastIngestStatus: row.last_ingest_status,
    freshnessBand: row.freshness_band,
    ageDays: row.age_days === null ? null : Number(row.age_days),
    lastSourceRunStatus: row.last_source_run_status,
    lastFailureAt: iso(row.last_failure_at),
    lastHealthyStatus: row.last_healthy_status,
    officialUrl: row.official_url,
  }));
}
