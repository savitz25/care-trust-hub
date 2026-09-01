"""CCN ↔ NPI from the same CMS SNF enrollment row. Organization NPI is not facility NPI."""

from __future__ import annotations

import json
import re
from typing import Any

import psycopg

from .ownership import normalize_cms_ccn

TRANSFORMATION_VERSION = "facility-npi-v1"
NPI_PATTERN = re.compile(r"^[0-9]{10}$")
RELATIONSHIP_TYPE = "medicare_enrollment_organization_npi"
PUBLIC_LANGUAGE = (
    "Medicare enrollment organization NPI associated with this CMS Certification Number (CCN). "
    "This is not a replacement for the facility CCN and is not assumed to be "
    "a facility-location NPI."
)


def classify_enrollment_npi(ccn: str | None, npi: str | None) -> str | None:
    normalized_ccn = normalize_cms_ccn(ccn or "")
    normalized_npi = (npi or "").strip()
    if not re.fullmatch(r"^[A-Z0-9]{6}$", normalized_ccn):
        return None
    if not NPI_PATTERN.fullmatch(normalized_npi):
        return None
    return "CONFIRMED"


def derive_facility_npi(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        connection.execute("SET statement_timeout = 0")
        with connection.transaction():
            release = connection.execute(
                """
                SELECT r.id, r.release_key
                FROM source_release r
                JOIN source_dataset d ON d.id = r.source_dataset_id
                JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
                WHERE d.dataset_key = 'skilled-nursing-facility-enrollments'
                ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
                LIMIT 1
                """
            ).fetchone()
            if release is None:
                raise RuntimeError("no successful SNF Enrollments release")
            release_id, release_key = release
            source_rows = connection.execute(
                """
                SELECT count(*) FROM provider_ownership_relationship
                WHERE relationship_role_text = 'Medicare-enrolled legal organization'
                  AND source_release_id = %s
                """,
                (release_id,),
            ).fetchone()[0]
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
                  %s,
                  'CONFIRMED',
                  nullif(btrim(coalesce(r.raw_record->>'ENROLLMENT ID', '')), ''),
                  nullif(btrim(coalesce(r.raw_record->>'ASSOCIATE ID', '')), ''),
                  CASE upper(btrim(coalesce(r.raw_record->>'MULTIPLE NPI FLAG', '')))
                    WHEN 'Y' THEN true
                    WHEN 'N' THEN false
                    ELSE NULL
                  END,
                  r.source_release_id,
                  r.source_record_locator,
                  %s
                FROM provider_ownership_relationship r
                WHERE r.relationship_role_text = 'Medicare-enrolled legal organization'
                  AND r.source_release_id = %s
                  AND btrim(coalesce(r.raw_record->>'NPI', '')) ~ '^[0-9]{10}$'
                  AND (
                    btrim(coalesce(r.raw_record->>'CCN', '')) ~ '^[0-9]{5}$'
                    OR upper(btrim(coalesce(r.raw_record->>'CCN', ''))) ~ '^[A-Z0-9]{6}$'
                  )
                ON CONFLICT (source_release_id, ccn, npi, enrollment_id) DO NOTHING
                """,
                (RELATIONSHIP_TYPE, TRANSFORMATION_VERSION, release_id),
            )
            stats = connection.execute(
                """
                SELECT
                  count(*)::bigint,
                  count(DISTINCT ccn)::bigint,
                  count(DISTINCT npi)::bigint
                FROM provider_npi_relationship
                WHERE source_release_id = %s AND confidence = 'CONFIRMED'
                """,
                (release_id,),
            ).fetchone()
            one = connection.execute(
                """
                SELECT count(*) FROM (
                  SELECT ccn FROM provider_npi_relationship
                  WHERE source_release_id = %s AND confidence = 'CONFIRMED'
                  GROUP BY ccn HAVING count(DISTINCT npi) = 1
                ) s
                """,
                (release_id,),
            ).fetchone()[0]
            multi = connection.execute(
                """
                SELECT count(*) FROM (
                  SELECT ccn FROM provider_npi_relationship
                  WHERE source_release_id = %s AND confidence = 'CONFIRMED'
                  GROUP BY ccn HAVING count(DISTINCT npi) > 1
                ) s
                """,
                (release_id,),
            ).fetchone()[0]
            unresolved = connection.execute(
                """
                SELECT count(*)
                FROM provider_identifier pi
                WHERE pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_from IS NULL
                  AND NOT EXISTS (
                    SELECT 1 FROM provider_npi_relationship n
                    WHERE n.ccn = pi.identifier_value AND n.confidence = 'CONFIRMED'
                      AND n.source_release_id = %s
                  )
                """,
                (release_id,),
            ).fetchone()[0]
    return {
        "enrollments_release": release_key,
        "source_enrollment_rows": int(source_rows),
        "relationships": int(stats[0]),
        "ccns_with_npi": int(stats[1]),
        "distinct_npis": int(stats[2]),
        "confirmed": int(stats[0]),
        "high_confidence": 0,
        "review_required": 0,
        "ccns_with_1_npi": int(one),
        "ccns_with_2plus_npi": int(multi),
        "unresolved_ccns_without_confirmed_npi": int(unresolved),
        "publication_language": PUBLIC_LANGUAGE,
        "organization_npi_promoted_to_facility_npi": False,
        "transformation_version": TRANSFORMATION_VERSION,
    }


def derive_facility_npi_json(database_url: str) -> str:
    return json.dumps(derive_facility_npi(database_url), indent=2, sort_keys=True) + "\n"
