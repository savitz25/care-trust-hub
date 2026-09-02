"""Persist NJ-SEN-004 All_Acute identities. Claims stay publication-ineligible."""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .nj_doh_acute import (
    ADAPTER_VERSION,
    AGENCY,
    DATASET_KEY,
    REGULATOR_CODE,
    SOURCE_URL,
    TYPE_MAP,
    NjAcuteFacilityRow,
    NjAcuteIngestReport,
    NjMatch,
    build_report,
    identity_state_for,
    match_rows,
    parse_acute_rows,
    parse_acute_xlsx,
    physical_location_areas,
    schema_fingerprint,
)
from .state_regulator import CanonicalCmsFacility


def _provider_map(connection: psycopg.Connection[Any], provider_type: str) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT DISTINCT ON (pi.identifier_value) pi.identifier_value, pi.provider_id::text
            FROM provider_identifier pi
            JOIN provider p ON p.id = pi.provider_id
            WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_to IS NULL
              AND p.provider_type = %s
            ORDER BY pi.identifier_value, pi.valid_from DESC NULLS LAST
            """,
            (provider_type,),
        )
        return {row[0]: row[1] for row in cursor.fetchall()}


def load_cms_agency_universe(
    connection: psycopg.Connection[Any], provider_type: str, state_code: str = "NJ"
) -> list[CanonicalCmsFacility]:
    table = "home_health_snapshot" if provider_type == "home_health" else "hospice_snapshot"
    address_col = "address" if provider_type == "home_health" else "address_line_1"
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT DISTINCT ON (s.cms_ccn)
              s.cms_ccn, s.provider_name, s.{address_col}, s.city, s.state_code, s.zip_code, s.telephone
            FROM {table} s
            WHERE s.state_code = %s
            ORDER BY s.cms_ccn
            """,
            (state_code,),
        )
        return [
            CanonicalCmsFacility(
                cms_ccn=row[0],
                name=row[1] or "",
                address=row[2],
                city=row[3],
                state=row[4] or state_code,
                zip_code=row[5],
                phone=row[6],
            )
            for row in cursor.fetchall()
        ]


def ingest_nj_doh_acute(
    payload: bytes,
    *,
    database_url: str | None,
    dry_run: bool,
    retrieved_at: datetime | None = None,
    hh_universe: list[CanonicalCmsFacility] | None = None,
    hospice_universe: list[CanonicalCmsFacility] | None = None,
    service_area_status: str = "SOURCE_ACCESS_BLOCKED",
) -> NjAcuteIngestReport:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    headers, rows, sheets = parse_acute_xlsx(payload)
    parsed, quarantined = parse_acute_rows(rows)
    schema_fp = schema_fingerprint(headers)
    hh = list(hh_universe or [])
    hospice = list(hospice_universe or [])
    hh_providers: dict[str, str] = {}
    hospice_providers: dict[str, str] = {}
    if dry_run or not database_url:
        if database_url:
            with psycopg.connect(database_url) as connection:
                hh = hh or load_cms_agency_universe(connection, "home_health")
                hospice = hospice or load_cms_agency_universe(connection, "hospice")
        matches = match_rows(parsed, hh, hospice)
        return build_report(
            parsed,
            quarantined,
            matches,
            payload=payload,
            schema_fp=schema_fp,
            sheets=sheets,
            retrieved_at=retrieved,
            dry_run=True,
            net_new=len(parsed),
            service_area_status=service_area_status,
        )

    with psycopg.connect(database_url) as connection:
        hh = hh or load_cms_agency_universe(connection, "home_health")
        hospice = hospice or load_cms_agency_universe(connection, "hospice")
        hh_providers = _provider_map(connection, "home_health")
        hospice_providers = _provider_map(connection, "hospice")
        matches = match_rows(parsed, hh, hospice)
        snapshot_id = _upsert_snapshot(
            connection,
            payload_hash=hashlib.sha256(payload).hexdigest(),
            schema_fp=schema_fp,
            row_count=len(rows),
            sheets=sheets,
            retrieved=retrieved,
            source_as_of=next((item.run_date for item in parsed if item.run_date), None),
        )
        _seed_type_map(connection)
        net_new = updated = unchanged = existing_enriched = 0
        providers = {**hh_providers, **hospice_providers}
        for row, match in zip(parsed, matches, strict=True):
            result = _upsert_facility(connection, snapshot_id, row, match, providers, retrieved)
            if result == "insert":
                net_new += 1
            elif result == "update":
                updated += 1
            else:
                unchanged += 1
            if match.bucket in {"EXACT", "HIGH_CONFIDENCE"}:
                existing_enriched += 1
        for item in physical_location_areas(parsed):
            _upsert_service_area(connection, snapshot_id, item, retrieved)
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
            payload=payload,
            schema_fp=schema_fp,
            sheets=sheets,
            retrieved_at=retrieved,
            dry_run=False,
            net_new=net_new,
            updated=updated,
            unchanged=unchanged,
            existing_enriched=existing_enriched,
            service_area_status=service_area_status,
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
              %s, %s, %s, %s, %s, %s, %s, %s, 'NJ', true, 'All_Acute.xlsx', %s, %s
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
    for raw, spec in TYPE_MAP.items():
        connection.execute(
            """
            INSERT INTO state_facility_type_map (
              adapter_version, raw_type, canonical_type, cms_nursing_eligible, notes,
              senior_relevant, cms_crosswalk_class, public_profile_eligible,
              state_intelligence_eligible, review_status
            ) VALUES (%s, %s, %s, false, %s, %s, %s, false, %s, 'MAPPED')
            ON CONFLICT (adapter_version, raw_type) DO UPDATE SET
              canonical_type = EXCLUDED.canonical_type,
              notes = EXCLUDED.notes,
              senior_relevant = EXCLUDED.senior_relevant,
              cms_crosswalk_class = EXCLUDED.cms_crosswalk_class,
              public_profile_eligible = false,
              state_intelligence_eligible = EXCLUDED.state_intelligence_eligible,
              review_status = EXCLUDED.review_status
            """,
            (
                ADAPTER_VERSION,
                raw,
                spec.canonical,
                spec.notes,
                spec.senior_relevant,
                spec.cms_crosswalk_class,
                spec.state_intelligence_eligible,
            ),
        )


def _upsert_facility(
    connection: psycopg.Connection[Any],
    snapshot_id: str,
    row: NjAcuteFacilityRow,
    match: NjMatch,
    providers: dict[str, str],
    retrieved: datetime,
) -> str:
    cms_ccn = match.cms_ccn if match.bucket in {"EXACT", "HIGH_CONFIDENCE"} else None
    cms_provider_id = providers.get(cms_ccn) if cms_ccn else None
    if match.bucket not in {"EXACT", "HIGH_CONFIDENCE"}:
        cms_ccn = None
        cms_provider_id = None
    external_key = f"nj:njdoh:acute:{row.source_facility_id.lower()}"
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id::text, record_fingerprint FROM state_facility_identity
            WHERE state_code = 'NJ' AND regulator_code = %s
              AND dataset_key = %s AND source_facility_id = %s
            """,
            (REGULATOR_CODE, DATASET_KEY, row.source_facility_id),
        )
        existing = cursor.fetchone()
        if existing is None:
            cursor.execute(
                """
                INSERT INTO state_facility_identity (
                  external_key, state_code, regulator_code, dataset_key, source_facility_id,
                  license_number, official_name, alpha_name, official_facility_type_raw,
                  official_facility_type_canonical, license_expires_on, licensed_beds_slots,
                  street, mailing_street, city, county, state, zip_code, phone, email,
                  owner_entity_type_raw, latitude, longitude, first_seen_on, last_seen_on,
                  cms_ccn, cms_link_method, cms_link_confidence, cms_provider_id,
                  identity_state, publication_state, public_eligible, source_snapshot_id,
                  source_record_identifier, record_fingerprint, source_observed_on,
                  retrieved_at, adapter_version, raw
                ) VALUES (
                  %s,'NJ',%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                  %s,%s,%s,%s,%s,'NOT_CURRENTLY_PUBLISHABLE', false, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id::text
                """,
                (
                    external_key,
                    REGULATOR_CODE,
                    DATASET_KEY,
                    row.source_facility_id,
                    row.license_number,
                    row.official_name,
                    row.alpha_name,
                    row.facility_type_raw,
                    row.facility_type_canonical,
                    row.license_expires_on,
                    row.licensed_beds_slots,
                    row.street,
                    row.mailing_street,
                    row.city,
                    row.county,
                    row.state,
                    row.zip_code,
                    row.phone,
                    row.email,
                    row.owner_entity_type_raw,
                    row.latitude,
                    row.longitude,
                    row.run_date,
                    row.run_date,
                    cms_ccn,
                    match.method if cms_ccn else None,
                    match.bucket if cms_ccn else None,
                    cms_provider_id,
                    identity_state_for(match),
                    snapshot_id,
                    row.source_record_identifier,
                    row.record_fingerprint,
                    row.run_date,
                    retrieved,
                    ADAPTER_VERSION,
                    Jsonb(row.raw),
                ),
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
                  license_expires_on=%s, licensed_beds_slots=%s, street=%s, mailing_street=%s,
                  city=%s, county=%s, state=%s, zip_code=%s, phone=%s, email=%s,
                  owner_entity_type_raw=%s, latitude=%s, longitude=%s, last_seen_on=%s,
                  cms_ccn=%s, cms_link_method=%s, cms_link_confidence=%s, cms_provider_id=%s,
                  identity_state=%s, source_snapshot_id=%s, record_fingerprint=%s,
                  source_observed_on=%s, retrieved_at=%s, raw=%s, updated_at=now()
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
                    row.mailing_street,
                    row.city,
                    row.county,
                    row.state,
                    row.zip_code,
                    row.phone,
                    row.email,
                    row.owner_entity_type_raw,
                    row.latitude,
                    row.longitude,
                    row.run_date,
                    cms_ccn,
                    match.method if cms_ccn else None,
                    match.bucket if cms_ccn else None,
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
        connection.execute(
            "DELETE FROM state_facility_party WHERE facility_id = %s::uuid", (facility_id,)
        )
        if row.licensed_owner:
            connection.execute(
                """
                INSERT INTO state_facility_party (facility_id, role, name, source_field, address_text, as_of)
                VALUES (%s::uuid, 'licensed_owner', %s, 'LICENSED_OWNER', %s, %s)
                """,
                (facility_id, row.licensed_owner, row.owner_address, row.run_date),
            )
        if row.administrator:
            connection.execute(
                """
                INSERT INTO state_facility_party (facility_id, role, name, source_field, as_of)
                VALUES (%s::uuid, 'administrator', %s, 'ADMIN', %s)
                """,
                (facility_id, row.administrator, row.run_date),
            )
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
                cms_ccn or match.cms_ccn,
                cms_provider_id,
                match.reason,
                match.candidate_count,
            ),
        )
        return status


def _upsert_service_area(
    connection: psycopg.Connection[Any],
    snapshot_id: str,
    item: dict[str, str],
    retrieved: datetime,
) -> None:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT id::text FROM state_facility_identity
            WHERE state_code = 'NJ' AND dataset_key = %s AND source_facility_id = %s
            """,
            (DATASET_KEY, item["source_facility_id"]),
        )
        found = cursor.fetchone()
        if not found:
            return
        fingerprint = hashlib.sha256(
            f"{item['source_facility_id']}|{item['coverage_type']}|{item['county']}|{item['zip_code']}".encode()
        ).hexdigest()
        cursor.execute(
            """
            SELECT 1 FROM state_facility_service_area
            WHERE facility_id = %s::uuid AND coverage_type = %s
              AND COALESCE(county, '') = COALESCE(%s, '')
              AND COALESCE(zip_code, '') = COALESCE(%s, '')
            """,
            (found[0], item["coverage_type"], item["county"] or None, item["zip_code"] or None),
        )
        if cursor.fetchone():
            return
        cursor.execute(
            """
            INSERT INTO state_facility_service_area (
              facility_id, coverage_type, county, zip_code, source_page, retrieved_at,
              record_fingerprint, source_snapshot_id, adapter_version, public_eligible, raw
            ) VALUES (
              %s::uuid, %s, %s, %s, %s, %s, %s, %s::uuid, %s, false, '{}'::jsonb
            )
            """,
            (
                found[0],
                item["coverage_type"],
                item["county"] or None,
                item["zip_code"] or None,
                SOURCE_URL,
                retrieved,
                fingerprint,
                snapshot_id,
                ADAPTER_VERSION,
            ),
        )
