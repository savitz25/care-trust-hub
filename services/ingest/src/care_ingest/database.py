"""Transactional PostgreSQL loader for normalized Provider Information releases."""

from __future__ import annotations

import json
import time
from collections.abc import Iterator
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .manifest import ReleaseManifest, sha256_file
from .provider_information import CCN_PATTERN, TRANSFORMATION_VERSION
from .registry import SourceDefinition


class ReleaseChecksumConflict(RuntimeError):
    """Raised when a release key is reused with different source bytes."""


@dataclass(frozen=True, slots=True)
class LoadResult:
    dataset_key: str
    release_key: str
    checksum: str
    provider_count: int
    identifier_count: int
    snapshot_count: int
    states_represented: int
    ingest_run_id: str
    idempotent: bool
    phase_seconds: dict[str, float] | None = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def iter_normalized_records(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            if line.strip():
                try:
                    yield json.loads(line)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"invalid normalized JSON on line {line_number}: {error.msg}"
                    ) from error


def _verified_release(
    cursor: psycopg.Cursor[Any], source: SourceDefinition, manifest: ReleaseManifest
) -> tuple[str, bool]:
    cursor.execute(
        """
        INSERT INTO source_dataset
          (dataset_key, source_organization, display_name, official_url)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (dataset_key) DO NOTHING
        RETURNING id
        """,
        (
            source.dataset_key,
            source.source_organization,
            source.official_name,
            source.official_landing_page,
        ),
    )
    inserted = cursor.fetchone()
    if inserted:
        dataset_id = inserted[0]
    else:
        cursor.execute(
            """
            SELECT id, source_organization, official_url
            FROM source_dataset WHERE dataset_key = %s
            """,
            (source.dataset_key,),
        )
        existing_dataset = cursor.fetchone()
        if existing_dataset is None:
            raise RuntimeError("source dataset disappeared during load")
        dataset_id = existing_dataset[0]
        if existing_dataset[1] != source.source_organization:
            raise ValueError("existing source dataset organization conflicts with registry")
        if existing_dataset[2] != source.official_landing_page:
            raise ValueError("existing source dataset official URL conflicts with registry")

    release_key = manifest.source_release_date or manifest.sha256
    modified_value = manifest.source_modified_at or manifest.source_release_date
    source_modified_at = (
        datetime.fromisoformat(modified_value).replace(tzinfo=UTC) if modified_value else None
    )
    cursor.execute(
        """
        INSERT INTO source_release
          (source_dataset_id, release_key, retrieved_at, content_sha256,
           official_source_url, source_release_date, source_modified_at,
           source_published_at, source_period, source_version_identifier)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_dataset_id, release_key) DO NOTHING
        RETURNING id
        """,
        (
            dataset_id,
            release_key,
            manifest.retrieval_timestamp,
            manifest.sha256,
            manifest.official_source_url,
            manifest.source_release_date,
            source_modified_at,
            manifest.published_at,
            manifest.source_period,
            manifest.source_version_identifier,
        ),
    )
    inserted_release = cursor.fetchone()
    if inserted_release:
        return str(inserted_release[0]), True
    cursor.execute(
        """
        SELECT id, content_sha256, official_source_url, source_version_identifier
        FROM source_release
        WHERE source_dataset_id = %s AND release_key = %s
        FOR UPDATE
        """,
        (dataset_id, release_key),
    )
    existing = cursor.fetchone()
    if existing is None:
        raise RuntimeError("source release disappeared during load")
    if existing[1] != manifest.sha256:
        raise ReleaseChecksumConflict(
            f"release {source.dataset_key}/{release_key} already has checksum {existing[1]}; "
            f"received {manifest.sha256}"
        )
    if existing[2] != manifest.official_source_url:
        raise ValueError("existing release official source URL conflicts with manifest")
    if existing[3] != manifest.source_version_identifier:
        raise ValueError("existing release version identifier conflicts with manifest")
    return str(existing[0]), False


def _raw_object(cursor: psycopg.Cursor[Any], release_id: str, manifest: ReleaseManifest) -> str:
    release_key = manifest.source_release_date or manifest.sha256
    storage_key = f"cms/{manifest.dataset_key}/{release_key}/{manifest.original_filename}"
    cursor.execute(
        """
        INSERT INTO raw_object
          (source_release_id, storage_key, original_filename, byte_size,
           content_type, content_sha256)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_release_id, storage_key) DO NOTHING
        RETURNING id
        """,
        (
            release_id,
            storage_key,
            manifest.original_filename,
            manifest.byte_size,
            manifest.content_type,
            manifest.sha256,
        ),
    )
    inserted = cursor.fetchone()
    if inserted:
        return str(inserted[0])
    cursor.execute(
        """
        SELECT id, content_sha256, byte_size
        FROM raw_object WHERE source_release_id = %s AND storage_key = %s
        """,
        (release_id, storage_key),
    )
    existing = cursor.fetchone()
    if existing is None:
        raise RuntimeError("raw object disappeared during load")
    if existing[1] != manifest.sha256 or existing[2] != manifest.byte_size:
        raise ReleaseChecksumConflict("raw object metadata conflicts with immutable manifest")
    return str(existing[0])


def _validate_record_lineage(record: dict[str, Any], manifest: ReleaseManifest) -> str:
    identity = record["provider_identity"]
    if set(identity) != {"issuer", "type", "value"}:
        raise ValueError("normalized record identity has unexpected fields")
    if identity["issuer"] != "CMS" or identity["type"] != "CCN":
        raise ValueError("normalized record has an unsupported identity system")
    ccn = identity["value"]
    if not isinstance(ccn, str) or not CCN_PATTERN.fullmatch(ccn):
        raise ValueError("normalized record contains an invalid CMS CCN")
    release = record["source_release"]
    expected_release = {
        "dataset_key": manifest.dataset_key,
        "release_date": manifest.source_release_date,
        "sha256": manifest.sha256,
        "retrieved_at": manifest.retrieval_timestamp,
        "transformation_version": TRANSFORMATION_VERSION,
    }
    if release != expected_release:
        raise ValueError("normalized record release lineage conflicts with manifest")
    if record["raw"].get("CMS Certification Number (CCN)") != ccn:
        raise ValueError("normalized CCN conflicts with preserved raw record")
    locator = record["source_record_locator"]
    if not isinstance(locator, str) or not locator.endswith(f":ccn:{ccn}"):
        raise ValueError("source-record locator conflicts with CMS CCN")
    return ccn


def _copy_stage(
    cursor: psycopg.Cursor[Any], normalized_file: Path, manifest: ReleaseManifest
) -> int:
    cursor.execute(
        """
        CREATE TEMP TABLE provider_information_stage (
          ccn text PRIMARY KEY,
          source_record_locator text NOT NULL,
          normalized jsonb NOT NULL,
          raw_record jsonb NOT NULL,
          provider_id uuid
        ) ON COMMIT DROP
        """
    )
    rows = 0
    with cursor.copy(
        "COPY provider_information_stage (ccn, source_record_locator, normalized, raw_record) "
        "FROM STDIN"
    ) as copy:
        for record in iter_normalized_records(normalized_file):
            ccn = _validate_record_lineage(record, manifest)
            copy.write_row(
                (
                    ccn,
                    record["source_record_locator"],
                    Jsonb(record["normalized"]),
                    Jsonb(record["raw"]),
                )
            )
            rows += 1
    return rows


def _resolve_provider_identities(cursor: psycopg.Cursor[Any]) -> int:
    cursor.execute(
        """
        UPDATE provider_information_stage s
        SET provider_id = pi.provider_id
        FROM provider_identifier pi
        WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
          AND pi.identifier_value = s.ccn AND pi.valid_from IS NULL
        """
    )
    cursor.execute(
        "UPDATE provider_information_stage SET provider_id = gen_random_uuid() "
        "WHERE provider_id IS NULL"
    )
    providers_created = cursor.rowcount
    cursor.execute(
        """
        INSERT INTO provider (id, provider_type)
        SELECT provider_id, 'nursing_home'
        FROM provider_information_stage s
        WHERE NOT EXISTS (SELECT 1 FROM provider p WHERE p.id = s.provider_id)
        """
    )
    if cursor.rowcount != providers_created:
        raise RuntimeError("provider identity resolution count mismatch")
    cursor.execute(
        """
        INSERT INTO provider_identifier
          (provider_id, issuer, identifier_type, identifier_value)
        SELECT provider_id, 'CMS', 'CCN', ccn
        FROM provider_information_stage s
        WHERE NOT EXISTS (
          SELECT 1 FROM provider_identifier pi
          WHERE pi.issuer='CMS' AND pi.identifier_type='CCN'
            AND pi.identifier_value=s.ccn AND pi.valid_from IS NULL
        )
        """
    )
    if cursor.rowcount != providers_created:
        raise RuntimeError("provider identifier resolution count mismatch")
    return providers_created


def _insert_snapshots_set_based(
    cursor: psycopg.Cursor[Any],
    release_id: str,
    raw_object_id: str,
    ingest_run_id: str,
    manifest: ReleaseManifest,
) -> int:
    cursor.execute(
        """
        INSERT INTO facility_snapshot (
          provider_id, source_release_id, ingest_run_id, raw_object_id,
          observed_at, retrieved_at, attributes, transformation_version,
          source_record_locator, raw_record, provider_name, legal_business_name,
          address, city, state_code, zip_code, county_name, telephone,
          ownership_type, certified_beds, participation_type,
          participates_medicare, participates_medicaid, overall_rating,
          health_inspection_rating, staffing_rating, quality_measure_rating,
          source_latitude, source_longitude, location
        )
        SELECT
          s.provider_id, %s, %s, %s, NULL, %s, s.normalized, %s,
          s.source_record_locator, s.raw_record,
          s.normalized->>'provider_name', s.normalized->>'legal_business_name',
          s.normalized->>'address', s.normalized->>'city', s.normalized->>'state',
          s.normalized->>'zip_code', s.normalized->>'county', s.normalized->>'telephone',
          s.normalized->>'ownership_type', (s.normalized->>'certified_beds')::integer,
          s.normalized->>'participation_type',
          (s.normalized#>>'{participation,medicare}')::boolean,
          (s.normalized#>>'{participation,medicaid}')::boolean,
          (s.normalized#>>'{ratings,overall}')::smallint,
          (s.normalized#>>'{ratings,health_inspection}')::smallint,
          (s.normalized#>>'{ratings,staffing}')::smallint,
          (s.normalized#>>'{ratings,quality_measure}')::smallint,
          (s.normalized->>'latitude')::double precision,
          (s.normalized->>'longitude')::double precision,
          CASE WHEN s.normalized->>'latitude' IS NULL OR s.normalized->>'longitude' IS NULL
               THEN NULL
               ELSE ST_SetSRID(ST_MakePoint(
                 (s.normalized->>'longitude')::double precision,
                 (s.normalized->>'latitude')::double precision
               ), 4326)::geography END
        FROM provider_information_stage s
        ON CONFLICT (provider_id, source_release_id, transformation_version) DO NOTHING
        """,
        (
            release_id,
            ingest_run_id,
            raw_object_id,
            manifest.retrieval_timestamp,
            TRANSFORMATION_VERSION,
        ),
    )
    return cursor.rowcount


def load_provider_information(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    raw_file: Path,
    normalized_file: Path,
) -> LoadResult:
    """Load one validated release atomically, or return its prior successful load."""
    load_started = time.perf_counter()
    if sha256_file(raw_file) != manifest.sha256 or raw_file.stat().st_size != manifest.byte_size:
        raise ValueError("raw source does not match immutable release manifest")
    release_key = manifest.source_release_date or manifest.sha256
    with psycopg.connect(database_url) as connection:
        with connection.transaction():
            with connection.cursor() as cursor:
                release_id, _ = _verified_release(cursor, source, manifest)
                raw_object_id = _raw_object(cursor, release_id, manifest)
                cursor.execute(
                    """
                    SELECT id, report FROM ingest_run
                    WHERE source_release_id = %s AND transformation_version = %s
                      AND status = 'succeeded'
                    """,
                    (release_id, TRANSFORMATION_VERSION),
                )
                prior = cursor.fetchone()
                if prior:
                    report = prior[1]
                    return LoadResult(
                        dataset_key=source.dataset_key,
                        release_key=release_key,
                        checksum=manifest.sha256,
                        provider_count=report["provider_count"],
                        identifier_count=report["identifier_count"],
                        snapshot_count=report["snapshot_count"],
                        states_represented=report["states_represented"],
                        ingest_run_id=str(prior[0]),
                        idempotent=True,
                        phase_seconds={"total": round(time.perf_counter() - load_started, 3)},
                    )
                cursor.execute(
                    """
                    INSERT INTO ingest_run
                      (source_release_id, transformation_version, status, started_at)
                    VALUES (%s, %s, 'running', now()) RETURNING id
                    """,
                    (release_id, TRANSFORMATION_VERSION),
                )
                ingest_run_id = str(cursor.fetchone()[0])
                phase_started = time.perf_counter()
                rows_read = _copy_stage(cursor, normalized_file, manifest)
                copy_seconds = time.perf_counter() - phase_started
                phase_started = time.perf_counter()
                providers_created = _resolve_provider_identities(cursor)
                identity_seconds = time.perf_counter() - phase_started
                phase_started = time.perf_counter()
                snapshots_created = _insert_snapshots_set_based(
                    cursor, release_id, raw_object_id, ingest_run_id, manifest
                )
                snapshot_seconds = time.perf_counter() - phase_started
                if snapshots_created != rows_read:
                    raise RuntimeError("snapshot count did not match normalized input rows")
                cursor.execute(
                    "SELECT count(DISTINCT normalized->>'state') FROM provider_information_stage"
                )
                states_represented = cursor.fetchone()[0]
                phase_seconds = {
                    "copy": round(copy_seconds, 3),
                    "identity_resolution": round(identity_seconds, 3),
                    "snapshot_insert": round(snapshot_seconds, 3),
                    "transaction_total": round(time.perf_counter() - load_started, 3),
                }
                report = {
                    "provider_count": rows_read,
                    "providers_created": providers_created,
                    "identifier_count": rows_read,
                    "snapshot_count": snapshots_created,
                    "states_represented": states_represented,
                    "phase_seconds": phase_seconds,
                }
                cursor.execute(
                    """
                    UPDATE ingest_run SET status = 'succeeded', completed_at = now(),
                      rows_read = %s, valid_rows = %s, rejected_rows = 0, report = %s
                    WHERE id = %s
                    """,
                    (rows_read, rows_read, Jsonb(report), ingest_run_id),
                )
                return LoadResult(
                    dataset_key=source.dataset_key,
                    release_key=release_key,
                    checksum=manifest.sha256,
                    provider_count=rows_read,
                    identifier_count=rows_read,
                    snapshot_count=snapshots_created,
                    states_represented=states_represented,
                    ingest_run_id=ingest_run_id,
                    idempotent=False,
                    phase_seconds=phase_seconds,
                )
