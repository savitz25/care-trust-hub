"""Directory membership vs confirmed termination. Missing from current PI is not closure."""

from __future__ import annotations

import json
from typing import Any

import psycopg

TRANSFORMATION_VERSION = "directory-status-v1"
ABSENT_NOTE = (
    "This CCN is not in the latest CMS Nursing Home Provider Information extract. "
    "Absence from the current directory is not proof the facility is closed or terminated."
)
ACTIVE_NOTE = (
    "This CCN appears in the latest CMS Nursing Home Provider Information extract "
    "of currently listed nursing homes."
)


def interpret_missing_current_pi(*, in_latest_pi: bool, termination_source: str | None) -> str:
    if termination_source:
        return "TERMINATED_CONFIRMED"
    if in_latest_pi:
        return "CURRENT_ACTIVE"
    return "ABSENT_FROM_CURRENT_DIRECTORY"


def derive_directory_status(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        connection.execute("SET statement_timeout = 0")
        with connection.transaction():
            current = connection.execute(
                """
                SELECT r.id, r.release_key, coalesce(r.source_modified_at, r.retrieved_at)
                FROM source_release r
                JOIN source_dataset d ON d.id = r.source_dataset_id
                JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
                WHERE d.dataset_key = 'nursing-home-provider-information'
                ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
                LIMIT 1
                """
            ).fetchone()
            if current is None:
                raise RuntimeError("no successful Provider Information release")
            release_id, release_key, observed_at = current
            connection.execute(
                """
                INSERT INTO provider_directory_status (
                  provider_id, ccn, directory_status, pi_source_release_id, observed_at,
                  notes, transformation_version
                )
                SELECT pi.provider_id, pi.identifier_value,
                  CASE WHEN fs.provider_id IS NULL
                       THEN 'ABSENT_FROM_CURRENT_DIRECTORY'
                       ELSE 'CURRENT_ACTIVE' END,
                  %s, %s,
                  CASE WHEN fs.provider_id IS NULL THEN %s ELSE %s END,
                  %s
                FROM provider_identifier pi
                LEFT JOIN facility_snapshot fs
                  ON fs.provider_id = pi.provider_id AND fs.source_release_id = %s
                WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
                ON CONFLICT (ccn, pi_source_release_id) DO UPDATE
                  SET directory_status = EXCLUDED.directory_status,
                      notes = EXCLUDED.notes,
                      observed_at = EXCLUDED.observed_at
                """,
                (
                    release_id,
                    observed_at,
                    ABSENT_NOTE,
                    ACTIVE_NOTE,
                    TRANSFORMATION_VERSION,
                    release_id,
                ),
            )
            counts = connection.execute(
                """
                SELECT directory_status, count(*)::bigint
                FROM provider_directory_status
                WHERE pi_source_release_id = %s
                GROUP BY 1
                """,
                (release_id,),
            ).fetchall()
    return {
        "pi_release": release_key,
        "status_counts": {name: int(n) for name, n in counts},
        "terminated_confirmed": 0,
        "closure_inferred_from_missing_pi": False,
        "authoritative_termination_source": None,
        "transformation_version": TRANSFORMATION_VERSION,
    }


def derive_directory_status_json(database_url: str) -> str:
    return json.dumps(derive_directory_status(database_url), indent=2, sort_keys=True) + "\n"
