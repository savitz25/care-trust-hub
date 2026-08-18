"""Load CA/NY/TX state regulatory evidence. Claims remain publication-ineligible."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .state_regulator import (
    ADAPTER_VERSION,
    RESOLVER_VERSION,
    CanonicalCmsFacility,
    match_against_cms_universe,
    observations_from_license_record,
)
from .state_regulator_adapters import OfficialStateAdapter, fetch_official_payload, parse_records


@dataclass(slots=True)
class StateIngestReport:
    state_code: str
    release_identifier: str
    raw_source_records: int
    eligible_nursing_home_records: int
    verified: int
    probable: int
    review_required: int
    unresolved: int
    rejected: int
    outside_cms_universe: int
    ambiguous: int
    claims: dict[str, int]
    observations: dict[str, int]
    cms_facilities: int
    unique_ccns: int
    google_claims: int
    idempotent: bool

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def load_cms_universe(
    connection: psycopg.Connection[Any], state_code: str
) -> list[CanonicalCmsFacility]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT ON (pi.identifier_value)
              pi.identifier_value, fs.provider_name, fs.address, fs.city,
              fs.state_code, fs.zip_code, fs.telephone
            FROM provider_identifier pi
            JOIN facility_snapshot fs ON fs.provider_id = pi.provider_id
            JOIN ingest_run ir ON ir.id = fs.ingest_run_id AND ir.status = 'succeeded'
            WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
              AND fs.state_code = %s
            ORDER BY pi.identifier_value, ir.completed_at DESC
            """,
            (state_code,),
        )
        return [
            CanonicalCmsFacility(
                cms_ccn=row[0],
                name=row[1] or "",
                address=row[2],
                city=row[3],
                state=row[4],
                zip_code=row[5],
                phone=row[6],
            )
            for row in cursor.fetchall()
        ]


def ingest_state_source(
    database_url: str,
    dataset_key: str,
    *,
    payload: bytes | None = None,
    timeout: float = 120,
) -> StateIngestReport:
    adapter = OfficialStateAdapter(dataset_key)
    source = adapter.source
    retrieved_at = datetime.now(tz=UTC)
    body = payload if payload is not None else fetch_official_payload(source, timeout=timeout)
    release_identifier = (
        f"{source.state_code.lower()}-{retrieved_at.date().isoformat()}-"
        f"{hashlib.sha256(body).hexdigest()[:12]}"
    )
    records = parse_records(source, body)
    fingerprint = hashlib.sha256(body).hexdigest()
    print(
        f"parsed {len(records)} {source.state_code} nursing-home records",
        flush=True,
    )

    with psycopg.connect(database_url) as connection:
        universe = load_cms_universe(connection, source.state_code)
        integrity = _integrity(connection)
        google_claims = _google_claim_count(connection)
        existing = _existing_release(connection, source.dataset_key, fingerprint)
        if existing:
            return existing

        run_id = _start_run(connection, source.dataset_key, fingerprint, len(records))
        providers = _provider_map(connection, source.state_code)
        counts = {
            "VERIFIED": 0,
            "PROBABLE": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": 0,
            "REJECTED": 0,
        }
        outside = 0
        ambiguous = 0
        observation_rows: list[tuple[Any, ...]] = []
        claim_rows: list[tuple[Any, ...]] = []
        identifier_rows: list[tuple[Any, ...]] = []
        observation_counts: dict[str, int] = {}
        claim_counts: dict[str, int] = {}
        resolver = f"system:{ADAPTER_VERSION}:{release_identifier}"
        for record in records:
            match = match_against_cms_universe(record, universe)
            counts[match.state] += 1
            if match.state == "UNRESOLVED" and record.cms_ccn:
                outside += 1
            if match.candidate_count > 1:
                ambiguous += 1
            cms_ccn = match.cms.cms_ccn if match.cms else None
            provider_id = providers.get(cms_ccn) if cms_ccn else None
            linked = bool(provider_id and match.state in {"VERIFIED", "PROBABLE"})
            observations = observations_from_license_record(
                record,
                source=source,
                retrieved_at=retrieved_at,
                release_identifier=release_identifier,
                adapter_version=ADAPTER_VERSION,
                cms_ccn=cms_ccn if linked else None,
            )
            first_fp = None
            for observation in observations:
                fingerprint_value = hashlib.sha256(
                    "|".join(
                        [
                            observation.source_type,
                            observation.source_record_identifier,
                            observation.observation_type,
                            observation.observed_value or "",
                            observation.release_identifier,
                        ]
                    ).encode()
                ).hexdigest()
                first_fp = first_fp or fingerprint_value
                observation_rows.append(
                    (
                        provider_id if linked else None,
                        cms_ccn if linked else None,
                        observation.source_type,
                        observation.source_authority.value,
                        observation.source_identifier,
                        observation.source_record_identifier,
                        observation.observation_type,
                        Jsonb(observation.observed_value),
                        observation.normalized_value,
                        observation.legal_entity_name,
                        observation.address,
                        observation.retrieved_at,
                        observation.source_reference,
                        observation.release_identifier,
                        Jsonb(observation.provenance or {}),
                        fingerprint_value,
                        observation.adapter_version,
                    )
                )
                observation_counts[observation.observation_type] = (
                    observation_counts.get(observation.observation_type, 0) + 1
                )
                if (
                    provider_id
                    and match.state in {"VERIFIED", "PROBABLE", "REVIEW_REQUIRED"}
                    and observation.observation_type not in {"STATE_PHONE", "STATE_ADDRESS"}
                ):
                    claim_rows.append(
                        (
                            provider_id,
                            observation.observation_type,
                            Jsonb(observation.observed_value or ""),
                            (observation.observed_value or "").casefold(),
                            match.state,
                            (
                                0.99
                                if match.state == "VERIFIED"
                                else 0.8
                                if match.state == "PROBABLE"
                                else 0.4
                            ),
                            match.reason,
                            Jsonb(
                                [{"feature": item, "outcome": "match"} for item in match.matched_on]
                            ),
                            resolver,
                            "decided" if match.state == "VERIFIED" else "open",
                        )
                    )
                    claim_counts[observation.observation_type] = (
                        claim_counts.get(observation.observation_type, 0) + 1
                    )
            if match.state == "VERIFIED" and provider_id and record.license_id and first_fp:
                identifier_rows.append(
                    (
                        provider_id,
                        f"STATE_{source.state_code}",
                        record.license_id,
                        record.license_id.casefold(),
                        first_fp,
                    )
                )
        with connection.cursor() as cursor:
            cursor.execute("SET LOCAL statement_timeout = '0'")
        _bulk_insert_observations(connection, observation_rows)
        _bulk_insert_identifiers(connection, identifier_rows)
        _bulk_insert_claims(connection, claim_rows)
        _finish_run(connection, run_id, counts)
        connection.commit()
        return StateIngestReport(
            state_code=source.state_code,
            release_identifier=release_identifier,
            raw_source_records=len(records),
            eligible_nursing_home_records=len(records),
            verified=counts["VERIFIED"],
            probable=counts["PROBABLE"],
            review_required=counts["REVIEW_REQUIRED"],
            unresolved=counts["UNRESOLVED"],
            rejected=counts["REJECTED"],
            outside_cms_universe=outside,
            ambiguous=ambiguous,
            claims=claim_counts,
            observations=observation_counts,
            cms_facilities=integrity[0],
            unique_ccns=integrity[1],
            google_claims=google_claims,
            idempotent=False,
        )


def _integrity(connection: psycopg.Connection[Any]) -> tuple[int, int]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT count(DISTINCT provider_id), count(DISTINCT identifier_value)
            FROM provider_identifier
            WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL
            """
        )
        row = cursor.fetchone()
        return int(row[0]), int(row[1])


def _google_claim_count(connection: psycopg.Connection[Any]) -> int:
    with connection.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM facility_claim WHERE claim_type LIKE 'google_%'")
        return int(cursor.fetchone()[0])


def _existing_release(
    connection: psycopg.Connection[Any], source_type: str, fingerprint: str
) -> StateIngestReport | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id FROM facility_intelligence_run
            WHERE source_type=%s AND release_fingerprint=%s AND status='succeeded'
            ORDER BY completed_at DESC LIMIT 1
            """,
            (source_type, fingerprint),
        )
        if not cursor.fetchone():
            return None
    integrity = _integrity(connection)
    return StateIngestReport(
        state_code=source_type.split("-")[0].upper(),
        release_identifier="existing",
        raw_source_records=0,
        eligible_nursing_home_records=0,
        verified=0,
        probable=0,
        review_required=0,
        unresolved=0,
        rejected=0,
        outside_cms_universe=0,
        ambiguous=0,
        claims={},
        observations={},
        cms_facilities=integrity[0],
        unique_ccns=integrity[1],
        google_claims=_google_claim_count(connection),
        idempotent=True,
    )


def _start_run(
    connection: psycopg.Connection[Any], source_type: str, fingerprint: str, count: int
) -> str:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO facility_intelligence_run
              (source_type, adapter_version, resolver_version, run_mode, status,
               requested_facility_count, requested_facility_fingerprint, release_fingerprint,
               started_at)
            VALUES (%s,%s,%s,'bounded_backfill','running',%s,%s,%s,now())
            RETURNING id
            """,
            (
                source_type,
                ADAPTER_VERSION,
                RESOLVER_VERSION,
                count,
                fingerprint,
                fingerprint,
            ),
        )
        return str(cursor.fetchone()[0])


def _finish_run(connection: psycopg.Connection[Any], run_id: str, counts: dict[str, int]) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            UPDATE facility_intelligence_run
            SET status='succeeded', completed_at=now(),
                successes=%s, unresolved=%s, review_required=%s
            WHERE id=%s
            """,
            (
                counts["VERIFIED"] + counts["PROBABLE"],
                counts["UNRESOLVED"],
                counts["REVIEW_REQUIRED"],
                run_id,
            ),
        )


def _provider_map(connection: psycopg.Connection[Any], state_code: str) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT ON (pi.identifier_value) pi.identifier_value, pi.provider_id
            FROM provider_identifier pi
            JOIN facility_snapshot fs ON fs.provider_id = pi.provider_id
            WHERE pi.issuer='CMS' AND pi.identifier_type='CCN' AND pi.valid_to IS NULL
              AND fs.state_code=%s
            ORDER BY pi.identifier_value
            """,
            (state_code,),
        )
        return {str(row[0]): str(row[1]) for row in cursor.fetchall()}


def _bulk_insert_observations(
    connection: psycopg.Connection[Any], rows: list[tuple[Any, ...]]
) -> None:
    if not rows:
        return
    sql = """
            INSERT INTO facility_source_observation (
              provider_id, canonical_ccn, source_type, source_authority, source_identifier,
              source_record_identifier, observation_type, observed_value, normalized_value,
              observed_name, observed_address, retrieved_at, source_url,
              release_identifier, provenance, evidence_fingerprint, adapter_version
            ) VALUES (
              %s,%s,%s,%s::facility_source_authority,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            ON CONFLICT DO NOTHING
            """
    with connection.cursor() as cursor:
        for start in range(0, len(rows), 200):
            cursor.executemany(sql, rows[start : start + 200])
            print(f"observations {min(start + 200, len(rows))}/{len(rows)}", flush=True)


def _bulk_insert_identifiers(
    connection: psycopg.Connection[Any], rows: list[tuple[Any, ...]]
) -> None:
    if not rows:
        return
    with connection.cursor() as cursor:
        cursor.executemany(
            """
            INSERT INTO facility_external_identifier (
              provider_id, namespace, identifier_type, identifier_value, normalized_value,
              source_observation_id, verification_state, verified_at
            )
            SELECT %s,%s,'LICENSE_ID',%s,%s,o.id,'VERIFIED',now()
            FROM facility_source_observation o
            WHERE o.evidence_fingerprint=%s
            ON CONFLICT DO NOTHING
            """,
            rows,
        )


def _bulk_insert_claims(connection: psycopg.Connection[Any], rows: list[tuple[Any, ...]]) -> None:
    if not rows:
        return
    payload = [
        (
            row[0],
            row[1],
            row[2],
            row[3],
            row[4],
            row[5],
            row[6],
            row[7],
            RESOLVER_VERSION,
            row[8],
            row[9],
        )
        for row in rows
    ]
    sql = """
            INSERT INTO facility_claim (
              provider_id, claim_type, claim_value, normalized_value, resolution_state,
              confidence, resolution_method, resolution_reason, matching_features,
              threshold_version, resolved_at, resolver_reference, review_state,
              publication_eligible
            ) VALUES (
              %s,%s,%s,%s,%s::facility_resolution_state,%s,'state_cms_bridge',%s,%s,
              %s,now(),%s,%s::facility_review_status,false
            )
            """
    with connection.cursor() as cursor:
        for start in range(0, len(payload), 200):
            cursor.executemany(sql, payload[start : start + 200])
            print(f"claims {min(start + 200, len(payload))}/{len(payload)}", flush=True)


def _provider_id(connection: psycopg.Connection[Any], ccn: str | None) -> str | None:
    if not ccn:
        return None
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT provider_id FROM provider_identifier
            WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL
              AND identifier_value=%s
            LIMIT 1
            """,
            (ccn,),
        )
        row = cursor.fetchone()
        return str(row[0]) if row else None


def _insert_observation(
    connection: psycopg.Connection[Any],
    observation,
    provider_id: str | None,
) -> str | None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO facility_source_observation (
              provider_id, canonical_ccn, source_type, source_authority, source_identifier,
              source_record_identifier, observation_type, observed_value, normalized_value,
              observed_name, observed_address, observed_phone, retrieved_at, source_url,
              release_identifier, provenance, evidence_fingerprint, adapter_version
            ) VALUES (
              %s,%s,%s,%s::facility_source_authority,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
            )
            ON CONFLICT DO NOTHING
            RETURNING id
            """,
            (
                provider_id,
                observation.canonical_ccn if provider_id else None,
                observation.source_type,
                observation.source_authority.value,
                observation.source_identifier,
                observation.source_record_identifier,
                observation.observation_type,
                Jsonb(observation.observed_value),
                observation.normalized_value,
                observation.legal_entity_name,
                observation.address,
                None,
                observation.retrieved_at,
                observation.source_reference,
                observation.release_identifier,
                Jsonb(observation.provenance or {}),
                hashlib.sha256(
                    "|".join(
                        [
                            observation.source_type,
                            observation.source_record_identifier,
                            observation.observation_type,
                            observation.observed_value or "",
                            observation.release_identifier,
                        ]
                    ).encode()
                ).hexdigest(),
                observation.adapter_version,
            ),
        )
        row = cursor.fetchone()
        return str(row[0]) if row else None


def _insert_identifier(
    connection: psycopg.Connection[Any],
    provider_id: str,
    state_code: str,
    license_id: str,
    observation_id: str,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO facility_external_identifier (
              provider_id, namespace, identifier_type, identifier_value, normalized_value,
              source_observation_id, verification_state, verified_at
            ) VALUES (%s,%s,'LICENSE_ID',%s,%s,%s,'VERIFIED',now())
            ON CONFLICT DO NOTHING
            """,
            (
                provider_id,
                f"STATE_{state_code}",
                license_id,
                license_id.casefold(),
                observation_id,
            ),
        )


def _insert_claim(
    connection: psycopg.Connection[Any],
    provider_id: str,
    claim_type: str,
    value: str,
    state: str,
    reason: str,
    matched_on: tuple[str, ...],
    release_identifier: str,
) -> bool:
    resolver = f"system:{ADAPTER_VERSION}:{release_identifier}"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT 1 FROM facility_claim
            WHERE provider_id=%s AND claim_type=%s AND resolver_reference=%s
            LIMIT 1
            """,
            (provider_id, claim_type, resolver),
        )
        if cursor.fetchone():
            return False
        cursor.execute(
            """
            INSERT INTO facility_claim (
              provider_id, claim_type, claim_value, normalized_value, resolution_state,
              confidence, resolution_method, resolution_reason, matching_features,
              threshold_version, resolved_at, resolver_reference, review_state,
              publication_eligible
            ) VALUES (
                %s,%s,%s,%s,%s::facility_resolution_state,%s,'state_cms_bridge',%s,%s,%s,now(),%s,
              CASE WHEN %s='VERIFIED' THEN 'decided'::facility_review_status
                   ELSE 'open'::facility_review_status END, false
            )
            """,
            (
                provider_id,
                claim_type,
                Jsonb(value),
                value.casefold(),
                state,
                0.99 if state == "VERIFIED" else 0.8 if state == "PROBABLE" else 0.4,
                reason,
                Jsonb([{"feature": item, "outcome": "match"} for item in matched_on]),
                RESOLVER_VERSION,
                resolver,
                state,
            ),
        )
        return True
