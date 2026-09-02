"""Persist NJ-SEN-002 documents. Claims stay publication-ineligible."""

# ruff: noqa: E501

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .nj_doh_enforcement import (
    ADAPTER_VERSION,
    AGENCY,
    DATASET_KEY,
    PENALTY_LETTERS_URL,
    REGULATOR_CODE,
    EnforcementReport,
    IdentityRecord,
    ParsedDocument,
    assemble_documents,
    build_report,
    dedupe_index_rows,
    identity_from_ltc,
    incremental_download_pdfs,
    inspect_index,
    load_local_pdfs,
    parse_penalty_index,
    sha256_bytes,
)
from .nj_doh_ltc import parse_facility_rows, parse_xlsx


def load_identities_from_xlsx(payload: bytes) -> list[IdentityRecord]:
    _headers, rows, _sheets = parse_xlsx(payload)
    parsed, _quarantined = parse_facility_rows(rows)
    return [identity_from_ltc(row) for row in parsed]


def load_identities_from_db(connection: psycopg.Connection[Any]) -> list[IdentityRecord]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT source_facility_id, license_number, official_name, alpha_name,
                   street, city, county, zip_code, official_facility_type_canonical
            FROM state_facility_identity
            WHERE state_code = 'NJ' AND regulator_code = %s
            """,
            (REGULATOR_CODE,),
        )
        identities: list[IdentityRecord] = []
        for row in cursor.fetchall():
            identities.append(
                IdentityRecord(
                    source_facility_id=row[0],
                    license_number=row[1],
                    official_name=row[2],
                    alpha_name=row[3],
                    street=row[4],
                    city=row[5],
                    county=row[6],
                    zip_code=row[7],
                    licensed_owner=None,
                    canonical_type=row[8],
                )
            )
        cursor.execute(
            """
            SELECT f.source_facility_id, p.name
            FROM state_facility_party p
            JOIN state_facility_identity f ON f.id = p.facility_id
            WHERE p.role = 'licensed_owner'
            """
        )
        owners: dict[str, str] = {item[0]: item[1] for item in cursor.fetchall()}
    return [
        IdentityRecord(
            source_facility_id=item.source_facility_id,
            license_number=item.license_number,
            official_name=item.official_name,
            alpha_name=item.alpha_name,
            street=item.street,
            city=item.city,
            county=item.county,
            zip_code=item.zip_code,
            licensed_owner=owners.get(item.source_facility_id),
            canonical_type=item.canonical_type,
        )
        for item in identities
    ]


def _prior_snapshot_exists(connection: psycopg.Connection[Any], dataset_key: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM state_source_snapshot WHERE dataset_key = %s LIMIT 1",
            (dataset_key,),
        )
        return cursor.fetchone() is not None


def ingest_nj_doh_enforcement(
    html: str,
    *,
    identities: list[IdentityRecord],
    database_url: str | None,
    dry_run: bool,
    pdf_dir: Path | None = None,
    download_pdfs: bool = False,
    pdf_limit: int | None = None,
    retrieved_at: datetime | None = None,
    inspection_gate: dict[str, Any] | None = None,
    extra_documents: list[ParsedDocument] | None = None,
) -> EnforcementReport:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    rows, _modified = parse_penalty_index(html)
    unique, duplicates = dedupe_index_rows(rows)
    rejected = sum(1 for row in unique if not row.source_document_id or not row.source_document_url)
    downloaded = skipped = 0
    if download_pdfs and pdf_dir is not None:
        downloaded, skipped, _failed = incremental_download_pdfs(unique, pdf_dir, limit=pdf_limit)
    payloads = load_local_pdfs(pdf_dir) if pdf_dir is not None else {}
    documents = assemble_documents(unique, identities, pdf_payloads=payloads)
    if extra_documents:
        documents.extend(extra_documents)
    if dry_run or not database_url:
        return build_report(
            documents,
            html=html,
            retrieved_at=retrieved,
            dry_run=True,
            baseline_only=True,
            duplicate_index_rows=duplicates,
            rejected_rows=rejected,
            pdfs_downloaded=downloaded,
            pdfs_skipped=skipped,
            inspection_gate=inspection_gate,
        )

    with psycopg.connect(database_url) as connection:
        baseline_only = not _prior_snapshot_exists(connection, DATASET_KEY)
        snapshot_id = _upsert_snapshot(
            connection,
            html=html,
            row_count=len(unique),
            retrieved=retrieved,
            source_as_of=max(
                (item.document_date for item in documents if item.document_date), default=None
            ),
            baseline_only=baseline_only,
        )
        facility_ids = _facility_id_map(connection)
        for document in documents:
            _upsert_document(
                connection,
                snapshot_id,
                document,
                facility_ids,
                retrieved,
                baseline_only=baseline_only,
            )
        connection.commit()
        return build_report(
            documents,
            html=html,
            retrieved_at=retrieved,
            dry_run=False,
            baseline_only=baseline_only,
            duplicate_index_rows=duplicates,
            rejected_rows=rejected,
            pdfs_downloaded=downloaded,
            pdfs_skipped=skipped,
            inspection_gate=inspection_gate,
        )


def _facility_id_map(connection: psycopg.Connection[Any]) -> dict[str, str]:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT source_facility_id, id::text
            FROM state_facility_identity
            WHERE state_code = 'NJ' AND regulator_code = %s
            """,
            (REGULATOR_CODE,),
        )
        return {row[0]: row[1] for row in cursor.fetchall()}


def _upsert_snapshot(
    connection: psycopg.Connection[Any],
    *,
    html: str,
    row_count: int,
    retrieved: datetime,
    source_as_of: Any,
    baseline_only: bool,
) -> str:
    payload_hash = sha256_bytes(html.encode("utf-8"))
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO state_source_snapshot (
              dataset_key, agency, source_url, retrieved_at, source_as_of,
              content_sha256, row_count, schema_fingerprint, jurisdiction,
              baseline_only, original_filename, adapter_version, worksheet_names
            ) VALUES (
              %s, %s, %s, %s, %s, %s, %s, %s, 'NJ', %s, 'penalty_letters.html', %s, %s
            )
            ON CONFLICT (dataset_key, content_sha256)
            DO UPDATE SET retrieved_at = EXCLUDED.retrieved_at
            RETURNING id::text
            """,
            (
                DATASET_KEY,
                AGENCY,
                PENALTY_LETTERS_URL,
                retrieved,
                source_as_of,
                payload_hash,
                row_count,
                sha256_bytes(b"date|facility_name|enforcement_action|pdf_href"),
                baseline_only,
                ADAPTER_VERSION,
                ["penalty_letters"],
            ),
        )
        return cursor.fetchone()[0]


def _upsert_document(
    connection: psycopg.Connection[Any],
    snapshot_id: str,
    document: ParsedDocument,
    facility_ids: dict[str, str],
    retrieved: datetime,
    *,
    baseline_only: bool,
) -> None:
    attach = document.match.bucket in {"EXACT", "HIGH_CONFIDENCE"}
    facility_uuid = facility_ids.get(document.match.facility_id_key or "") if attach else None
    external_key = f"nj:njdoh:doc:{document.source_document_id.lower()}"
    raw = {
        **document.raw,
        "match_bucket": document.match.bucket,
        "match_method": document.match.method,
        "match_reason": document.match.reason,
    }
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO state_facility_document (
              external_key, state_code, regulator_code, dataset_key,
              source_document_id, source_document_url, document_title, document_kind,
              printed_facility_name, printed_license_number, printed_source_facility_id,
              printed_street, printed_city, printed_county, printed_zip,
              document_date, effective_date, end_date, remedy_type_raw, remedy_type_canonical,
              penalty_amount_cents, admission_curtailment, admission_curtailment_start,
              admission_curtailment_end, conditional_license, conditional_license_start,
              conditional_license_end, legal_citation, source_agency, content_sha256,
              file_size_bytes, page_count, text_extraction_status, document_fingerprint,
              extraction_confidence, status_raw, is_final, evidence_track, public_eligible,
              publication_state, facility_id, source_snapshot_id, adapter_version,
              retrieved_at, raw
            ) VALUES (
              %s, 'NJ', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              %s, %s, false, 'NOT_CURRENTLY_PUBLISHABLE', %s::uuid, %s::uuid, %s, %s, %s
            )
            ON CONFLICT (state_code, regulator_code, source_document_id)
            DO UPDATE SET
              retrieved_at = EXCLUDED.retrieved_at,
              content_sha256 = COALESCE(EXCLUDED.content_sha256, state_facility_document.content_sha256),
              file_size_bytes = COALESCE(EXCLUDED.file_size_bytes, state_facility_document.file_size_bytes),
              page_count = COALESCE(EXCLUDED.page_count, state_facility_document.page_count),
              text_extraction_status = EXCLUDED.text_extraction_status,
              document_fingerprint = EXCLUDED.document_fingerprint,
              extraction_confidence = EXCLUDED.extraction_confidence,
              facility_id = COALESCE(EXCLUDED.facility_id, state_facility_document.facility_id),
              raw = EXCLUDED.raw,
              updated_at = now()
            RETURNING id::text
            """,
            (
                external_key,
                REGULATOR_CODE,
                DATASET_KEY
                if document.document_kind == "penalty_letter"
                else "nj-doh-inspection-index",
                document.source_document_id,
                document.source_document_url,
                document.document_title,
                document.document_kind,
                document.printed_facility_name,
                document.printed_license_number,
                document.printed_source_facility_id,
                document.printed_street,
                document.printed_city,
                document.printed_county,
                document.printed_zip,
                document.document_date,
                document.effective_date,
                document.end_date,
                document.remedy_type_raw,
                document.remedy_type_canonical,
                document.penalty_amount_cents,
                document.admission_curtailment,
                document.admission_curtailment_start,
                document.admission_curtailment_end,
                document.conditional_license,
                document.conditional_license_start,
                document.conditional_license_end,
                document.legal_citation,
                AGENCY,
                document.content_sha256,
                document.file_size_bytes,
                document.page_count,
                document.text_extraction_status,
                document.document_fingerprint,
                document.extraction_confidence,
                document.status_raw,
                document.is_final,
                document.evidence_track,
                facility_uuid,
                snapshot_id,
                ADAPTER_VERSION,
                retrieved,
                Jsonb(raw),
            ),
        )
        document_id = cursor.fetchone()[0]
        cursor.execute(
            """
            INSERT INTO state_facility_action (
              document_id, facility_id, state_code, regulator_code, event_identity,
              event_type_raw, event_type_canonical, event_date, effective_date, end_date,
              penalty_amount_cents, status_raw, is_final, baseline_only, source_snapshot_id,
              adapter_version, raw
            ) VALUES (
              %s::uuid, %s::uuid, 'NJ', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
              %s::uuid, %s, %s
            )
            ON CONFLICT (regulator_code, event_identity) DO NOTHING
            RETURNING id::text
            """,
            (
                document_id,
                facility_uuid,
                REGULATOR_CODE,
                document.event_identity,
                document.remedy_type_raw,
                document.remedy_type_canonical,
                document.document_date,
                document.effective_date,
                document.end_date,
                document.penalty_amount_cents,
                document.status_raw,
                document.is_final,
                baseline_only,
                snapshot_id,
                ADAPTER_VERSION,
                Jsonb({"fingerprint": document.document_fingerprint}),
            ),
        )
        action_row = cursor.fetchone()
        cursor.execute(
            "DELETE FROM state_facility_document_match_ledger WHERE document_id = %s::uuid",
            (document_id,),
        )
        cursor.execute(
            """
            INSERT INTO state_facility_document_match_ledger (
              document_id, facility_id, match_bucket, match_method, reason, candidate_count
            ) VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s)
            """,
            (
                document_id,
                facility_uuid,
                document.match.bucket,
                document.match.method,
                document.match.reason,
                document.match.candidate_count,
            ),
        )
        if action_row and not baseline_only:
            kind = _monitor_kind(document)
            if kind:
                cursor.execute(
                    """
                    INSERT INTO state_facility_monitor_event (
                      dataset_key, event_kind, event_identity, document_id, action_id,
                      baseline_only, source_snapshot_id
                    ) VALUES (%s, %s, %s, %s::uuid, %s::uuid, false, %s::uuid)
                    ON CONFLICT (dataset_key, event_kind, event_identity) DO NOTHING
                    """,
                    (
                        DATASET_KEY,
                        kind,
                        document.event_identity,
                        document_id,
                        action_row[0],
                        snapshot_id,
                    ),
                )


def _monitor_kind(document: ParsedDocument) -> str | None:
    if document.document_kind.startswith("inspection"):
        return "new_inspection_document"
    canonical = document.remedy_type_canonical
    if canonical == "ADMISSION_CURTAILMENT" or canonical == "ADMISSION_CURTAILMENT_AND_DPOC":
        return "new_admission_curtailment"
    if canonical == "CONDITIONAL_LICENSE":
        return "new_conditional_license"
    if canonical in {"LICENSE_SUSPENSION", "LICENSE_REVOCATION"}:
        return "new_license_suspension_revocation"
    if canonical.startswith("ORDER_LIFTING") or canonical == "RESCISSION":
        return "changed_remedy_status"
    if document.document_kind == "penalty_letter":
        return "newly_published_penalty_letter"
    return None


def inspect_only_json(html: str) -> str:
    return json_dumps(inspect_index(html))


def json_dumps(payload: dict[str, Any]) -> str:
    import json

    return json.dumps(payload, indent=2, default=str) + "\n"
