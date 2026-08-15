import "server-only";
import type { QueryResultRow } from "pg";
import { getCareDatabasePool } from "./db";
import { CMS_PBJ_NURSE_SOURCE } from "./source-contracts";
import type {
  CareDailyStaffing,
  CareStaffingIntelligence,
  CareStaffingQuarterSummary,
  CareStaffingSourceDisclosure,
} from "./types";

function validateCcn(ccn: string): string {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) throw new RangeError("Invalid CMS CCN");
  return value;
}

function validateQuarter(quarter: string): string {
  if (!/^20\d{2}Q[1-4]$/.test(quarter)) throw new RangeError("Invalid PBJ quarter");
  return quarter;
}

interface StaffingRow extends QueryResultRow {
  ccn: string;
  source_quarter: string;
  coverage_start: string;
  coverage_end: string;
  days_represented: number;
  positive_census_days: number;
  missing_census_days: number;
  total_nurse_hprd: string | null;
  rn_hprd: string | null;
  lpn_hprd: string | null;
  cna_hprd: string | null;
  weekday_total_nurse_hprd: string | null;
  weekend_total_nurse_hprd: string | null;
  weekday_rn_hprd: string | null;
  weekend_rn_hprd: string | null;
  contract_nurse_share: string | null;
  zero_reported_rn_days: number;
  formula_version: string;
  source_record_locator: string;
  source_organization: string;
  dataset_name: string;
  official_url: string;
  release_key: string;
  source_version_identifier: string | null;
  source_modified_at: Date | null;
  source_published_at: Date | null;
  retrieved_at: Date;
}

interface DailyRow extends QueryResultRow {
  work_date: string;
  resident_census: number | null;
  total_nurse_hprd: string | null;
  rn_hprd: string | null;
  lpn_hprd: string | null;
  cna_hprd: string | null;
  is_weekend: boolean;
}

const numeric = (value: string | null): number | null => (value === null ? null : Number(value));

function disclosure(row: StaffingRow): CareStaffingSourceDisclosure {
  return {
    sourceOrganization: row.source_organization,
    datasetName: row.dataset_name,
    cmsDatasetIdentifier: CMS_PBJ_NURSE_SOURCE.datasetIdentifier,
    sourceVersionIdentifier: row.source_version_identifier,
    officialSourceUrl: row.official_url,
    releaseIdentifier: row.release_key,
    sourceQuarter: row.source_quarter,
    sourceModifiedAt: row.source_modified_at?.toISOString() ?? null,
    sourcePublishedAt: row.source_published_at?.toISOString() ?? null,
    retrievedAt: row.retrieved_at.toISOString(),
    providerIdentifier: row.ccn,
    sourceRecordLocator: row.source_record_locator,
  };
}

function summary(row: StaffingRow): CareStaffingQuarterSummary {
  return {
    quarter: row.source_quarter,
    coverageStart: row.coverage_start,
    coverageEnd: row.coverage_end,
    daysRepresented: row.days_represented,
    positiveCensusDays: row.positive_census_days,
    missingCensusDays: row.missing_census_days,
    totalNurseHprd: numeric(row.total_nurse_hprd),
    rnHprd: numeric(row.rn_hprd),
    lpnHprd: numeric(row.lpn_hprd),
    cnaHprd: numeric(row.cna_hprd),
    weekdayTotalNurseHprd: numeric(row.weekday_total_nurse_hprd),
    weekendTotalNurseHprd: numeric(row.weekend_total_nurse_hprd),
    weekdayRnHprd: numeric(row.weekday_rn_hprd),
    weekendRnHprd: numeric(row.weekend_rn_hprd),
    contractNurseShare: numeric(row.contract_nurse_share),
    zeroReportedRnDays: row.zero_reported_rn_days,
    formulaVersion: row.formula_version,
    source: disclosure(row),
  };
}

const summarySelect = `SELECT DISTINCT ON (s.source_quarter)
  s.ccn, s.source_quarter, s.coverage_start::text, s.coverage_end::text,
  s.days_represented, s.positive_census_days, s.missing_census_days,
  s.total_nurse_hprd::text, s.rn_hprd::text, s.lpn_hprd::text, s.cna_hprd::text,
  s.weekday_total_nurse_hprd::text, s.weekend_total_nurse_hprd::text,
  s.weekday_rn_hprd::text, s.weekend_rn_hprd::text, s.contract_nurse_share::text,
  s.zero_reported_rn_days, s.formula_version, s.source_record_locator,
  sd.source_organization, sd.display_name dataset_name, sd.official_url,
  sr.release_key, sr.source_version_identifier, sr.source_modified_at,
  sr.source_published_at, sr.retrieved_at
  FROM pbj_staffing_quarter_summary s
  JOIN source_release sr ON sr.id=s.source_release_id
  JOIN source_dataset sd ON sd.id=sr.source_dataset_id
  WHERE s.ccn=$1 AND sd.dataset_key='${CMS_PBJ_NURSE_SOURCE.datasetKey}'
  ORDER BY s.source_quarter DESC, sr.source_modified_at DESC NULLS LAST,
    sr.retrieved_at DESC`;

export async function getProviderStaffingHistory(
  ccn: string,
  limit = 8,
): Promise<CareStaffingQuarterSummary[]> {
  const identifier = validateCcn(ccn);
  if (!Number.isInteger(limit) || limit < 1 || limit > 12) {
    throw new RangeError("Staffing history limit must be between 1 and 12");
  }
  const result = await getCareDatabasePool().query<StaffingRow>(`${summarySelect} LIMIT $2`, [
    identifier,
    limit,
  ]);
  return result.rows.map(summary);
}

export async function getProviderStaffingSummary(ccn: string): Promise<CareStaffingIntelligence> {
  const history = await getProviderStaffingHistory(ccn, 8);
  return { latest: history[0] ?? null, history };
}

export async function getProviderDailyStaffing(
  ccn: string,
  quarter: string,
): Promise<CareDailyStaffing[]> {
  const identifier = validateCcn(ccn);
  const sourceQuarter = validateQuarter(quarter);
  const result = await getCareDatabasePool().query<DailyRow>(
    `WITH selected_release AS (
      SELECT d.source_release_id
      FROM pbj_staffing_day d
      JOIN source_release sr ON sr.id=d.source_release_id
      JOIN source_dataset sd ON sd.id=sr.source_dataset_id
      WHERE d.ccn=$1 AND d.source_quarter=$2
        AND sd.dataset_key='${CMS_PBJ_NURSE_SOURCE.datasetKey}'
      ORDER BY sr.source_modified_at DESC NULLS LAST, sr.retrieved_at DESC
      LIMIT 1
    )
    SELECT d.work_date::text, d.resident_census,
      CASE WHEN d.resident_census>0 THEN
        round((d.hrs_rndon+d.hrs_rnadmin+d.hrs_rn+d.hrs_lpnadmin+d.hrs_lpn+
          d.hrs_cna+d.hrs_natrn+d.hrs_medaide)/d.resident_census,6)::text END total_nurse_hprd,
      CASE WHEN d.resident_census>0 THEN
        round((d.hrs_rndon+d.hrs_rnadmin+d.hrs_rn)/d.resident_census,6)::text END rn_hprd,
      CASE WHEN d.resident_census>0 THEN
        round((d.hrs_lpnadmin+d.hrs_lpn)/d.resident_census,6)::text END lpn_hprd,
      CASE WHEN d.resident_census>0 THEN round(d.hrs_cna/d.resident_census,6)::text END cna_hprd,
      extract(isodow FROM d.work_date) IN (6,7) is_weekend
      FROM pbj_staffing_day d
      JOIN selected_release selected ON selected.source_release_id=d.source_release_id
      WHERE d.ccn=$1 AND d.source_quarter=$2
      ORDER BY d.work_date
      LIMIT 92`,
    [identifier, sourceQuarter],
  );
  return result.rows.map((row) => ({
    workDate: row.work_date,
    residentCensus: row.resident_census,
    totalNurseHprd: numeric(row.total_nurse_hprd),
    rnHprd: numeric(row.rn_hprd),
    lpnHprd: numeric(row.lpn_hprd),
    cnaHprd: numeric(row.cna_hprd),
    isWeekend: row.is_weekend,
  }));
}

export async function getProviderWeekendStaffing(
  ccn: string,
  quarter: string,
): Promise<Pick<
  CareStaffingQuarterSummary,
  "weekdayTotalNurseHprd" | "weekendTotalNurseHprd" | "weekdayRnHprd" | "weekendRnHprd"
> | null> {
  const sourceQuarter = validateQuarter(quarter);
  const history = await getProviderStaffingHistory(ccn, 12);
  const match = history.find((item) => item.quarter === sourceQuarter);
  return match
    ? {
        weekdayTotalNurseHprd: match.weekdayTotalNurseHprd,
        weekendTotalNurseHprd: match.weekendTotalNurseHprd,
        weekdayRnHprd: match.weekdayRnHprd,
        weekendRnHprd: match.weekendRnHprd,
      }
    : null;
}
