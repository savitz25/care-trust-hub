"""Persist NJ-SEN-001 identities. Claims stay publication-ineligible."""

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .nj_doh_ltc import (
    ADAPTER_VERSION,
    AGENCY,
    DATASET_KEY,
    REGULATOR_CODE,
    SOURCE_URL,
    TYPE_MAP,
    NjDohFacilityRow,
    NjIngestReport,
    NjMatch,
    build_report,
    identity_state_for,
    inspect_payload,
    match_cms,
    parse_facility_rows,
    parse_xlsx,
    schema_fingerprint,
)
from .state_regulator import CanonicalCmsFacility
from .state_regulator_database import load_cms_universe


def _provider_map(connection: psycopg.Connection[Any]) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT ON (pi.identifier_value) pi.identifier_value, pi.provider_id::text
            FROM provider_identifier pi
            WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
            ORDER BY pi.identifier_value, pi.valid_from DESC NULLS LAST
            """
        )
        return {row[0]: row[1] for row in cursor.fetchall()}


def _existing_license_ids(connection: psycopg.Connection[Any]) -> set[str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT identifier_value FROM provider_identifier
            WHERE issuer = 'NJDOH' AND identifier_type = 'LICENSE' AND valid_to IS NULL
            """
        )
        return {row[0] for row in cursor.fetchall()}


def ingest_nj_doh_ltc(
    payload: bytes,
    *,
    database_url: str | None,
    dry_run: bool,
    retrieved_at: datetime | None = None,
) -> NjIngestReport:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    headers, rows, sheets = parse_xlsx(payload)
    parsed, quarantined = parse_facility_rows(rows)
    payload_hash = hashlib.sha256(payload).hexdigest()
    schema_fp = schema_fingerprint(headers)
    universe: list[CanonicalCmsFacility] = []
    providers: dict[str, str] = {}
    existing_licenses: set[str] = set()
    if dry_run or not database_url:
        if database_url:
            with psycopg.connect(database_url) as connection:
                universe = load_cms_universe(connection, "NJ")
                existing_licenses = _existing_license_ids(connection)
        matches = [match_cms(row, universe) for row in parsed]
        enriched = sum(1 for row, match in zip(parsed, matches, strict=True) if row.license_number in existing_licenses and match.bucket in {"EXACT", "HIGH_CONFIDENCE"})
        return build_report(
            parsed,
            quarantined,
            matches,
            payload_hash=payload_hash,
            schema_fp=schema_fp,
            sheets=sheets,
            retrieved_at=retrieved,
            dry_run=True,
            net_new=len(parsed),
            existing_enriched=enriched,
        )

    with psycopg.connect(database_url) as connection:
        universe = load_cms_universe(connection, "NJ")
        providers = _provider_map(connection)
        existing_licenses = _existing_license_ids(connection)
        matches = [match_cms(row, universe) for row in parsed]
        snapshot_id = _upsert_snapshot(
            connection,
            payload_hash=payload_hash,
            schema_fp=schema_fp,
            row_count=len(rows),
            sheets=sheets,
            retrieved=retrieved,
            source_as_of=next((item.run_date for item in parsed if item.run_date), None),
        )
        _seed_type_map(connection)
        net_new = updated = unchanged = existing_enriched = 0
        for row, match in zip(parsed, matches, strict=True):
            result = _upsert_facility(connection, snapshot_id, row, match, providers, retrieved)
            if result == "insert":
                net_new += 1
            elif result == "update":
                updated += 1
            else:
                unchanged += 1
            if match.bucket in {"EXACT", "HIGH_CONFIDENCE"} and (
                row.license_number in existing_licenses or match.cms_ccn in providers
            ):
                existing_enriched += 1
        for item in quarantined:
            connection.execute(
                """
                INSERT INTO state_facility_type_review
                  (snapshot_id, source_facility_id, raw_type, reason)
                VALUES (%s, %s, %s, %s)
                """,
                (
                    snapshot_id,
                    item.get("FacID"),
                    item.get("FACILITY_TYPE") or "",
                    item.get("_reason") or "quarantined",
                ),
            )
        connection.commit()
        return build_report(
            parsed,
            quarantined,
            matches,
            payload_hash=payload_hash,
            schema_fp=schema_fp,
            sheets=sheets,
            retrieved_at=retrieved,
            dry_run=False,
            net_new=net_new,
            updated=updated,
            unchanged=unchanged,
            existing_enriched=existing_enriched,
        )


def _upsert_snapshot(
    connection: psycopg.Connection[Any],
    *,
    payload_hash: str,
    schema_fp: str,
    row_count: int,
    sheets: list[str],
    retrieved: datetime,
    source_as_of: Any,
) -> str:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO state_source_snapshot (
              dataset_key, agency, source_url, retrieved_at, source_as_of,
              content_sha256, row_count, schema_fingerprint, jurisdiction,
              baseline_only, original_filename, adapter_version, worksheet_names
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, 'NJ', true, 'All_LTC.xlsx', %s, %s
            )
            ON CONFLICT (dataset_key, content_sha256)
            DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at
            RETURNING id::text
            """,
            (
                DATASET_KEY,
                AGENCY,
                SOURCE_URL,
                retrieved,
                source_as_of,
                payload_hash,
                row_count,
                schema_fp,
                ADAPTER_VERSION,
                sheets,
            ),
        )
        return cursor.fetchone()[0]


def _seed_type_map(connection: psycopg.Connection[Any]) -> None:
    for raw, (canonical, cms_eligible, notes) in TYPE_MAP.items():
        connection.execute(
            """
            INSERT INTO state_facility_type_map (
              adapter_version, raw_type, canonical_type, cms_nursing_eligible, notes
            ) VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (adapter_version, raw_type) DO UPDATE SET
              canonical_type = EXCLUDED.canonical_type,
              cms_nursing_eligible = EXCLUDED.cms_nursing_eligible,
              notes = EXCLUDED.notes
            """,
            (ADAPTER_VERSION, raw, canonical, cms_eligible, notes),
        )


def _upsert_facility(
    connection: psycopg.Connection[Any],
    snapshot_id: str,
    row: NjDohFacilityRow,
    match: NjMatch,
    providers: dict[str, str],
    retrieved: datetime,
) -> str:
    cms_ccn = match.cms_ccn if match.bucket in {"EXACT", "HIGH_CONFIDENCE"} else None
    cms_provider_id = providers.get(cms_ccn) if cms_ccn else None
    if match.bucket == "EXACT":
        confidence = "EXACT"
    elif match.bucket == "HIGH_CONFIDENCE":
        confidence = "HIGH_CONFIDENCE"
    elif match.bucket in {"REVIEW_REQUIRED", "CONFLICT", "UNRESOLVED", "UNSAFE_REJECTED"}:
        confidence = "UNRESOLVED" if match.bucket in {"UNRESOLVED", "UNSAFE_REJECTED"} else match.bucket
        cms_ccn = None
        cms_provider_id = None
    else:
        confidence = "UNRESOLVED"
        cms_ccn = None
        cms_provider_id = None
    external_key = f"nj:njdoh:{row.source_facility_id.lower()}"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id::text, record_fingerprint FROM state_facility_identity
            WHERE state_code = 'NJ' AND regulator_code = %s AND source_facility_id = %s
            """,
            (REGULATOR_CODE, row.source_facility_id),
        )
        existing = cursor.fetchone()
        values = (
            external_key,
            "NJ",
            REGULATOR_CODE,
            row.source_facility_id,
            row.license_number,
            row.official_name,
            row.alpha_name,
            row.facility_type_raw,
            row.facility_type_canonical,
            row.license_expires_on,
            row.licensed_beds_slots,
            row.street,
            row.city,
            row.county,
            row.state,
            row.zip_code,
            row.phone,
            row.email,
            row.owner_entity_type_raw,
            cms_ccn,
            match.method if cms_ccn else None,
            confidence if cms_ccn else None,
            cms_provider_id,
            identity_state_for(match),
            "NOT_CURRENTLY_PUBLISHABLE",
            False,
            snapshot_id,
            row.source_record_identifier,
            row.record_fingerprint,
            row.run_date,
            retrieved,
            ADAPTER_VERSION,
            Jsonb(row.raw),
        )
        if existing is None:
            cursor.execute(
                """
                INSERT INTO state_facility_identity (
                  external_key, state_code, regulator_code, source_facility_id, license_number,
                  official_name, alpha_name, official_facility_type_raw,
                  official_facility_type_canonical, license_expires_on, licensed_beds_slots,
                  street, city, county, state, zip_code, phone, email, owner_entity_type_raw,
                  cms_ccn, cms_link_method, cms_link_confidence, cms_provider_id,
                  identity_state, publication_state, public_eligible, source_snapshot_id,
                  source_record_identifier, record_fingerprint, source_observed_on,
                  retrieved_at, adapter_version, raw
                ) VALUES (
                  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                )
                RETURNING id::text
                """,
                values,
            )
            facility_id = cursor.fetchone()[0]
            status = "insert"
        elif existing[1] == row.record_fingerprint:
            facility_id = existing[0]
            status = "unchanged"
        else:
            cursor.execute(
                """
                UPDATE state_facility_identity SET
                  license_number=%s, official_name=%s, alpha_name=%s,
                  official_facility_type_raw=%s, official_facility_type_canonical=%s,
                  license_expires_on=%s, licensed_beds_slots=%s, street=%s, city=%s,
                  county=%s, state=%s, zip_code=%s, phone=%s, email=%s,
                  owner_entity_type_raw=%s, cms_ccn=%s, cms_link_method=%s,
                  cms_link_confidence=%s, cms_provider_id=%s, identity_state=%s,
                  source_snapshot_id=%s, record_fingerprint=%s, source_observed_on=%s,
                  retrieved_at=%s, raw=%s, updated_at=now()
                WHERE id = %s::uuid
                """,
                (
                    row.license_number,
                    row.official_name,
                    row.alpha_name,
                    row.facility_type_raw,
                    row.facility_type_canonical,
                    row.license_expires_on,
                    row.licensed_beds_slots,
                    row.street,
                    row.city,
                    row.county,
                    row.state,
                    row.zip_code,
                    row.phone,
                    row.email,
                    row.owner_entity_type_raw,
                    cms_ccn,
                    match.method if cms_ccn else None,
                    confidence if cms_ccn else None,
                    cms_provider_id,
                    identity_state_for(match),
                    snapshot_id,
                    row.record_fingerprint,
                    row.run_date,
                    retrieved,
                    Jsonb(row.raw),
                    existing[0],
                ),
            )
            facility_id = existing[0]
            status = "update"
        _replace_parties(connection, facility_id, row)
        connection.execute(
            "DELETE FROM state_facility_match_ledger WHERE facility_id = %s::uuid",
            (facility_id,),
        )
        connection.execute(
            """
            INSERT INTO state_facility_match_ledger (
              facility_id, match_bucket, match_method, cms_ccn, cms_provider_id,
              reason, candidate_count
            ) VALUES (%s::uuid, %s, %s, %s, %s, %s, %s)
            """,
            (
                facility_id,
                match.bucket,
                match.method,
                cms_ccn if match.bucket in {"EXACT", "HIGH_CONFIDENCE"} else match.cms_ccn,
                cms_provider_id,
                match.reason,
                match.candidate_count,
            ),
        )
        return status


def _replace_parties(
    connection: psycopg.Connection[Any], facility_id: str, row: NjDohFacilityRow
) -> None:
    connection.execute("DELETE FROM state_facility_party WHERE facility_id = %s::uuid", (facility_id,))
    if row.licensed_owner:
        connection.execute(
            """
            INSERT INTO state_facility_party (
              facility_id, role, name, source_field, address_text, as_of, match_method
            ) VALUES (%s::uuid, 'licensed_owner', %s, 'LICENSED_OWNER', %s, %s, 'source_explicit')
            """,
            (facility_id, row.licensed_owner, row.owner_address, row.run_date),
        )
    if row.administrator:
        connection.execute(
            """
            INSERT INTO state_facility_party (
              facility_id, role, name, source_field, address_text, as_of, match_method
            ) VALUES (%s::uuid, 'administrator', %s, 'ADMIN', NULL, %s, 'source_explicit')
            """,
            (facility_id, row.administrator, row.run_date),
        )


def inspect_and_report(payload: bytes) -> dict[str, Any]:
    return inspect_payload(payload)
