"""Set-based transactional loader for CMS regulatory datasets."""

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
from .registry import SourceDefinition
from .regulatory import (
    DEFICIENCIES_KEY,
    INSPECTIONS_KEY,
    PENALTIES_KEY,
    TRANSFORMATION_VERSIONS,
)


@dataclass(frozen=True, slots=True)
class RegulatoryLoadResult:
    dataset_key: str
    release_key: str
    checksum: str
    rows_read: int
    rows_loaded: int
    unmatched_ccns: int
    ingest_run_id: str
    idempotent: bool
    duration_seconds: float

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def audit_regulatory_database(database_url: str) -> dict[str, int | str | None]:
    """Return safe aggregate health metrics without exposing provider records."""
    with psycopg.connect(database_url) as connection:
        row = connection.execute(
            """
            SELECT
              (SELECT count(*) FROM inspection_event),
              (SELECT count(*) FROM deficiency_finding),
              (SELECT count(*) FROM penalty_enforcement),
              (SELECT count(*) FROM ingest_run WHERE status='running'),
              (SELECT count(*) FROM deficiency_finding WHERE inspection_event_id IS NULL),
              (SELECT count(*) FROM inspection_event i
                LEFT JOIN provider p ON p.id=i.provider_id WHERE p.id IS NULL),
              (SELECT count(*) FROM deficiency_finding d
                LEFT JOIN provider p ON p.id=d.provider_id WHERE p.id IS NULL),
              (SELECT count(*) FROM penalty_enforcement e
                LEFT JOIN provider p ON p.id=e.provider_id WHERE p.id IS NULL),
              (SELECT count(*) FROM deficiency_finding WHERE scope_severity_code !~ '^[A-L]$'),
              (SELECT count(*) FROM inspection_event WHERE survey_date > current_date),
              (SELECT count(*) FROM deficiency_finding WHERE official_description IS NULL),
              (SELECT count(*) FROM deficiency_finding WHERE scope_severity_code IN ('J','K','L')),
              (SELECT count(*) FROM penalty_enforcement WHERE penalty_type='Fine'),
              (SELECT count(*) FROM penalty_enforcement WHERE penalty_type='Payment Denial'),
              (SELECT coalesce(sum(fine_amount), 0)::text FROM penalty_enforcement),
              (SELECT count(*) FROM penalty_enforcement
                WHERE penalty_type='Fine' AND fine_amount IS NULL),
              (SELECT count(*) FROM penalty_enforcement WHERE fine_amount < 0),
              (SELECT count(*) FROM inspection_event WHERE source_release_id IS NULL
                OR raw_object_id IS NULL OR ingest_run_id IS NULL
                OR source_record_locator IS NULL),
              (SELECT count(*) FROM deficiency_finding WHERE source_release_id IS NULL
                OR raw_object_id IS NULL OR ingest_run_id IS NULL
                OR source_record_locator IS NULL),
              (SELECT count(*) FROM penalty_enforcement WHERE source_release_id IS NULL
                OR raw_object_id IS NULL OR ingest_run_id IS NULL
                OR source_record_locator IS NULL),
              (SELECT count(*) FROM (SELECT source_release_id, event_key
                FROM inspection_event GROUP BY 1,2 HAVING count(*) > 1) duplicates),
              (SELECT count(*) FROM (SELECT source_release_id, finding_key
                FROM deficiency_finding GROUP BY 1,2 HAVING count(*) > 1) duplicates),
              (SELECT count(*) FROM (SELECT source_release_id, penalty_key
                FROM penalty_enforcement GROUP BY 1,2 HAVING count(*) > 1) duplicates)
            """
        ).fetchone()
    names = (
        "inspections",
        "deficiencies",
        "penalties",
        "running_ingests",
        "unlinked_deficiencies",
        "orphaned_inspections",
        "orphaned_deficiencies",
        "orphaned_penalties",
        "unknown_severity_codes",
        "future_inspection_dates",
        "missing_deficiency_descriptions",
        "immediate_jeopardy_findings",
        "monetary_penalties",
        "payment_denials",
        "published_fine_amount_total",
        "fines_missing_amount",
        "negative_fine_amounts",
        "inspection_lineage_gaps",
        "deficiency_lineage_gaps",
        "penalty_lineage_gaps",
        "duplicate_inspection_keys",
        "duplicate_deficiency_keys",
        "duplicate_penalty_keys",
    )
    return dict(zip(names, row, strict=True))


def _copy_transport_stage(
    database_url: str, path: Path, load_key: str, batch_size: int = 2_000
) -> int:
    if batch_size < 1:
        raise ValueError("COPY batch size must be positive")
    with psycopg.connect(database_url) as connection:
        connection.execute("DELETE FROM regulatory_load_stage WHERE load_key=%s", (load_key,))
    count = 0
    records = iter_normalized_records(path)
    while batch := list(islice(records, batch_size)):
        values = []
        for offset, record in enumerate(batch, start=1):
            values.append(
                (
                    load_key,
                    count + offset,
                    record["ccn"],
                    record["source_record_locator"],
                    Jsonb(record["normalized"]),
                    Jsonb(record["raw"]),
                )
            )
        try:
            with psycopg.connect(database_url) as connection:
                with connection.cursor().copy(
                    "COPY regulatory_load_stage "
                    "(load_key, ordinal, ccn, locator, normalized, raw_record) FROM STDIN"
                ) as copy:
                    for value in values:
                        copy.write_row(value)
        except psycopg.OperationalError:
            with psycopg.connect(database_url) as connection:
                connection.cursor().executemany(
                    """
                    INSERT INTO regulatory_load_stage
                      (load_key, ordinal, ccn, locator, normalized, raw_record)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    ON CONFLICT (load_key, ordinal) DO NOTHING
                    """,
                    values,
                )
        count += len(batch)
    return count


def _prepare_transaction_stage(cursor: psycopg.Cursor[Any], load_key: str) -> None:
    cursor.execute(
        """
        CREATE TEMP TABLE regulatory_stage ON COMMIT DROP AS
        SELECT ccn, locator, normalized, raw_record, NULL::uuid AS provider_id
        FROM regulatory_load_stage WHERE load_key=%s ORDER BY ordinal
        """,
        (load_key,),
    )
    cursor.execute(
        """
        UPDATE regulatory_stage s SET provider_id = pi.provider_id
        FROM provider_identifier pi
        WHERE pi.issuer='CMS' AND pi.identifier_type='CCN'
          AND pi.identifier_value=s.ccn AND pi.valid_from IS NULL
        """
    )


def _insert_records(
    cursor: psycopg.Cursor[Any],
    dataset_key: str,
    release_id: str,
    raw_object_id: str,
    ingest_run_id: str,
    version: str,
) -> int:
    common = (release_id, raw_object_id, ingest_run_id, version)
    if dataset_key == INSPECTIONS_KEY:
        cursor.execute(
            """
            INSERT INTO inspection_event (
              provider_id, source_release_id, raw_object_id, ingest_run_id, event_key,
              survey_date, survey_type, survey_cycle, processing_date,
              source_record_locator, raw_record, transformation_version
            )
            SELECT provider_id, %s, %s, %s, normalized->>'event_key',
              (normalized->>'survey_date')::date, normalized->>'survey_type',
              (normalized->>'survey_cycle')::integer, (normalized->>'processing_date')::date,
              locator, raw_record, %s
            FROM regulatory_stage WHERE provider_id IS NOT NULL
            ON CONFLICT (source_release_id, event_key) DO NOTHING
            """,
            common,
        )
    elif dataset_key == DEFICIENCIES_KEY:
        cursor.execute(
            """
            INSERT INTO deficiency_finding (
              provider_id, inspection_event_id, source_release_id, raw_object_id, ingest_run_id,
              finding_key, survey_date, survey_type, inspection_cycle, deficiency_prefix,
              deficiency_tag, deficiency_category, official_description, scope_severity_code,
              deficiency_corrected, correction_date, standard_deficiency, complaint_deficiency,
              infection_control_deficiency, citation_under_idr, citation_under_iidr,
              processing_date, source_record_locator, raw_record, transformation_version
            )
            SELECT s.provider_id, matched.id, %s, %s, %s, s.normalized->>'finding_key',
              (s.normalized->>'survey_date')::date, s.normalized->>'survey_type',
              (s.normalized->>'inspection_cycle')::integer, s.normalized->>'deficiency_prefix',
              s.normalized->>'deficiency_tag', s.normalized->>'deficiency_category',
              s.normalized->>'official_description', s.normalized->>'scope_severity_code',
              s.normalized->>'deficiency_corrected', (s.normalized->>'correction_date')::date,
              (s.normalized->>'standard')::boolean, (s.normalized->>'complaint')::boolean,
              (s.normalized->>'infection_control')::boolean, (s.normalized->>'under_idr')::boolean,
              (s.normalized->>'under_iidr')::boolean, (s.normalized->>'processing_date')::date,
              s.locator, s.raw_record, %s
            FROM regulatory_stage s
            LEFT JOIN LATERAL (
              SELECT i.id FROM inspection_event i
              WHERE i.provider_id=s.provider_id
                AND i.survey_date=(s.normalized->>'survey_date')::date
                AND i.survey_cycle=(s.normalized->>'inspection_cycle')::integer
                AND i.survey_type = CASE
                  WHEN (s.normalized->>'standard')::boolean
                    AND NOT COALESCE((s.normalized->>'complaint')::boolean, false)
                    AND NOT COALESCE((s.normalized->>'infection_control')::boolean, false)
                    THEN 'Health Standard'
                  WHEN (s.normalized->>'complaint')::boolean
                    AND NOT COALESCE((s.normalized->>'standard')::boolean, false)
                    AND NOT COALESCE((s.normalized->>'infection_control')::boolean, false)
                    THEN 'Health Complaint'
                  WHEN (s.normalized->>'infection_control')::boolean
                    AND NOT COALESCE((s.normalized->>'standard')::boolean, false)
                    AND NOT COALESCE((s.normalized->>'complaint')::boolean, false)
                    THEN 'Infection Control'
                  ELSE NULL END
              ORDER BY i.source_release_id DESC LIMIT 1
            ) matched ON true
            WHERE s.provider_id IS NOT NULL
            ON CONFLICT (source_release_id, finding_key) DO NOTHING
            """,
            common,
        )
    elif dataset_key == PENALTIES_KEY:
        cursor.execute(
            """
            INSERT INTO penalty_enforcement (
              provider_id, source_release_id, raw_object_id, ingest_run_id, penalty_key,
              penalty_date, penalty_type, fine_id, fine_amount, payment_denial_start_date,
              payment_denial_days, processing_date, source_record_locator, raw_record,
              transformation_version
            )
            SELECT provider_id, %s, %s, %s, normalized->>'penalty_key',
              (normalized->>'penalty_date')::date, normalized->>'penalty_type',
              normalized->>'fine_id', (normalized->>'fine_amount')::numeric,
              (normalized->>'payment_denial_start_date')::date,
              (normalized->>'payment_denial_days')::integer,
              (normalized->>'processing_date')::date, locator, raw_record, %s
            FROM regulatory_stage WHERE provider_id IS NOT NULL
            ON CONFLICT (source_release_id, penalty_key) DO NOTHING
            """,
            common,
        )
    else:
        raise ValueError(f"unsupported regulatory dataset: {dataset_key}")
    return cursor.rowcount


def load_regulatory_source(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    raw_file: Path,
    normalized_file: Path,
) -> RegulatoryLoadResult:
    started = time.perf_counter()
    if sha256_file(raw_file) != manifest.sha256:
        raise ValueError("raw source does not match immutable release manifest")
    version = TRANSFORMATION_VERSIONS[source.dataset_key]
    release_key = manifest.source_release_date or manifest.sha256
    with psycopg.connect(database_url) as connection:
        prior = connection.execute(
            """
            SELECT sr.content_sha256, ir.id, ir.report
            FROM source_dataset sd
            JOIN source_release sr ON sr.source_dataset_id=sd.id
            LEFT JOIN ingest_run ir ON ir.source_release_id=sr.id
              AND ir.transformation_version=%s AND ir.status='succeeded'
            WHERE sd.dataset_key=%s AND sr.release_key=%s
            """,
            (version, source.dataset_key, release_key),
        ).fetchone()
    if prior:
        if prior[0] != manifest.sha256:
            raise ReleaseChecksumConflict(
                f"release {source.dataset_key}/{release_key} has a conflicting checksum"
            )
        if prior[1] is not None:
            report = prior[2]
            return RegulatoryLoadResult(
                source.dataset_key,
                release_key,
                manifest.sha256,
                report["rows_read"],
                report["rows_loaded"],
                report["unmatched_ccns"],
                str(prior[1]),
                True,
                round(time.perf_counter() - started, 3),
            )
    load_key = f"{source.dataset_key}:{manifest.sha256}"
    rows = _copy_transport_stage(database_url, normalized_file, load_key)
    with psycopg.connect(database_url) as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                release_id, _ = _verified_release(cursor, source, manifest)
                raw_object_id = _raw_object(cursor, release_id, manifest)
                cursor.execute(
                    "SELECT id, report FROM ingest_run WHERE source_release_id=%s "
                    "AND transformation_version=%s AND status='succeeded'",
                    (release_id, version),
                )
                prior = cursor.fetchone()
                if prior:
                    report = prior[1]
                    cursor.execute(
                        "DELETE FROM regulatory_load_stage WHERE load_key=%s", (load_key,)
                    )
                    return RegulatoryLoadResult(
                        source.dataset_key,
                        release_key,
                        manifest.sha256,
                        report["rows_read"],
                        report["rows_loaded"],
                        report["unmatched_ccns"],
                        str(prior[0]),
                        True,
                        round(time.perf_counter() - started, 3),
                    )
                cursor.execute(
                    "INSERT INTO ingest_run "
                    "(source_release_id, transformation_version, status, started_at) "
                    "VALUES (%s,%s,'running',now()) RETURNING id",
                    (release_id, version),
                )
                run_id = str(cursor.fetchone()[0])
                _prepare_transaction_stage(cursor, load_key)
                cursor.execute("SELECT count(*) FROM regulatory_stage WHERE provider_id IS NULL")
                unmatched = cursor.fetchone()[0]
                loaded = _insert_records(
                    cursor, source.dataset_key, release_id, raw_object_id, run_id, version
                )
                if loaded != rows - unmatched:
                    raise RuntimeError("regulatory load count mismatch")
                report = {"rows_read": rows, "rows_loaded": loaded, "unmatched_ccns": unmatched}
                cursor.execute(
                    "UPDATE ingest_run SET status='succeeded', completed_at=now(), rows_read=%s, "
                    "valid_rows=%s, rejected_rows=%s, report=%s WHERE id=%s",
                    (rows, loaded, unmatched, Jsonb(report), run_id),
                )
                cursor.execute("DELETE FROM regulatory_load_stage WHERE load_key=%s", (load_key,))
                return RegulatoryLoadResult(
                    source.dataset_key,
                    release_key,
                    manifest.sha256,
                    rows,
                    loaded,
                    unmatched,
                    run_id,
                    False,
                    round(time.perf_counter() - started, 3),
                )
