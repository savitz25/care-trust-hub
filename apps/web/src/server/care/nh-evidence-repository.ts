import "server-only";
import { getCareDatabasePool } from "./db";
import type { CareNhEvidence } from "./types";

function validateCcn(ccn: string): string {
  const value = ccn.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(value)) throw new RangeError("Invalid CMS CCN");
  return value;
}

export async function getNursingHomeEvidence(ccn: string): Promise<CareNhEvidence | null> {
  const value = validateCcn(ccn);
  const pool = getCareDatabasePool();
  const [directory, designations, npis, measures, fire, mdsRelease, fireRelease] =
    await Promise.all([
      pool.query<{ directory_status: string; notes: string }>(
        `SELECT directory_status, notes
         FROM provider_directory_status
         WHERE ccn = $1
         ORDER BY observed_at DESC
         LIMIT 1`,
        [value],
      ),
      pool.query<{
        designation_kind: "special_focus" | "abuse_icon";
        official_status: string;
        raw_official_value: string;
        source_field: string;
        reporting_period: string | null;
        observed_at: Date | null;
      }>(
        `SELECT designation_kind, official_status, raw_official_value, source_field,
                reporting_period, observed_at
         FROM published_cms_facility_designation
         WHERE ccn = $1
         ORDER BY designation_kind`,
        [value],
      ),
      pool.query<{
        npi: string;
        enrollment_id: string | null;
        multiple_npi_flag: boolean | null;
      }>(
        `SELECT npi, enrollment_id, multiple_npi_flag
         FROM published_provider_npi_relationship
         WHERE ccn = $1
         ORDER BY npi`,
        [value],
      ),
      pool.query<{
        measure_code: string;
        official_name: string;
        stay_type: string | null;
        score: string | null;
        suppressed: boolean;
        footnote: string | null;
        used_in_five_star_rating: boolean | null;
        measure_period: string | null;
      }>(
        `SELECT o.measure_code, d.official_name, d.stay_type, o.score::text, o.suppressed,
                o.footnote, o.used_in_five_star_rating, o.measure_period
         FROM published_facility_quality_measure o
         JOIN quality_measure_definition d ON d.measure_code = o.measure_code
         WHERE o.ccn = $1
         ORDER BY d.stay_type, d.official_name`,
        [value],
      ),
      pool.query<{
        survey_date: string;
        deficiency_tag: string;
        official_description: string | null;
        scope_severity_code: string;
        complaint_deficiency: boolean | null;
      }>(
        `SELECT survey_date::text, deficiency_tag, official_description, scope_severity_code,
                complaint_deficiency
         FROM fire_safety_citation
         WHERE ccn = $1
         ORDER BY survey_date DESC
         LIMIT 12`,
        [value],
      ),
      pool.query<{ release_key: string }>(
        `SELECT r.release_key
         FROM source_release r
         JOIN source_dataset d ON d.id = r.source_dataset_id
         JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
         WHERE d.dataset_key = 'nursing-home-mds-quality-measures'
         ORDER BY r.source_modified_at DESC NULLS LAST
         LIMIT 1`,
      ),
      pool.query<{ release_key: string }>(
        `SELECT r.release_key
         FROM source_release r
         JOIN source_dataset d ON d.id = r.source_dataset_id
         JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
         WHERE d.dataset_key = 'nursing-home-fire-safety-deficiencies'
         ORDER BY r.source_modified_at DESC NULLS LAST
         LIMIT 1`,
      ),
    ]);
  return {
    directoryStatus: directory.rows[0]?.directory_status ?? "STATUS_UNKNOWN",
    directoryNotes:
      directory.rows[0]?.notes ??
      "Current operating status is unknown from the loaded CMS sources.",
    designations: designations.rows.map((row) => ({
      kind: row.designation_kind,
      officialStatus: row.official_status,
      rawOfficialValue: row.raw_official_value,
      sourceField: row.source_field,
      reportingPeriod: row.reporting_period,
      observedAt: row.observed_at?.toISOString() ?? null,
    })),
    enrollmentNpis: npis.rows.map((row) => ({
      npi: row.npi,
      enrollmentId: row.enrollment_id,
      multipleNpiFlag: row.multiple_npi_flag,
    })),
    mdsMeasures: measures.rows.map((row) => ({
      measureCode: row.measure_code,
      officialName: row.official_name,
      stayType: row.stay_type,
      fourQuarterAverage: row.score,
      suppressed: row.suppressed,
      footnote: row.footnote,
      usedInFiveStarRating: row.used_in_five_star_rating,
      measurePeriod: row.measure_period,
    })),
    fireCitations: fire.rows.map((row) => ({
      surveyDate: row.survey_date,
      tag: row.deficiency_tag,
      description: row.official_description,
      scopeSeverityCode: row.scope_severity_code,
      complaintDeficiency: row.complaint_deficiency,
    })),
    freshness: {
      providerInformationObservedAt:
        designations.rows.find((row) => row.observed_at)?.observed_at?.toISOString() ?? null,
      mdsRelease: mdsRelease.rows[0]?.release_key ?? null,
      fireRelease: fireRelease.rows[0]?.release_key ?? null,
    },
  };
}
