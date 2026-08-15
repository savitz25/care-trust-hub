"""Set-based transactional loader and health audit for CMS PBJ staffing."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from itertools import islice
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .database import (
    ReleaseChecksumConflict,
    _raw_object,
    _verified_release,
    iter_normalized_records,
)
from .manifest import ReleaseManifest, sha256_file
from .pbj import PBJ_NURSE_KEY, TRANSFORMATION_VERSION
from .registry import SourceDefinition

FORMULA_VERSION = "pbj-quarter-ratio-of-sums-v1"
HOUR_BASES = (
    "Hrs_RNDON",
    "Hrs_RNadmin",
    "Hrs_RN",
    "Hrs_LPNadmin",
    "Hrs_LPN",
    "Hrs_CNA",
    "Hrs_NAtrn",
    "Hrs_MedAide",
)


@dataclass(frozen=True, slots=True)
class PbjLoadResult:
    dataset_key: str
    release_key: str
    source_period: str
    checksum: str
    rows_read: int
    rows_loaded: int
    providers: int
    unmatched_ccns: int
    summaries_created: int
    ingest_run_id: str
    idempotent: bool
    stage_seconds: float
    transaction_seconds: float
    duration_seconds: float

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _copy_transport_stage(
    database_url: str, path: Path, load_key: str, batch_size: int = 10_000
) -> tuple[int, float]:
    if batch_size < 1:
        raise ValueError("COPY batch size must be positive")
    started = time.perf_counter()
    with psycopg.connect(database_url) as connection:
        connection.execute("DELETE FROM pbj_staffing_load_stage WHERE load_key=%s", (load_key,))
    count = 0
    records = iter_normalized_records(path)
    while batch := list(islice(records, batch_size)):
        values = [
            (
                load_key,
                count + offset,
                record["ccn"],
                record["source_record_locator"],
                Jsonb(record["normalized"]),
                Jsonb(record["raw"]),
            )
            for offset, record in enumerate(batch, start=1)
        ]
        try:
            with psycopg.connect(database_url) as connection:
                with connection.cursor().copy(
                    "COPY pbj_staffing_load_stage "
                    "(load_key, ordinal, ccn, locator, normalized, raw_record) FROM STDIN"
                ) as copy:
                    for value in values:
                        copy.write_row(value)
        except psycopg.OperationalError:
            with psycopg.connect(database_url) as connection:
                connection.cursor().executemany(
                    """
                    INSERT INTO pbj_staffing_load_stage
                      (load_key, ordinal, ccn, locator, normalized, raw_record)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (load_key, ordinal) DO NOTHING
                    """,
                    values,
                )
        count += len(batch)
    return count, round(time.perf_counter() - started, 3)


def _prepare_transaction_stage(cursor: psycopg.Cursor[Any], load_key: str) -> None:
    cursor.execute(
        """
        CREATE TEMP TABLE pbj_stage ON COMMIT DROP AS
        SELECT ccn, locator, normalized, raw_record, NULL::uuid AS provider_id
        FROM pbj_staffing_load_stage WHERE load_key=%s ORDER BY ordinal
        """,
        (load_key,),
    )
    cursor.execute(
        """
        UPDATE pbj_stage s SET provider_id=pi.provider_id
        FROM provider_identifier pi
        WHERE pi.issuer='CMS' AND pi.identifier_type='CCN'
          AND pi.identifier_value=s.ccn AND pi.valid_from IS NULL
        """
    )


def _insert_days(
    cursor: psycopg.Cursor[Any],
    release_id: str,
    raw_object_id: str,
    ingest_run_id: str,
) -> int:
    cursor.execute(
        """
        INSERT INTO pbj_staffing_day (
          provider_id, ccn, source_release_id, raw_object_id, ingest_run_id,
          daily_key, source_quarter, work_date, resident_census,
          hrs_rndon, hrs_rndon_emp, hrs_rndon_ctr,
          hrs_rnadmin, hrs_rnadmin_emp, hrs_rnadmin_ctr,
          hrs_rn, hrs_rn_emp, hrs_rn_ctr,
          hrs_lpnadmin, hrs_lpnadmin_emp, hrs_lpnadmin_ctr,
          hrs_lpn, hrs_lpn_emp, hrs_lpn_ctr,
          hrs_cna, hrs_cna_emp, hrs_cna_ctr,
          hrs_natrn, hrs_natrn_emp, hrs_natrn_ctr,
          hrs_medaide, hrs_medaide_emp, hrs_medaide_ctr,
          source_record_locator, raw_record, transformation_version
        )
        SELECT provider_id, ccn, %s, %s, %s,
          normalized->>'daily_key', normalized->>'quarter',
          (normalized->>'work_date')::date,
          (normalized->>'resident_census')::integer,
          (normalized->'hours'->>'Hrs_RNDON')::numeric,
          (normalized->'hours'->>'Hrs_RNDON_emp')::numeric,
          (normalized->'hours'->>'Hrs_RNDON_ctr')::numeric,
          (normalized->'hours'->>'Hrs_RNadmin')::numeric,
          (normalized->'hours'->>'Hrs_RNadmin_emp')::numeric,
          (normalized->'hours'->>'Hrs_RNadmin_ctr')::numeric,
          (normalized->'hours'->>'Hrs_RN')::numeric,
          (normalized->'hours'->>'Hrs_RN_emp')::numeric,
          (normalized->'hours'->>'Hrs_RN_ctr')::numeric,
          (normalized->'hours'->>'Hrs_LPNadmin')::numeric,
          (normalized->'hours'->>'Hrs_LPNadmin_emp')::numeric,
          (normalized->'hours'->>'Hrs_LPNadmin_ctr')::numeric,
          (normalized->'hours'->>'Hrs_LPN')::numeric,
          (normalized->'hours'->>'Hrs_LPN_emp')::numeric,
          (normalized->'hours'->>'Hrs_LPN_ctr')::numeric,
          (normalized->'hours'->>'Hrs_CNA')::numeric,
          (normalized->'hours'->>'Hrs_CNA_emp')::numeric,
          (normalized->'hours'->>'Hrs_CNA_ctr')::numeric,
          (normalized->'hours'->>'Hrs_NAtrn')::numeric,
          (normalized->'hours'->>'Hrs_NAtrn_emp')::numeric,
          (normalized->'hours'->>'Hrs_NAtrn_ctr')::numeric,
          (normalized->'hours'->>'Hrs_MedAide')::numeric,
          (normalized->'hours'->>'Hrs_MedAide_emp')::numeric,
          (normalized->'hours'->>'Hrs_MedAide_ctr')::numeric,
          locator, raw_record, %s
        FROM pbj_stage
        ON CONFLICT (source_release_id, ccn, work_date) DO NOTHING
        """,
        (release_id, raw_object_id, ingest_run_id, TRANSFORMATION_VERSION),
    )
    return cursor.rowcount


def _insert_summaries(
    cursor: psycopg.Cursor[Any], release_id: str, raw_object_id: str, ingest_run_id: str
) -> int:
    total = " + ".join(f"hrs_{name.lower()[4:]}" for name in HOUR_BASES)
    employee = " + ".join(f"hrs_{name.lower()[4:]}_emp" for name in HOUR_BASES)
    contract = " + ".join(f"hrs_{name.lower()[4:]}_ctr" for name in HOUR_BASES)
    rn = "hrs_rndon + hrs_rnadmin + hrs_rn"
    lpn = "hrs_lpnadmin + hrs_lpn"
    cursor.execute(
        f"""
        WITH daily AS (
          SELECT *, ({total}) total_hours, ({rn}) rn_group_hours,
            ({lpn}) lpn_group_hours, ({employee}) employee_hours,
            ({contract}) contract_hours,
            extract(isodow FROM work_date) IN (6,7) AS weekend
          FROM pbj_staffing_day WHERE source_release_id=%s
        ), aggregate AS (
          SELECT ccn, min(provider_id::text)::uuid provider_id, source_quarter,
            min(work_date) coverage_start, max(work_date) coverage_end,
            count(*)::integer days_represented,
            count(*) FILTER (WHERE resident_census > 0)::integer positive_census_days,
            count(*) FILTER (WHERE resident_census = 0)::integer zero_census_days,
            count(*) FILTER (WHERE resident_census IS NULL)::integer missing_census_days,
            coalesce(sum(resident_census) FILTER (WHERE resident_census > 0),0)::bigint census_sum,
            sum(total_hours) FILTER (WHERE resident_census > 0) total_nurse_hours,
            sum(rn_group_hours) FILTER (WHERE resident_census > 0) rn_hours,
            sum(lpn_group_hours) FILTER (WHERE resident_census > 0) lpn_hours,
            sum(hrs_cna) FILTER (WHERE resident_census > 0) cna_hours,
            sum(employee_hours) FILTER (WHERE resident_census > 0) employee_nurse_hours,
            sum(contract_hours) FILTER (WHERE resident_census > 0) contract_nurse_hours,
            sum(resident_census) FILTER (WHERE resident_census > 0 AND NOT weekend) weekday_census,
            sum(resident_census) FILTER (WHERE resident_census > 0 AND weekend) weekend_census,
            sum(total_hours) FILTER (WHERE resident_census > 0 AND NOT weekend) weekday_total,
            sum(total_hours) FILTER (WHERE resident_census > 0 AND weekend) weekend_total,
            sum(rn_group_hours) FILTER (WHERE resident_census > 0 AND NOT weekend) weekday_rn,
            sum(rn_group_hours) FILTER (WHERE resident_census > 0 AND weekend) weekend_rn,
            count(*) FILTER (WHERE resident_census > 0 AND rn_group_hours=0)::integer zero_rn_days,
            count(*) FILTER (WHERE resident_census > 0 AND total_hours IS NULL) missing_total_days,
            count(*) FILTER (WHERE resident_census > 0 AND rn_group_hours IS NULL) missing_rn_days,
            count(*) FILTER (WHERE resident_census > 0 AND lpn_group_hours IS NULL)
              missing_lpn_days,
            count(*) FILTER (WHERE resident_census > 0 AND hrs_cna IS NULL) missing_cna_days,
            count(*) FILTER (
              WHERE resident_census > 0 AND (employee_hours IS NULL OR contract_hours IS NULL)
            ) missing_employment_days
          FROM daily GROUP BY ccn, source_quarter
        )
        INSERT INTO pbj_staffing_quarter_summary (
          provider_id, ccn, source_release_id, raw_object_id, ingest_run_id, source_quarter,
          coverage_start, coverage_end, days_represented, positive_census_days,
          zero_census_days, missing_census_days, census_sum, total_nurse_hours, rn_hours,
          lpn_hours, cna_hours, employee_nurse_hours, contract_nurse_hours,
          total_nurse_hprd, rn_hprd, lpn_hprd, cna_hprd,
          weekday_total_nurse_hprd, weekend_total_nurse_hprd,
          weekday_rn_hprd, weekend_rn_hprd, contract_nurse_share,
          zero_reported_rn_days, formula_version, source_record_locator, transformation_version
        )
        SELECT provider_id, ccn, %s, %s, %s, source_quarter,
          coverage_start, coverage_end, days_represented, positive_census_days,
          zero_census_days, missing_census_days, census_sum,
          CASE WHEN missing_total_days=0 THEN total_nurse_hours END,
          CASE WHEN missing_rn_days=0 THEN rn_hours END,
          CASE WHEN missing_lpn_days=0 THEN lpn_hours END,
          CASE WHEN missing_cna_days=0 THEN cna_hours END,
          CASE WHEN missing_employment_days=0 THEN employee_nurse_hours END,
          CASE WHEN missing_employment_days=0 THEN contract_nurse_hours END,
          CASE WHEN census_sum>0 AND missing_total_days=0
            THEN round(total_nurse_hours/census_sum,6) END,
          CASE WHEN census_sum>0 AND missing_rn_days=0 THEN round(rn_hours/census_sum,6) END,
          CASE WHEN census_sum>0 AND missing_lpn_days=0 THEN round(lpn_hours/census_sum,6) END,
          CASE WHEN census_sum>0 AND missing_cna_days=0 THEN round(cna_hours/census_sum,6) END,
          CASE WHEN weekday_census>0 AND missing_total_days=0
            THEN round(weekday_total/weekday_census,6) END,
          CASE WHEN weekend_census>0 AND missing_total_days=0
            THEN round(weekend_total/weekend_census,6) END,
          CASE WHEN weekday_census>0 AND missing_rn_days=0
            THEN round(weekday_rn/weekday_census,6) END,
          CASE WHEN weekend_census>0 AND missing_rn_days=0
            THEN round(weekend_rn/weekend_census,6) END,
          CASE WHEN missing_employment_days=0 AND employee_nurse_hours+contract_nurse_hours>0
            THEN round(contract_nurse_hours/(employee_nurse_hours+contract_nurse_hours),8) END,
          zero_rn_days, %s, 'derived:quarter:' || source_quarter, %s
        FROM aggregate
        ON CONFLICT (source_release_id, ccn) DO NOTHING
        """,
        (
            release_id,
            release_id,
            raw_object_id,
            ingest_run_id,
            FORMULA_VERSION,
            TRANSFORMATION_VERSION,
        ),
    )
    return cursor.rowcount


def load_pbj_source(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    raw_file: Path,
    normalized_file: Path,
) -> PbjLoadResult:
    started = time.perf_counter()
    if source.dataset_key != PBJ_NURSE_KEY or manifest.source_period is None:
        raise ValueError("PBJ loader requires the verified nurse dataset and source period")
    if sha256_file(raw_file) != manifest.sha256:
        raise ValueError("raw source does not match immutable release manifest")
    release_key = manifest.source_release_date or manifest.sha256
    with psycopg.connect(database_url) as connection:
        prior = connection.execute(
            """
            SELECT sr.content_sha256, ir.id, ir.report
            FROM source_dataset sd JOIN source_release sr ON sr.source_dataset_id=sd.id
            LEFT JOIN ingest_run ir ON ir.source_release_id=sr.id
              AND ir.transformation_version=%s AND ir.status='succeeded'
            WHERE sd.dataset_key=%s AND sr.release_key=%s
            """,
            (TRANSFORMATION_VERSION, source.dataset_key, release_key),
        ).fetchone()
    if prior and prior[0] != manifest.sha256:
        raise ReleaseChecksumConflict(
            f"release {source.dataset_key}/{release_key} has a conflicting checksum"
        )
    if prior and prior[1] is not None:
        report = prior[2]
        return PbjLoadResult(
            source.dataset_key,
            release_key,
            manifest.source_period,
            manifest.sha256,
            report["rows_read"],
            report["rows_loaded"],
            report["providers"],
            report["unmatched_ccns"],
            report["summaries_created"],
            str(prior[1]),
            True,
            0,
            0,
            round(time.perf_counter() - started, 3),
        )
    load_key = f"{source.dataset_key}:{manifest.sha256}"
    rows, stage_seconds = _copy_transport_stage(database_url, normalized_file, load_key)
    transaction_started = time.perf_counter()
    with psycopg.connect(database_url) as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                release_id, _ = _verified_release(cursor, source, manifest)
                raw_object_id = _raw_object(cursor, release_id, manifest)
                cursor.execute(
                    "INSERT INTO ingest_run "
                    "(source_release_id, transformation_version, status, started_at) "
                    "VALUES (%s,%s,'running',now()) RETURNING id",
                    (release_id, TRANSFORMATION_VERSION),
                )
                run_id = str(cursor.fetchone()[0])
                _prepare_transaction_stage(cursor, load_key)
                cursor.execute("SELECT count(DISTINCT ccn) FROM pbj_stage")
                providers = cursor.fetchone()[0]
                cursor.execute(
                    "SELECT count(DISTINCT ccn) FROM pbj_stage WHERE provider_id IS NULL"
                )
                unmatched = cursor.fetchone()[0]
                loaded = _insert_days(cursor, release_id, raw_object_id, run_id)
                if loaded != rows:
                    raise RuntimeError("PBJ daily load count mismatch")
                summaries = _insert_summaries(cursor, release_id, raw_object_id, run_id)
                report = {
                    "rows_read": rows,
                    "rows_loaded": loaded,
                    "providers": providers,
                    "unmatched_ccns": unmatched,
                    "summaries_created": summaries,
                    "source_period": manifest.source_period,
                }
                cursor.execute(
                    "UPDATE ingest_run SET status='succeeded', completed_at=now(), rows_read=%s, "
                    "valid_rows=%s, report=%s WHERE id=%s",
                    (rows, loaded, Jsonb(report), run_id),
                )
                cursor.execute("DELETE FROM pbj_staffing_load_stage WHERE load_key=%s", (load_key,))
    transaction_seconds = round(time.perf_counter() - transaction_started, 3)
    return PbjLoadResult(
        source.dataset_key,
        release_key,
        manifest.source_period,
        manifest.sha256,
        rows,
        loaded,
        providers,
        unmatched,
        summaries,
        run_id,
        False,
        stage_seconds,
        transaction_seconds,
        round(time.perf_counter() - started, 3),
    )


def audit_pbj_database(database_url: str) -> dict[str, int]:
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            """
            SELECT
              (SELECT count(*) FROM pbj_staffing_day),
              (SELECT count(*) FROM pbj_staffing_quarter_summary),
              (SELECT count(*) FROM pbj_staffing_day WHERE provider_id IS NULL),
              (SELECT count(DISTINCT ccn) FROM pbj_staffing_day WHERE provider_id IS NULL),
              (SELECT count(*) FROM pbj_staffing_day WHERE resident_census IS NULL),
              (SELECT count(*) FROM pbj_staffing_day WHERE resident_census=0),
              (SELECT count(*) FROM pbj_staffing_day WHERE resident_census<0),
              (SELECT count(*) FROM pbj_staffing_day WHERE source_release_id IS NULL
                OR raw_object_id IS NULL OR ingest_run_id IS NULL),
              (SELECT count(*) FROM (SELECT source_release_id, ccn, work_date
                FROM pbj_staffing_day GROUP BY 1,2,3 HAVING count(*)>1) d),
              (SELECT count(*) FROM pbj_staffing_quarter_summary s WHERE
                s.days_represented<>(SELECT count(*) FROM pbj_staffing_day d
                  WHERE d.source_release_id=s.source_release_id AND d.ccn=s.ccn)),
              (SELECT count(*) FROM ingest_run ir
                JOIN source_release sr ON sr.id=ir.source_release_id
                JOIN source_dataset sd ON sd.id=sr.source_dataset_id
                WHERE sd.dataset_key=%s AND ir.status='running')
            """,
            (PBJ_NURSE_KEY,),
        ).fetchone()
    names = (
        "staffing_days",
        "quarter_summaries",
        "unmatched_staffing_days",
        "unmatched_ccns",
        "missing_census_days",
        "zero_census_days",
        "negative_census_days",
        "lineage_gaps",
        "duplicate_provider_days",
        "summary_detail_mismatches",
        "running_ingests",
    )
    return dict(zip(names, row, strict=True))
