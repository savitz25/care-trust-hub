"""First-class CMS Special Focus and abuse-icon observations from Provider Information."""

from __future__ import annotations

import json
from typing import Any

import psycopg

TRANSFORMATION_VERSION = "cms-facility-designation-v1"
PI_KEY = "nursing-home-provider-information"
SFF_FIELD = "Special Focus Status"
ABUSE_FIELD = "Abuse Icon"


def classify_special_focus(raw: str | None) -> tuple[str, str]:
    value = (raw or "").strip()
    if value == "SFF":
        return "SFF", value
    if value == "SFF Candidate":
        return "SFF_CANDIDATE", value
    if value == "":
        return "NOT_SFF", ""
    return "NOT_OBSERVED", value


def classify_abuse_icon(raw: str | None) -> tuple[str, str]:
    value = (raw or "").strip()
    if value == "Y":
        return "DESIGNATED", value
    if value == "N":
        return "NOT_DESIGNATED", value
    if value == "":
        return "NOT_OBSERVED", ""
    return "NOT_OBSERVED", value


def derive_cms_designations(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        connection.execute("SET statement_timeout = 0")
        with connection.transaction():
            current = connection.execute(
                """
                SELECT r.id, r.source_modified_at, r.retrieved_at, r.release_key
                FROM source_release r
                JOIN source_dataset d ON d.id = r.source_dataset_id
                JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
                WHERE d.dataset_key = %s
                ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
                LIMIT 1
                """,
                (PI_KEY,),
            ).fetchone()
            if current is None:
                raise RuntimeError("no successful Provider Information release")
            release_id, modified_at, retrieved_at, release_key = current
            observed_at = modified_at or retrieved_at
            connection.execute(
                "UPDATE cms_facility_designation SET is_current = false WHERE is_current"
            )
            connection.execute(
                """
                INSERT INTO cms_facility_designation (
                  provider_id, ccn, designation_kind, official_status, raw_official_value,
                  source_dataset_key, source_field, source_release_id, reporting_period,
                  observed_at, is_current, source_record_locator, transformation_version
                )
                SELECT
                  fs.provider_id,
                  pi.identifier_value,
                  'special_focus',
                  CASE btrim(coalesce(fs.raw_record->>'Special Focus Status', ''))
                    WHEN 'SFF' THEN 'SFF'
                    WHEN 'SFF Candidate' THEN 'SFF_CANDIDATE'
                    WHEN '' THEN 'NOT_SFF'
                    ELSE 'NOT_OBSERVED'
                  END,
                  coalesce(fs.raw_record->>'Special Focus Status', ''),
                  %s, 'Special Focus Status', fs.source_release_id, %s, %s, true,
                  fs.source_record_locator, %s
                FROM facility_snapshot fs
                JOIN provider_identifier pi
                  ON pi.provider_id = fs.provider_id
                 AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
                 AND pi.valid_from IS NULL
                WHERE fs.source_release_id = %s
                ON CONFLICT (source_release_id, ccn, designation_kind) DO UPDATE
                  SET official_status = EXCLUDED.official_status,
                      raw_official_value = EXCLUDED.raw_official_value,
                      is_current = true,
                      observed_at = EXCLUDED.observed_at
                """,
                (PI_KEY, release_key, observed_at, TRANSFORMATION_VERSION, release_id),
            )
            connection.execute(
                """
                INSERT INTO cms_facility_designation (
                  provider_id, ccn, designation_kind, official_status, raw_official_value,
                  source_dataset_key, source_field, source_release_id, reporting_period,
                  observed_at, is_current, source_record_locator, transformation_version
                )
                SELECT
                  fs.provider_id,
                  pi.identifier_value,
                  'abuse_icon',
                  CASE btrim(coalesce(fs.raw_record->>'Abuse Icon', ''))
                    WHEN 'Y' THEN 'DESIGNATED'
                    WHEN 'N' THEN 'NOT_DESIGNATED'
                    ELSE 'NOT_OBSERVED'
                  END,
                  coalesce(fs.raw_record->>'Abuse Icon', ''),
                  %s, 'Abuse Icon', fs.source_release_id, %s, %s, true,
                  fs.source_record_locator, %s
                FROM facility_snapshot fs
                JOIN provider_identifier pi
                  ON pi.provider_id = fs.provider_id
                 AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
                 AND pi.valid_from IS NULL
                WHERE fs.source_release_id = %s
                ON CONFLICT (source_release_id, ccn, designation_kind) DO UPDATE
                  SET official_status = EXCLUDED.official_status,
                      raw_official_value = EXCLUDED.raw_official_value,
                      is_current = true,
                      observed_at = EXCLUDED.observed_at
                """,
                (PI_KEY, release_key, observed_at, TRANSFORMATION_VERSION, release_id),
            )
            counts = connection.execute(
                """
                SELECT designation_kind, official_status, count(*)::bigint
                FROM cms_facility_designation
                WHERE is_current
                GROUP BY 1,2
                ORDER BY 1,2
                """
            ).fetchall()
            facilities = connection.execute(
                """
                SELECT count(*) FROM facility_snapshot WHERE source_release_id = %s
                """,
                (release_id,),
            ).fetchone()[0]
    status = {f"{kind}:{status}": int(n) for kind, status, n in counts}
    return {
        "pi_release": release_key,
        "facilities": int(facilities),
        "sff": status.get("special_focus:SFF", 0),
        "sff_candidate": status.get("special_focus:SFF_CANDIDATE", 0),
        "not_sff": status.get("special_focus:NOT_SFF", 0),
        "abuse_icon_designated": status.get("abuse_icon:DESIGNATED", 0),
        "abuse_icon_not_designated": status.get("abuse_icon:NOT_DESIGNATED", 0),
        "candidate_collapsed_into_sff": 0,
        "transformation_version": TRANSFORMATION_VERSION,
    }


def derive_cms_designations_json(database_url: str) -> str:
    return json.dumps(derive_cms_designations(database_url), indent=2, sort_keys=True) + "\n"
