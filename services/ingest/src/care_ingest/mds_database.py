"""Transactional loader for MDS quality-measure observations."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from .database import _raw_object, _verified_release, iter_normalized_records
from .manifest import ReleaseManifest, sha256_file
from .mds import MDS_KEY, TRANSFORMATION_VERSION
from .registry import SourceDefinition


@dataclass(frozen=True, slots=True)
class MdsLoadResult:
    dataset_key: str
    release_key: str
    checksum: str
    source_rows: int
    observations_loaded: int
    unmatched_ccns: int
    distinct_measures: int
    ingest_run_id: str
    idempotent: bool
    duration_seconds: float

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def load_mds_source(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    raw_file: Path,
    normalized_file: Path,
) -> MdsLoadResult:
    started = time.perf_counter()
    if source.dataset_key != MDS_KEY:
        raise ValueError("MDS loader requires nursing-home-mds-quality-measures")
    if sha256_file(raw_file) != manifest.sha256:
        raise ValueError("raw source does not match immutable release manifest")
    release_key = manifest.source_release_date or manifest.sha256
    with psycopg.connect(database_url) as connection:
        connection.execute("SET statement_timeout = 0")
        with connection.transaction():
            with connection.cursor() as cursor:
                release_id, _ = _verified_release(cursor, source, manifest)
                raw_object_id = _raw_object(cursor, release_id, manifest)
                cursor.execute(
                    "SELECT id, report FROM ingest_run WHERE source_release_id=%s "
                    "AND transformation_version=%s AND status='succeeded'",
                    (release_id, TRANSFORMATION_VERSION),
                )
                prior = cursor.fetchone()
                if prior:
                    report = prior[1]
                    return MdsLoadResult(
                        MDS_KEY,
                        release_key,
                        manifest.sha256,
                        report["source_rows"],
                        report["observations_loaded"],
                        report["unmatched_ccns"],
                        report["distinct_measures"],
                        str(prior[0]),
                        True,
                        round(time.perf_counter() - started, 3),
                    )
                cursor.execute(
                    "UPDATE ingest_run SET status='failed', completed_at=now() "
                    "WHERE source_release_id=%s AND transformation_version=%s "
                    "AND status='running'",
                    (release_id, TRANSFORMATION_VERSION),
                )
                cursor.execute(
                    "INSERT INTO ingest_run "
                    "(source_release_id, transformation_version, status, started_at) "
                    "VALUES (%s,%s,'running',now()) RETURNING id",
                    (release_id, TRANSFORMATION_VERSION),
                )
                run_id = str(cursor.fetchone()[0])
                cursor.execute(
                    """
                    CREATE TEMP TABLE mds_stage (
                      payload jsonb NOT NULL
                    ) ON COMMIT DROP
                    """
                )
                source_rows = 0
                with cursor.copy("COPY mds_stage (payload) FROM STDIN") as copy:
                    for record in iter_normalized_records(normalized_file):
                        source_rows += 1
                        copy.write_row((Jsonb(record),))
                cursor.execute(
                    """
                    INSERT INTO quality_measure_definition (
                      measure_code, official_name, stay_type, used_in_five_star_rating,
                      source_dataset_key
                    )
                    SELECT DISTINCT
                      payload->>'measure_code',
                      payload->>'official_name',
                      payload->>'stay_type',
                      (payload->>'used_in_five_star_rating')::boolean,
                      %s
                    FROM mds_stage
                    ON CONFLICT (measure_code) DO UPDATE
                      SET official_name = EXCLUDED.official_name,
                          stay_type = EXCLUDED.stay_type,
                          used_in_five_star_rating = EXCLUDED.used_in_five_star_rating
                    """,
                    (MDS_KEY,),
                )
                cursor.execute(
                    """
                    INSERT INTO facility_quality_measure_observation (
                      provider_id, ccn, measure_code, period_component, measure_period,
                      score, score_text, suppressed, footnote, used_in_five_star_rating,
                      source_release_id, raw_object_id, ingest_run_id,
                      source_record_locator, raw_record, transformation_version
                    )
                    SELECT
                      pi.provider_id,
                      item->>'ccn',
                      item->>'measure_code',
                      item->>'period_component',
                      item->>'measure_period',
                      nullif(item->>'score','')::numeric,
                      item->>'score_text',
                      coalesce((item->>'suppressed')::boolean, false),
                      item->>'footnote',
                      (item->>'used_in_five_star_rating')::boolean,
                      %s, %s, %s,
                      item->>'source_record_locator',
                      payload->'raw',
                      %s
                    FROM mds_stage
                    CROSS JOIN LATERAL jsonb_array_elements(payload->'observations') AS item
                    LEFT JOIN provider_identifier pi
                      ON pi.issuer='CMS' AND pi.identifier_type='CCN'
                     AND pi.identifier_value = item->>'ccn' AND pi.valid_from IS NULL
                    ON CONFLICT (source_release_id, ccn, measure_code, period_component)
                    DO NOTHING
                    """,
                    (release_id, raw_object_id, run_id, TRANSFORMATION_VERSION),
                )
                loaded = cursor.rowcount
                cursor.execute(
                    """
                    SELECT count(DISTINCT payload->>'ccn')
                    FROM mds_stage s
                    WHERE NOT EXISTS (
                      SELECT 1 FROM provider_identifier pi
                      WHERE pi.issuer='CMS' AND pi.identifier_type='CCN'
                        AND pi.identifier_value = s.payload->>'ccn'
                        AND pi.valid_from IS NULL
                    )
                    """
                )
                unmatched = cursor.fetchone()[0]
                cursor.execute(
                    "SELECT count(DISTINCT measure_code) FROM quality_measure_definition"
                )
                measures = cursor.fetchone()[0]
                report = {
                    "source_rows": source_rows,
                    "observations_loaded": loaded,
                    "unmatched_ccns": unmatched,
                    "distinct_measures": measures,
                }
                cursor.execute(
                    "UPDATE ingest_run SET status='succeeded', completed_at=now(), rows_read=%s, "
                    "valid_rows=%s, rejected_rows=%s, report=%s WHERE id=%s",
                    (source_rows, source_rows, 0, Jsonb(report), run_id),
                )
                return MdsLoadResult(
                    MDS_KEY,
                    release_key,
                    manifest.sha256,
                    source_rows,
                    loaded,
                    unmatched,
                    measures,
                    run_id,
                    False,
                    round(time.perf_counter() - started, 3),
                )
