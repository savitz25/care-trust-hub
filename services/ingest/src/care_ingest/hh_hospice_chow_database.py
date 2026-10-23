"""Persist a reviewed HH/Hospice CHOW plan. Dry-run unless write is explicit.

This module does not open a database connection. A write requires an already
open connection, a plan that passed QA, a non-empty event file, and
dry_run_reviewed=True. There is no DELETE. Rows missing from the current
upstream file are marked not_seen. Owner associations are never public.
"""

from __future__ import annotations

from typing import Any

from .hh_hospice_chow import (
    HH_DATASET,
    HH_OWNER_DATASET,
    HOSPICE_DATASET,
    HOSPICE_OWNER_DATASET,
    TRANSFORMATION_VERSION,
    ChowPlan,
    ChowQaError,
    StagedEvent,
    StagedOwner,
)
from .ownership_change import normalize_event_type

EVENT_DATASETS = (HH_DATASET, HOSPICE_DATASET)
OWNER_DATASETS = (HH_OWNER_DATASET, HOSPICE_OWNER_DATASET)

EVENT_UPSERT_SQL = """
INSERT INTO ownership_change_event (
  provider_id, provider_identifier, source_release_id, raw_object_id, ingest_run_id,
  event_key, change_type_code, change_type_text, effective_date, source_record_locator,
  raw_record, transformation_version, event_natural_key, normalized_event_type,
  event_status, confidence, source_dataset_key, buyer_enrollment_id, seller_enrollment_id,
  public_eligible, not_seen, last_seen_at, last_seen_source_release_id,
  transformation_version_event
) VALUES (
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s::jsonb, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s, false, now(), %s,
  %s
)
ON CONFLICT (event_natural_key) WHERE event_natural_key IS NOT NULL
DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  provider_identifier = EXCLUDED.provider_identifier,
  source_release_id = EXCLUDED.source_release_id,
  raw_object_id = EXCLUDED.raw_object_id,
  ingest_run_id = EXCLUDED.ingest_run_id,
  event_key = EXCLUDED.event_key,
  change_type_code = EXCLUDED.change_type_code,
  change_type_text = EXCLUDED.change_type_text,
  effective_date = EXCLUDED.effective_date,
  source_record_locator = EXCLUDED.source_record_locator,
  raw_record = EXCLUDED.raw_record,
  transformation_version = EXCLUDED.transformation_version,
  normalized_event_type = EXCLUDED.normalized_event_type,
  event_status = EXCLUDED.event_status,
  confidence = EXCLUDED.confidence,
  source_dataset_key = EXCLUDED.source_dataset_key,
  buyer_enrollment_id = EXCLUDED.buyer_enrollment_id,
  seller_enrollment_id = EXCLUDED.seller_enrollment_id,
  public_eligible = EXCLUDED.public_eligible,
  not_seen = false,
  last_seen_at = now(),
  last_seen_source_release_id = EXCLUDED.last_seen_source_release_id,
  transformation_version_event = EXCLUDED.transformation_version_event
WHERE ownership_change_event.source_dataset_key = ANY(%s)
""".strip()

NOT_SEEN_SQL = """
UPDATE ownership_change_event
SET not_seen = true
WHERE source_dataset_key = ANY(%s)
  AND event_natural_key IS NOT NULL
  AND NOT (event_natural_key = ANY(%s))
""".strip()

OWNER_UPSERT_SQL = """
INSERT INTO hh_hospice_chow_owner_association (
  dataset_key, owner_natural_key, enrollment_id, associate_id, party_kind, party_name,
  role_code, role_text, association_date, ownership_percentage, source_release_id,
  raw_object_id, ingest_run_id, source_record_locator, raw_record, transformation_version,
  public_eligible, not_seen, last_seen_at
) VALUES (
  %s, %s, %s, %s, %s, %s,
  %s, %s, %s, %s, %s,
  %s, %s, %s, %s::jsonb, %s,
  false, false, now()
)
ON CONFLICT (owner_natural_key)
DO UPDATE SET
  dataset_key = EXCLUDED.dataset_key,
  enrollment_id = EXCLUDED.enrollment_id,
  associate_id = EXCLUDED.associate_id,
  party_kind = EXCLUDED.party_kind,
  party_name = EXCLUDED.party_name,
  role_code = EXCLUDED.role_code,
  role_text = EXCLUDED.role_text,
  association_date = EXCLUDED.association_date,
  ownership_percentage = EXCLUDED.ownership_percentage,
  source_release_id = EXCLUDED.source_release_id,
  raw_object_id = EXCLUDED.raw_object_id,
  ingest_run_id = EXCLUDED.ingest_run_id,
  source_record_locator = EXCLUDED.source_record_locator,
  raw_record = EXCLUDED.raw_record,
  transformation_version = EXCLUDED.transformation_version,
  public_eligible = false,
  not_seen = false,
  last_seen_at = now()
""".strip()

RELEASE_SQL = """
INSERT INTO source_release (
  source_dataset_id, release_key, retrieved_at, content_sha256, source_modified_at
)
SELECT id, %s, now(), %s, NULL
FROM source_dataset
WHERE dataset_key = %s
ON CONFLICT (source_dataset_id, release_key) DO UPDATE
SET content_sha256 = EXCLUDED.content_sha256
RETURNING id
""".strip()

RAW_OBJECT_SQL = """
INSERT INTO raw_object (
  source_release_id, storage_key, original_filename, byte_size, content_type, content_sha256
) VALUES (%s, %s, %s, %s, 'text/csv', %s)
ON CONFLICT (source_release_id, storage_key) DO UPDATE
SET byte_size = EXCLUDED.byte_size,
    content_sha256 = EXCLUDED.content_sha256
RETURNING id
""".strip()

INGEST_RUN_SQL = """
INSERT INTO ingest_run (
  source_release_id, transformation_version, status, started_at, completed_at,
  rows_read, valid_rows, rejected_rows, report
) VALUES (%s, %s, 'succeeded', now(), now(), %s, %s, 0, %s::jsonb)
RETURNING id
""".strip()


def _json(value: dict[str, Any]) -> str:
    import json

    return json.dumps(value, sort_keys=True, default=str)


def _uuid_or_none(value: str | None) -> str | None:
    import uuid

    if not value:
        return None
    try:
        return str(uuid.UUID(value))
    except ValueError:
        return None


def event_upsert_params(
    event: StagedEvent, *, release_id: str, raw_object_id: str, ingest_run_id: str
) -> tuple[Any, ...]:
    provider_id = _uuid_or_none(event.buyer_provider_id)
    return (
        provider_id,
        event.provider_identifier,
        release_id,
        raw_object_id,
        ingest_run_id,
        event.event_natural_key,
        event.change_type_code,
        event.change_type_text,
        event.effective_date,
        event.source_record_locator,
        _json(event.raw_record),
        TRANSFORMATION_VERSION,
        event.event_natural_key,
        normalize_event_type(event.change_type_code, event.change_type_text),
        event.event_status,
        event.confidence,
        event.dataset_key,
        event.buyer_enrollment_id,
        event.seller_enrollment_id,
        event.public_eligible,
        release_id,
        TRANSFORMATION_VERSION,
        list(EVENT_DATASETS),
    )


def owner_upsert_params(
    owner: StagedOwner, *, release_id: str, raw_object_id: str, ingest_run_id: str
) -> tuple[Any, ...]:
    if owner.public_eligible:
        raise ChowQaError("owner association was marked publicly eligible")
    return (
        owner.dataset_key,
        owner.owner_natural_key,
        owner.enrollment_id,
        owner.associate_id,
        owner.party_kind,
        owner.party_name,
        owner.role_code,
        owner.role_text,
        owner.association_date,
        owner.ownership_percentage,
        release_id,
        raw_object_id,
        ingest_run_id,
        owner.source_record_locator,
        _json(owner.raw_record),
        TRANSFORMATION_VERSION,
    )


def guarded_sql() -> tuple[str, ...]:
    """SQL this loader is allowed to run. Tests assert it never removes rows."""
    return (
        EVENT_UPSERT_SQL,
        NOT_SEEN_SQL,
        OWNER_UPSERT_SQL,
        RELEASE_SQL,
        RAW_OBJECT_SQL,
        INGEST_RUN_SQL,
    )


def _dataset_key_for_file(filename: str) -> str:
    upper = filename.upper()
    hospice = "HOSPICE" in upper
    owners = "OWNER" in upper
    if hospice and owners:
        return HOSPICE_OWNER_DATASET
    if hospice:
        return HOSPICE_DATASET
    if owners:
        return HH_OWNER_DATASET
    return HH_DATASET


def _execute(connection: Any, plan: ChowPlan) -> tuple[int, int]:
    cursor = connection.cursor()
    try:
        provenance: dict[str, tuple[str, str, str]] = {}
        for item in plan.files:
            dataset_key = _dataset_key_for_file(item["filename"])
            cursor.execute(RELEASE_SQL, (item["raw_sha256"], item["raw_sha256"], dataset_key))
            release = cursor.fetchone()
            if release is None:
                raise ChowQaError(f"source dataset is not registered: {dataset_key}")
            cursor.execute(
                RAW_OBJECT_SQL,
                (
                    release[0],
                    item["raw_sha256"],
                    item["filename"],
                    item["byte_size"],
                    item["raw_sha256"],
                ),
            )
            raw_object = cursor.fetchone()
            cursor.execute(
                INGEST_RUN_SQL,
                (
                    release[0],
                    TRANSFORMATION_VERSION,
                    item["rows"],
                    item["rows"],
                    _json(
                        {
                            "rows": item["rows"],
                            "decoding": item["decoding"],
                            "dataset_key": dataset_key,
                        }
                    ),
                ),
            )
            ingest_run = cursor.fetchone()
            if raw_object is None or ingest_run is None:
                raise ChowQaError(f"provenance insert failed for {item['filename']}")
            provenance[item["filename"]] = (str(release[0]), str(raw_object[0]), str(ingest_run[0]))
        for event in plan.events:
            filename = event.source_record_locator.split("#", 1)[0]
            release_id, raw_object_id, ingest_run_id = provenance[filename]
            cursor.execute(
                EVENT_UPSERT_SQL,
                event_upsert_params(
                    event,
                    release_id=release_id,
                    raw_object_id=raw_object_id,
                    ingest_run_id=ingest_run_id,
                ),
            )
        cursor.execute(
            NOT_SEEN_SQL,
            (list(EVENT_DATASETS), [event.event_natural_key for event in plan.events]),
        )
        not_seen = cursor.rowcount if cursor.rowcount and cursor.rowcount > 0 else 0
        for owner in plan.owners:
            filename = owner.source_record_locator.split("#", 1)[0]
            release_id, raw_object_id, ingest_run_id = provenance[filename]
            cursor.execute(
                OWNER_UPSERT_SQL,
                owner_upsert_params(
                    owner,
                    release_id=release_id,
                    raw_object_id=raw_object_id,
                    ingest_run_id=ingest_run_id,
                ),
            )
        return len(plan.events) + len(plan.owners), not_seen
    finally:
        close = getattr(cursor, "close", None)
        if close:
            close()


def apply_chow_plan(
    plan: ChowPlan,
    *,
    write: bool = False,
    dry_run_reviewed: bool = False,
    connection: Any = None,
) -> dict[str, Any]:
    """Return a count summary. The default path performs no database work."""
    summary = plan.summary()
    summary["dry_run"] = not write
    summary["writes"] = 0
    summary["not_seen_updates"] = 0
    if not plan.passed:
        if write:
            raise ChowQaError("QA failed; refusing write")
        return summary
    if not plan.events:
        if write:
            raise ChowQaError("empty event file; refusing not-seen marking and write")
        return summary
    if not write:
        return summary
    if not dry_run_reviewed:
        raise ChowQaError("write requires an explicit dry-run review flag")
    if connection is None:
        raise ChowQaError("write requires an explicit database connection")
    writes, not_seen = _execute(connection, plan)
    summary["writes"] = writes
    summary["not_seen_updates"] = not_seen
    summary["dry_run"] = False
    return summary
