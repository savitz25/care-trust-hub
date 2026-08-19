"""Idempotent persistence for assisted-living pilot providers."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

from .assisted_living_pilot import ADAPTER_VERSION, attach_publication

ROLE_FIELDS = (
    ("licensee", "licensee"),
    ("operator", "operator"),
    ("management_company", "management_company"),
    ("administrator", "administrator"),
    ("owner", "owner"),
)


def record_fingerprint(record: dict[str, Any]) -> str:
    payload = {
        "external_key": record.get("external_key"),
        "official_name": record.get("official_name"),
        "official_street": record.get("official_street"),
        "official_city": record.get("official_city"),
        "official_zip": record.get("official_zip"),
        "official_type": record.get("official_type"),
        "consumer_category": record.get("consumer_category"),
        "license_status": record.get("license_status"),
        "licensed_capacity": record.get("licensed_capacity"),
        "memory_designation": record.get("memory_designation"),
        "identity_state": record.get("identity_state"),
        "publication_state": record.get("publication_state"),
        "discovery_eligible": record.get("discovery_eligible"),
        "source_fingerprint": record.get("source_fingerprint"),
        "parties": [(role, record.get(field)) for field, role in ROLE_FIELDS if record.get(field)],
    }
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def _provider_values(record: dict[str, Any], fingerprint: str) -> tuple[Any, ...]:
    return (
        record["external_key"],
        record["state_code"],
        record["regulator_code"],
        record["source_facility_id"],
        record.get("license_id"),
        record["official_name"],
        record.get("official_street"),
        record.get("official_city"),
        record.get("state_code"),
        record.get("official_zip"),
        record.get("phone"),
        record["official_type"],
        record["consumer_category"],
        record.get("license_status"),
        bool(record.get("license_status_reported")),
        record.get("source_directory_context") or "unknown",
        record.get("licensed_capacity"),
        record["memory_designation"],
        record["identity_state"],
        record["publication_state"],
        bool(record.get("discovery_eligible")),
        record["retrieved_at"],
        record["source_locator"],
        record["source_fingerprint"],
        ADAPTER_VERSION,
        fingerprint,
    )


def _party_rows(provider_id: str, record: dict[str, Any]) -> list[tuple[str, str, str, str, str]]:
    rows: list[tuple[str, str, str, str, str]] = []
    for field_name, role in ROLE_FIELDS:
        name = record.get(field_name)
        if name:
            rows.append((str(uuid4()), provider_id, role, name, field_name))
    return rows


def persist_assisted_living_records(
    database_url: str,
    records: list[dict[str, Any]],
) -> dict[str, Any]:
    prepared = [
        attach_publication(dict(record)) for record in records if record.get("external_key")
    ]
    keys = [record["external_key"] for record in prepared]
    insert_copy = """
        COPY assisted_living_provider (
          id, external_key, state_code, regulator_code, source_facility_id,
          license_id, official_name, official_street, official_city, official_state,
          official_zip, official_phone, official_type, consumer_category,
          license_status, license_status_reported, source_directory_context,
          licensed_capacity, memory_designation, identity_state, publication_state,
          discovery_eligible, retrieved_at, source_locator, source_fingerprint,
          adapter_version, record_fingerprint
        ) FROM STDIN
    """
    update_sql = """
        UPDATE assisted_living_provider SET
          license_id = %s, official_name = %s, official_street = %s,
          official_city = %s, official_state = %s, official_zip = %s,
          official_phone = %s, official_type = %s, consumer_category = %s,
          license_status = %s, license_status_reported = %s,
          source_directory_context = %s, licensed_capacity = %s,
          memory_designation = %s, identity_state = %s, publication_state = %s,
          discovery_eligible = %s, retrieved_at = %s, source_locator = %s,
          source_fingerprint = %s, adapter_version = %s, record_fingerprint = %s,
          updated_at = now()
        WHERE id = %s
    """
    party_copy = """
        COPY assisted_living_organization_party (
          id, provider_id, role, name, source_field
        ) FROM STDIN
    """
    with psycopg.connect(database_url) as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            existing_by_key: dict[str, dict[str, Any]] = {}
            if keys:
                cursor.execute(
                    """
                    SELECT id, external_key, record_fingerprint
                      FROM assisted_living_provider
                     WHERE external_key = ANY(%s)
                    """,
                    (keys,),
                )
                existing_by_key = {row["external_key"]: row for row in cursor.fetchall()}
            inserts: list[tuple[Any, ...]] = []
            updates: list[tuple[Any, ...]] = []
            parties: list[tuple[str, str, str, str, str]] = []
            changed_ids: list[str] = []
            inserted = 0
            updated = 0
            unchanged = 0
            for record in prepared:
                fingerprint = record_fingerprint(record)
                values = _provider_values(record, fingerprint)
                existing = existing_by_key.get(record["external_key"])
                if existing is None:
                    provider_id = str(uuid4())
                    inserts.append((provider_id, *values))
                    parties.extend(_party_rows(provider_id, record))
                    changed_ids.append(provider_id)
                    inserted += 1
                elif existing["record_fingerprint"] == fingerprint:
                    unchanged += 1
                else:
                    provider_id = str(existing["id"])
                    updates.append((*values[4:], provider_id))
                    parties.extend(_party_rows(provider_id, record))
                    changed_ids.append(provider_id)
                    updated += 1
            if inserts:
                with cursor.copy(insert_copy) as copy:
                    for row in inserts:
                        copy.write_row(row)
            if updates:
                cursor.executemany(update_sql, updates)
            if changed_ids:
                cursor.execute(
                    "DELETE FROM assisted_living_organization_party WHERE provider_id = ANY(%s)",
                    (changed_ids,),
                )
            if parties:
                with cursor.copy(party_copy) as copy:
                    for row in parties:
                        copy.write_row(row)
            cursor.execute("SELECT count(*)::int AS n FROM assisted_living_provider")
            provider_count = cursor.fetchone()["n"]
            cursor.execute("SELECT count(*)::int AS n FROM assisted_living_organization_party")
            party_count = cursor.fetchone()["n"]
        connection.commit()
    return {
        "persisted": len(prepared),
        "inserted": inserted,
        "updated": updated,
        "unchanged": unchanged,
        "provider_rows": provider_count,
        "organization_party_rows": party_count,
        "adapter_version": ADAPTER_VERSION,
        "google_places_requests": 0,
    }


def audit_assisted_living_database(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        with connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(
                """
                SELECT state_code,
                       count(*)::int AS providers,
                       count(*) FILTER (WHERE discovery_eligible)::int AS discovery_eligible,
                       count(*) FILTER (WHERE publication_state = 'PUBLISHABLE_CURRENT')::int
                         AS publishable_current,
                       count(*) FILTER (WHERE publication_state = 'PUBLISHABLE_WITH_STATUS')::int
                         AS publishable_with_status,
                       count(*) FILTER (WHERE publication_state = 'HISTORICAL_ONLY')::int
                         AS historical_only,
                       count(*) FILTER (WHERE publication_state = 'NOT_CURRENTLY_PUBLISHABLE')::int
                         AS not_currently_publishable,
                       count(*) FILTER (WHERE publication_state = 'REVIEW_REQUIRED')::int
                         AS review_required,
                       count(*) FILTER (WHERE license_status = 'LICENSED')::int AS licensed,
                       count(*) FILTER (WHERE license_status = 'CLOSED')::int AS closed,
                       count(*) FILTER (WHERE license_status = 'PENDING')::int AS pending,
                       count(*) FILTER (
                         WHERE upper(license_status) = 'ON PROBATION'
                       )::int AS on_probation,
                       count(*) FILTER (WHERE NOT license_status_reported)::int
                         AS status_not_reported,
                       count(*) FILTER (
                         WHERE memory_designation = 'explicit_memory_or_dementia_license'
                       )::int AS explicit_memory,
                       count(*) FILTER (
                         WHERE memory_designation = 'specialty_endorsement'
                       )::int AS specialty_endorsement,
                       count(*) FILTER (
                         WHERE memory_designation = 'not_reported'
                       )::int AS memory_not_reported
                  FROM assisted_living_provider
                 GROUP BY state_code
                 ORDER BY state_code
                """
            )
            states = {row["state_code"]: row for row in cursor.fetchall()}
            cursor.execute(
                """
                SELECT role, count(*)::int AS n
                  FROM assisted_living_organization_party
                 GROUP BY role
                 ORDER BY role
                """
            )
            roles = {row["role"]: row["n"] for row in cursor.fetchall()}
            cursor.execute("SELECT count(*)::int AS n FROM assisted_living_provider")
            providers = cursor.fetchone()["n"]
            cursor.execute("SELECT count(*)::int AS n FROM assisted_living_organization_party")
            parties = cursor.fetchone()["n"]
            cursor.execute(
                """
                SELECT count(DISTINCT provider_id)::int AS facilities,
                       count(DISTINCT identifier_value)::int AS unique_ccns
                  FROM provider_identifier
                 WHERE issuer = 'CMS' AND identifier_type = 'CCN' AND valid_to IS NULL
                """
            )
            cms = cursor.fetchone()
    return {
        "providers": providers,
        "organization_parties": parties,
        "states": states,
        "roles": roles,
        "cms_facilities": cms["facilities"],
        "cms_unique_ccns": cms["unique_ccns"],
        "google_places_requests": 0,
    }
