"""Shared CMS download → validate → ingest → load → derive path for refresh writes."""

from __future__ import annotations

import csv
import logging
from collections.abc import Callable
from dataclasses import asdict
from pathlib import Path
from typing import Any

from .chain import CHAIN_KEY, ingest_chain_source
from .chain_database import load_chain_membership, load_chain_source
from .cms_designations import derive_cms_designations
from .database import load_provider_information
from .directory_status import derive_agency_directory_status, derive_directory_status
from .downloader import download_source
from .facility_npi import derive_facility_npi
from .mds import MDS_KEY, ingest_mds_source
from .mds_database import load_mds_source
from .ownership import OWNERSHIP_KEYS, ingest_ownership_source
from .ownership_database import load_ownership_source
from .pbj import PBJ_NURSE_KEY, ingest_pbj_source
from .pbj_database import load_pbj_source
from .post_acute import POST_ACUTE_KEYS, ingest_post_acute_source, required_columns_for_post_acute
from .post_acute_database import load_post_acute_source
from .provider_information import SchemaDriftError, ingest_provider_information
from .refresh_policy import program_for, row_count_violation
from .registry import get_source
from .regulatory import (
    DEFICIENCIES_KEY,
    FIRE_KEY,
    INSPECTIONS_KEY,
    PENALTIES_KEY,
    ingest_regulatory_source,
)
from .regulatory_database import load_regulatory_source

LOGGER = logging.getLogger(__name__)
PROVIDER_INFORMATION_KEY = "nursing-home-provider-information"
ENROLLMENTS_KEY = "skilled-nursing-facility-enrollments"
REGULATORY_KEYS = (INSPECTIONS_KEY, DEFICIENCIES_KEY, PENALTIES_KEY, FIRE_KEY)
LARGE_SOURCES = frozenset(
    {
        MDS_KEY,
        FIRE_KEY,
        PBJ_NURSE_KEY,
        DEFICIENCIES_KEY,
        "hospice-provider-data",
        "hospice-provider-cahps",
        "home-health-zip-codes",
        "home-health-agency-all-owners",
        "hospice-all-owners",
    }
)

StatusFn = Callable[[str, dict[str, Any] | None], None]


def required_columns_for(dataset_key: str) -> set[str]:
    from .mds import REQUIRED_COLUMNS as MDS_COLUMNS
    from .pbj import REQUIRED_COLUMNS as PBJ_COLUMNS
    from .provider_information import REQUIRED_COLUMNS as PI_COLUMNS
    from .regulatory import REQUIRED_COLUMNS as REG_COLUMNS

    if dataset_key == PROVIDER_INFORMATION_KEY:
        return set(PI_COLUMNS)
    if dataset_key == MDS_KEY:
        return set(MDS_COLUMNS)
    if dataset_key == PBJ_NURSE_KEY:
        return set(PBJ_COLUMNS)
    if dataset_key == CHAIN_KEY:
        return {"Chain", "Chain ID", "Number of facilities"}
    if dataset_key in REG_COLUMNS:
        return set(REG_COLUMNS[dataset_key])
    if dataset_key == ENROLLMENTS_KEY:
        return {"CCN", "ASSOCIATE ID", "ENROLLMENT ID", "ORGANIZATION NAME", "NPI"}
    if dataset_key == "nursing-home-ownership":
        return {
            "CMS Certification Number (CCN)",
            "Owner Name",
            "Role played by Owner or Manager in Facility",
        }
    if dataset_key in {
        "skilled-nursing-facility-all-owners",
        "skilled-nursing-facility-change-of-ownership-owner-information",
    }:
        return {"ENROLLMENT ID", "ASSOCIATE ID - OWNER"}
    if dataset_key == "skilled-nursing-facility-change-of-ownership":
        return {"ASSOCIATE ID - BUYER", "ASSOCIATE ID - SELLER", "EFFECTIVE DATE"}
    post_acute = required_columns_for_post_acute(dataset_key)
    if post_acute:
        return post_acute
    if dataset_key in {
        "home-health-agency-enrollments",
        "hospice-enrollments",
    }:
        return {"CCN", "ASSOCIATE ID", "ENROLLMENT ID", "ORGANIZATION NAME", "NPI"}
    if dataset_key in {"home-health-agency-all-owners", "hospice-all-owners"}:
        return {"ENROLLMENT ID", "ASSOCIATE ID - OWNER"}
    return set()


def peek_csv_headers(path: Path) -> set[str]:
    for encoding in ("utf-8-sig", "cp1252"):
        try:
            with path.open("r", encoding=encoding, newline="") as handle:
                row = next(csv.reader(handle), [])
            return {name.strip() for name in row if name and name.strip()}
        except UnicodeDecodeError:
            continue
    raise SchemaDriftError(f"unable to read CSV header: {path}")


def _rows_read(summary: object) -> int:
    for attr in ("total_rows_read", "source_rows", "rows_read"):
        value = getattr(summary, attr, None)
        if value is not None:
            return int(value)
    return 0


def _ingest_function(dataset_key: str):
    if dataset_key == PROVIDER_INFORMATION_KEY:
        return ingest_provider_information
    if dataset_key == MDS_KEY:
        return ingest_mds_source
    if dataset_key == PBJ_NURSE_KEY:
        return ingest_pbj_source
    if dataset_key == CHAIN_KEY:
        return ingest_chain_source
    if dataset_key in OWNERSHIP_KEYS:
        return ingest_ownership_source
    if dataset_key in POST_ACUTE_KEYS:
        return ingest_post_acute_source
    if dataset_key in REGULATORY_KEYS:
        return ingest_regulatory_source
    raise KeyError(f"no ingest function for {dataset_key}")


def _load_function(dataset_key: str):
    if dataset_key == PROVIDER_INFORMATION_KEY:
        return load_provider_information
    if dataset_key == MDS_KEY:
        return load_mds_source
    if dataset_key == PBJ_NURSE_KEY:
        return load_pbj_source
    if dataset_key == CHAIN_KEY:
        return load_chain_source
    if dataset_key in OWNERSHIP_KEYS:
        return load_ownership_source
    if dataset_key in POST_ACUTE_KEYS:
        return load_post_acute_source
    if dataset_key in REGULATORY_KEYS:
        return load_regulatory_source
    raise KeyError(f"no load function for {dataset_key}")


def _normalized_path(data_root: Path, dataset_key: str, release: str) -> Path:
    name = "providers.jsonl" if dataset_key == PROVIDER_INFORMATION_KEY else "records.jsonl"
    return data_root / "normalized" / "cms" / dataset_key / release / name


def _align_catalog_modified(database_url: str, dataset_key: str, manifest) -> None:
    """Record a newer CMS catalog timestamp when the bytes did not change."""
    modified = manifest.source_modified_at or manifest.source_release_date
    if not modified:
        return
    import psycopg

    with psycopg.connect(database_url) as connection:
        connection.execute("SET statement_timeout = 0")
        with connection.transaction():
            connection.execute(
                """
                UPDATE source_release r
                SET source_modified_at = CAST(%s AS timestamptz)
                FROM source_dataset d
                WHERE d.id = r.source_dataset_id
                  AND d.dataset_key = %s
                  AND r.content_sha256 = %s
                  AND (r.source_modified_at IS NULL
                       OR r.source_modified_at < CAST(%s AS timestamptz))
                """,
                (modified, dataset_key, manifest.sha256, modified),
            )


def execute_source_write(
    dataset_key: str,
    *,
    data_root: Path,
    database_url: str,
    previous_row_count: int | None = None,
    previous_checksum: str | None = None,
    on_status: StatusFn | None = None,
) -> dict[str, Any]:
    """Download, fail-closed validate, ingest, load, and derive using existing importers."""
    spec = program_for(dataset_key)
    source = get_source(dataset_key)
    estimated = int(spec.get("estimated_bytes") or 0)
    if dataset_key in LARGE_SOURCES or estimated >= 50_000_000:
        LOGGER.warning(
            "large CMS ingest %s estimated_bytes=%s; COPY path, statement_timeout=0, "
            "do not delete historical evidence to free disk",
            dataset_key,
            estimated,
        )
    if on_status:
        on_status("FETCHED", {"estimated_bytes": estimated})
    timeout = 900 if dataset_key in LARGE_SOURCES or estimated >= 50_000_000 else 300
    path, manifest = download_source(source, data_root, timeout=timeout)
    if previous_checksum and manifest.sha256 == previous_checksum:
        _align_catalog_modified(database_url, dataset_key, manifest)
        return {
            "status": "NO_CHANGE",
            "checksum": manifest.sha256,
            "rows_read": 0,
            "rows_loaded": 0,
            "idempotent": True,
            "schema_ok": True,
            "capacity_ok": True,
            "note": "downloaded checksum matches last successful release",
        }
    headers = peek_csv_headers(path)
    required = required_columns_for(dataset_key)
    missing = sorted(required - headers)
    if missing:
        raise SchemaDriftError(
            "SCHEMA_DRIFT: " + "; ".join(f"missing required column: {name}" for name in missing)
        )
    if on_status:
        on_status("VALIDATED", {"checksum": manifest.sha256})
    ingest = _ingest_function(dataset_key)
    summary = ingest(path, manifest, data_root, write_outputs=True)
    rows = _rows_read(summary)
    violation = row_count_violation(
        rows,
        previous=previous_row_count,
        min_row_count=int(spec["min_row_count"]),
        max_drop_ratio=float(spec["max_drop_ratio"]),
    )
    if violation:
        raise ValueError("VALIDATION: " + violation)
    if on_status:
        on_status("INGESTING", {"rows_read": rows})
    release = manifest.source_release_date or manifest.sha256
    normalized = _normalized_path(data_root, dataset_key, release)
    load = _load_function(dataset_key)
    loaded = load(database_url, source, manifest, path, normalized)
    result: dict[str, Any] = {
        "status": "COMPLETE",
        "checksum": manifest.sha256,
        "rows_read": rows,
        "rows_loaded": rows,
        "idempotent": bool(getattr(loaded, "idempotent", False)),
        "schema_ok": True,
        "capacity_ok": True,
        "release_key": getattr(loaded, "release_key", release),
        "ingest_run_id": getattr(loaded, "ingest_run_id", None),
        "derives": [],
    }
    try:
        if dataset_key == PROVIDER_INFORMATION_KEY:
            result["derives"].append(
                {"name": "directory-status", **derive_directory_status(database_url)}
            )
            result["derives"].append(
                {"name": "cms-designations", **derive_cms_designations(database_url)}
            )
        elif dataset_key == ENROLLMENTS_KEY:
            result["derives"].append({"name": "facility-npi", **derive_facility_npi(database_url)})
            membership = asdict(load_chain_membership(database_url, source, manifest, path))
            membership["name"] = "chain-membership"
            result["derives"].append(membership)
        elif dataset_key in {"home-health-care-agencies", "hospice-general-information"}:
            result["derives"].append(
                {
                    "name": "agency-directory-status",
                    **derive_agency_directory_status(database_url, dataset_key),
                }
            )
        elif dataset_key in {"home-health-agency-enrollments", "hospice-enrollments"}:
            from .post_acute_database import derive_agency_npi

            result["derives"].append(
                {"name": "agency-npi", **derive_agency_npi(database_url, dataset_key)}
            )
    except Exception as error:  # noqa: BLE001
        result["status"] = "DATA_LOADED_DERIVE_FAILED"
        result["derive_error"] = str(error)
        LOGGER.exception("derive failed after successful load of %s", dataset_key)
    return result
