"""Transactional COPY loaders for Home Health and Hospice national evidence."""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .database import _raw_object, _verified_release, iter_normalized_records
from .manifest import ReleaseManifest, sha256_file
from .post_acute import POST_ACUTE_KEYS, TRANSFORMATION_VERSION
from .registry import SourceDefinition

IDENTIFIER_TYPES = {
    "home_health": "HOME_HEALTH_CCN",
    "hospice": "HOSPICE_CCN",
}


@dataclass(frozen=True, slots=True)
class PostAcuteLoadResult:
    dataset_key: str
    release_key: str
    checksum: str
    providers_created: int
    snapshots_loaded: int
    quality_loaded: int
    services_loaded: int
    zips_loaded: int
    ingest_run_id: str
    idempotent: bool
    duration_seconds: float

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def load_post_acute_source(
    database_url: str,
    source: SourceDefinition,
    manifest: ReleaseManifest,
    raw_file: Path,
    normalized_file: Path,
) -> PostAcuteLoadResult:
    started = time.perf_counter()
    if source.dataset_key not in POST_ACUTE_KEYS:
        raise ValueError(f"unsupported post-acute dataset: {source.dataset_key}")
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
                    return PostAcuteLoadResult(
                        source.dataset_key,
                        release_key,
                        manifest.sha256,
                        report.get("providers_created", 0),
                        report.get("snapshots_loaded", 0),
                        report.get("quality_loaded", 0),
                        report.get("services_loaded", 0),
                        report.get("zips_loaded", 0),
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
                    """
                    INSERT INTO ingest_run
                      (source_release_id, transformation_version, status, started_at)
                    VALUES (%s,%s,'running',now()) RETURNING id
                    """,
                    (release_id, TRANSFORMATION_VERSION),
                )
                run_id = str(cursor.fetchone()[0])
                cursor.execute(
                    """
                    CREATE TEMP TABLE post_acute_stage (
                      record_kind text NOT NULL,
                      provider_type text NOT NULL,
                      cms_ccn text NOT NULL,
                      payload jsonb NOT NULL
                    ) ON COMMIT DROP
                    """
                )
                rows_read = 0
                copy_sql = (
                    "COPY post_acute_stage "
                    "(record_kind, provider_type, cms_ccn, payload) FROM STDIN"
                )
                with cursor.copy(copy_sql) as copy:
                    for record in iter_normalized_records(normalized_file):
                        rows_read += 1
                        copy.write_row(
                            (
                                record["record_kind"],
                                record.get("provider_type")
                                or (
                                    "home_health"
                                    if source.dataset_key.startswith("home-health")
                                    else "hospice"
                                ),
                                record["cms_ccn"],
                                json.dumps(record, default=str),
                            )
                        )
                cursor.execute(
                    "CREATE INDEX post_acute_stage_kind_idx "
                    "ON post_acute_stage (record_kind, provider_type, cms_ccn)"
                )
                cursor.execute("ANALYZE post_acute_stage")
                cursor.execute(
                    """
                    CREATE TEMP TABLE post_acute_new_id ON COMMIT DROP AS
                    SELECT DISTINCT ON (s.cms_ccn, s.provider_type)
                      s.cms_ccn,
                      s.provider_type,
                      CASE s.provider_type
                        WHEN 'home_health' THEN 'HOME_HEALTH_CCN'
                        ELSE 'HOSPICE_CCN'
                      END AS identifier_type,
                      gen_random_uuid() AS provider_id
                    FROM post_acute_stage s
                    WHERE NOT EXISTS (
                      SELECT 1 FROM provider_identifier pi
                      WHERE pi.issuer='CMS'
                        AND pi.identifier_type = CASE s.provider_type
                          WHEN 'home_health' THEN 'HOME_HEALTH_CCN'
                          ELSE 'HOSPICE_CCN'
                        END
                        AND pi.identifier_value = s.cms_ccn
                        AND pi.valid_from IS NULL
                    )
                    """
                )
                cursor.execute(
                    "INSERT INTO provider (id, provider_type) "
                    "SELECT provider_id, provider_type FROM post_acute_new_id"
                )
                providers_created = cursor.rowcount
                cursor.execute(
                    """
                    INSERT INTO provider_identifier
                      (provider_id, issuer, identifier_type, identifier_value)
                    SELECT provider_id, 'CMS', identifier_type, cms_ccn
                    FROM post_acute_new_id
                    """
                )
                cursor.execute(
                    """
                    INSERT INTO home_health_snapshot (
                      provider_id, cms_ccn, source_release_id, raw_object_id, ingest_run_id,
                      provider_name, address, city, state_code, zip_code, telephone,
                      ownership_type, certification_date, quality_of_patient_care_star,
                      quality_of_patient_care_star_footnote, source_record_locator,
                      raw_record, transformation_version
                    )
                    SELECT pi.provider_id, s.cms_ccn, %s, %s, %s,
                      s.payload->>'provider_name', s.payload->>'address', s.payload->>'city',
                      s.payload->>'state_code', s.payload->>'zip_code', s.payload->>'telephone',
                      s.payload->>'ownership_type',
                      NULLIF(s.payload->>'certification_date','')::date,
                      NULLIF(s.payload->>'quality_of_patient_care_star','')::smallint,
                      s.payload->>'quality_of_patient_care_star_footnote',
                      s.payload->>'source_record_locator',
                      coalesce(s.payload->'raw_record', '{}'::jsonb), %s
                    FROM (
                      SELECT * FROM post_acute_stage
                      WHERE record_kind='snapshot' AND provider_type='home_health'
                    ) s
                    JOIN provider_identifier pi
                      ON pi.issuer='CMS' AND pi.identifier_type='HOME_HEALTH_CCN'
                     AND pi.identifier_value=s.cms_ccn AND pi.valid_from IS NULL
                    ON CONFLICT (source_release_id, cms_ccn) DO NOTHING
                    """,
                    (release_id, raw_object_id, run_id, TRANSFORMATION_VERSION),
                )
                snapshots = cursor.rowcount
                cursor.execute(
                    """
                    INSERT INTO hospice_snapshot (
                      provider_id, cms_ccn, source_release_id, raw_object_id, ingest_run_id,
                      provider_name, address_line_1, address_line_2, city, state_code,
                      zip_code, county_name, telephone, cms_region, ownership_type,
                      certification_date, source_record_locator, raw_record,
                      transformation_version
                    )
                    SELECT pi.provider_id, s.cms_ccn, %s, %s, %s,
                      s.payload->>'provider_name', s.payload->>'address_line_1',
                      s.payload->>'address_line_2', s.payload->>'city',
                      s.payload->>'state_code', s.payload->>'zip_code',
                      s.payload->>'county_name', s.payload->>'telephone',
                      s.payload->>'cms_region', s.payload->>'ownership_type',
                      NULLIF(s.payload->>'certification_date','')::date,
                      s.payload->>'source_record_locator',
                      coalesce(s.payload->'raw_record', '{}'::jsonb), %s
                    FROM (
                      SELECT * FROM post_acute_stage
                      WHERE record_kind='snapshot' AND provider_type='hospice'
                    ) s
                    JOIN provider_identifier pi
                      ON pi.issuer='CMS' AND pi.identifier_type='HOSPICE_CCN'
                     AND pi.identifier_value=s.cms_ccn AND pi.valid_from IS NULL
                    ON CONFLICT (source_release_id, cms_ccn) DO NOTHING
                    """,
                    (release_id, raw_object_id, run_id, TRANSFORMATION_VERSION),
                )
                snapshots += cursor.rowcount
                cursor.execute(
                    """
                    INSERT INTO cms_agency_quality_observation (
                      provider_id, cms_ccn, provider_type, measure_family, measure_code,
                      official_name, reporting_period, score, score_text, star_rating,
                      availability, footnote, source_release_id, raw_object_id,
                      ingest_run_id, source_record_locator, raw_record,
                      transformation_version
                    )
                    SELECT pi.provider_id, s.cms_ccn, s.provider_type,
                      s.payload->>'measure_family', s.payload->>'measure_code',
                      s.payload->>'official_name', NULLIF(s.payload->>'reporting_period',''),
                      NULLIF(s.payload->>'score','')::numeric,
                      s.payload->>'score_text',
                      NULLIF(s.payload->>'star_rating','')::smallint,
                      s.payload->>'availability', s.payload->>'footnote',
                      %s, %s, %s, s.payload->>'source_record_locator',
                      coalesce(s.payload->'raw_record', '{}'::jsonb), %s
                    FROM (
                      SELECT * FROM post_acute_stage WHERE record_kind='quality'
                    ) s
                    JOIN provider_identifier pi
                      ON pi.issuer='CMS'
                     AND pi.identifier_type = CASE s.provider_type
                       WHEN 'home_health' THEN 'HOME_HEALTH_CCN' ELSE 'HOSPICE_CCN' END
                     AND pi.identifier_value=s.cms_ccn AND pi.valid_from IS NULL
                    ON CONFLICT DO NOTHING
                    """,
                    (release_id, raw_object_id, run_id, TRANSFORMATION_VERSION),
                )
                quality = cursor.rowcount
                cursor.execute(
                    """
                    INSERT INTO cms_agency_service_offering (
                      provider_id, cms_ccn, provider_type, service_code, official_field,
                      offered, raw_value, source_release_id, source_record_locator,
                      transformation_version
                    )
                    SELECT pi.provider_id, s.cms_ccn, s.provider_type,
                      s.payload->>'service_code', s.payload->>'official_field',
                      CASE s.payload->>'offered'
                        WHEN 'true' THEN true WHEN 'false' THEN false ELSE null END,
                      s.payload->>'raw_value', %s, s.payload->>'source_record_locator', %s
                    FROM (
                      SELECT * FROM post_acute_stage WHERE record_kind='service'
                    ) s
                    JOIN provider_identifier pi
                      ON pi.issuer='CMS'
                     AND pi.identifier_type = CASE s.provider_type
                       WHEN 'home_health' THEN 'HOME_HEALTH_CCN' ELSE 'HOSPICE_CCN' END
                     AND pi.identifier_value=s.cms_ccn AND pi.valid_from IS NULL
                    ON CONFLICT (source_release_id, cms_ccn, service_code) DO NOTHING
                    """,
                    (release_id, TRANSFORMATION_VERSION),
                )
                services = cursor.rowcount
                cursor.execute(
                    """
                    INSERT INTO cms_agency_service_zip (
                      provider_id, cms_ccn, provider_type, state_code, zip_code,
                      source_release_id, source_record_locator, transformation_version
                    )
                    SELECT pi.provider_id, s.cms_ccn, s.provider_type,
                      NULLIF(s.payload->>'state_code',''), s.payload->>'zip_code',
                      %s, s.payload->>'source_record_locator', %s
                    FROM (
                      SELECT * FROM post_acute_stage WHERE record_kind='zip'
                    ) s
                    JOIN provider_identifier pi
                      ON pi.issuer='CMS'
                     AND pi.identifier_type = CASE s.provider_type
                       WHEN 'home_health' THEN 'HOME_HEALTH_CCN' ELSE 'HOSPICE_CCN' END
                     AND pi.identifier_value=s.cms_ccn AND pi.valid_from IS NULL
                    ON CONFLICT (source_release_id, cms_ccn, zip_code) DO NOTHING
                    """,
                    (release_id, TRANSFORMATION_VERSION),
                )
                zips = cursor.rowcount
                report = {
                    "providers_created": providers_created,
                    "snapshots_loaded": snapshots,
                    "quality_loaded": quality,
                    "services_loaded": services,
                    "zips_loaded": zips,
                    "rows_read": rows_read,
                }
                cursor.execute(
                    """
                    UPDATE ingest_run SET status='succeeded', completed_at=now(),
                      rows_read=%s, valid_rows=%s, rejected_rows=0, report=%s
                    WHERE id=%s
                    """,
                    (rows_read, rows_read, Jsonb(report), run_id),
                )
                return PostAcuteLoadResult(
                    source.dataset_key,
                    release_key,
                    manifest.sha256,
                    providers_created,
                    snapshots,
                    quality,
                    services,
                    zips,
                    run_id,
                    False,
                    round(time.perf_counter() - started, 3),
                )


def derive_agency_npi(database_url: str, dataset_key: str) -> dict[str, Any]:
    identifier_type = {
        "home-health-agency-enrollments": "HOME_HEALTH_CCN",
        "hospice-enrollments": "HOSPICE_CCN",
    }[dataset_key]
    with psycopg.connect(database_url) as connection:
        connection.execute("SET statement_timeout = 0")
        with connection.transaction():
            release = connection.execute(
                """
                SELECT r.id, r.release_key
                FROM source_release r
                JOIN source_dataset d ON d.id = r.source_dataset_id
                JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
                WHERE d.dataset_key = %s
                ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
                LIMIT 1
                """,
                (dataset_key,),
            ).fetchone()
            if release is None:
                raise RuntimeError(f"no successful {dataset_key} release")
            release_id, release_key = release
            connection.execute(
                """
                INSERT INTO provider_npi_relationship (
                  provider_id, ccn, npi, relationship_type, confidence, enrollment_id,
                  organization_pac_id, multiple_npi_flag, source_release_id,
                  source_record_locator, transformation_version
                )
                SELECT
                  r.provider_id,
                  CASE
                    WHEN btrim(coalesce(r.raw_record->>'CCN', '')) ~ '^[0-9]{5}$'
                      THEN lpad(btrim(r.raw_record->>'CCN'), 6, '0')
                    ELSE upper(btrim(coalesce(r.raw_record->>'CCN', '')))
                  END,
                  btrim(r.raw_record->>'NPI'),
                  'medicare_enrollment_organization_npi',
                  'CONFIRMED',
                  nullif(btrim(coalesce(r.raw_record->>'ENROLLMENT ID', '')), ''),
                  nullif(btrim(coalesce(r.raw_record->>'ASSOCIATE ID', '')), ''),
                  CASE upper(btrim(coalesce(r.raw_record->>'MULTIPLE NPI FLAG', '')))
                    WHEN 'Y' THEN true
                    WHEN 'N' THEN false
                    ELSE null
                  END,
                  r.source_release_id,
                  r.source_record_locator,
                  'agency-npi-v1'
                FROM provider_ownership_relationship r
                WHERE r.source_release_id = %s
                  AND r.relationship_role_text = 'Medicare-enrolled legal organization'
                  AND btrim(coalesce(r.raw_record->>'NPI', '')) ~ '^[0-9]{10}$'
                  AND (
                    btrim(coalesce(r.raw_record->>'CCN', '')) ~ '^[0-9]{5}$'
                    OR upper(btrim(coalesce(r.raw_record->>'CCN', ''))) ~ '^[A-Z0-9]{6}$'
                  )
                ON CONFLICT DO NOTHING
                """,
                (release_id,),
            )
            confirmed = connection.execute(
                """
                SELECT count(*) FROM provider_npi_relationship
                WHERE source_release_id = %s AND confidence = 'CONFIRMED'
                """,
                (release_id,),
            ).fetchone()[0]
    return {
        "dataset_key": dataset_key,
        "release": release_key,
        "confirmed": int(confirmed),
        "identifier_type": identifier_type,
        "join_strategy": "same_enrollment_row",
    }
