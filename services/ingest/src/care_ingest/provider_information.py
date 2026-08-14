"""Validated normalization for CMS Nursing Home Provider Information."""

from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .archive import RawArchive
from .manifest import ReleaseManifest

TRANSFORMATION_VERSION = "provider-information-v1"
# CMS publishes both numeric and letter-bearing six-character CCNs. Preserve the
# authoritative identifier exactly; names are never used as provider identity.
CCN_PATTERN = re.compile(r"^[0-9A-Z]{6}$")
ZIP_PATTERN = re.compile(r"^[0-9]{5}(?:-[0-9]{4})?$")
STATE_CODES = frozenset(
    "AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE "
    "NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI".split()
)

REQUIRED_COLUMNS = frozenset(
    {
        "CMS Certification Number (CCN)",
        "Provider Name",
        "Provider Address",
        "City/Town",
        "State",
        "ZIP Code",
        "Ownership Type",
        "Number of Certified Beds",
        "Provider Type",
        "Processing Date",
    }
)
OPTIONAL_COLUMNS = frozenset(
    {
        "Telephone Number",
        "County/Parish",
        "Legal Business Name",
        "Overall Rating",
        "Health Inspection Rating",
        "QM Rating",
        "Staffing Rating",
        "Latitude",
        "Longitude",
        "Provider Changed Ownership in Last 12 Months",
        "Date First Approved to Provide Medicare and Medicaid Services",
    }
)


class SchemaDriftError(ValueError):
    """Raised when required CMS fields disappear or are renamed."""


@dataclass(slots=True)
class IngestSummary:
    dataset_key: str
    source_release: str | None
    checksum: str
    retrieval_time: str
    transformation_version: str
    total_rows_read: int = 0
    valid_rows: int = 0
    rejected_rows: int = 0
    duplicate_provider_identifiers: int = 0
    missing_critical_identifiers: int = 0
    states_represented: list[str] = field(default_factory=list)
    normalized_provider_count: int = 0
    warnings: list[str] = field(default_factory=list)
    completed_at: str | None = None

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def verify_schema(fieldnames: list[str] | None) -> list[str]:
    if not fieldnames:
        raise SchemaDriftError("CSV has no header row")
    present = set(fieldnames)
    missing = sorted(REQUIRED_COLUMNS - present)
    if missing:
        raise SchemaDriftError(f"required CMS columns missing or renamed: {', '.join(missing)}")
    return sorted(present - REQUIRED_COLUMNS - OPTIONAL_COLUMNS)


def source_record_locator(row_number: int, ccn: str) -> str:
    if row_number < 2 or not CCN_PATTERN.fullmatch(ccn):
        raise ValueError("source locator requires a CSV data-row number and valid CCN")
    return f"csv-row:{row_number}:ccn:{ccn}"


def _optional_text(value: str | None) -> str | None:
    if value is None or value.strip() == "":
        return None
    return value.strip()


def _integer(value: str | None, field_name: str) -> int | None:
    cleaned = _optional_text(value)
    if cleaned is None:
        return None
    try:
        parsed = int(cleaned)
    except ValueError as error:
        raise ValueError(f"{field_name} is not an integer: {cleaned!r}") from error
    if parsed < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return parsed


def _decimal(value: str | None, field_name: str, minimum: float, maximum: float) -> float | None:
    cleaned = _optional_text(value)
    if cleaned is None:
        return None
    try:
        parsed = float(cleaned)
    except ValueError as error:
        raise ValueError(f"{field_name} is not numeric: {cleaned!r}") from error
    if not minimum <= parsed <= maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}")
    return parsed


def normalize_row(
    row: dict[str, str | None], row_number: int, manifest: ReleaseManifest
) -> dict[str, Any]:
    ccn = (row.get("CMS Certification Number (CCN)") or "").strip()
    if not ccn:
        raise ValueError("missing CMS Certification Number (CCN)")
    if not CCN_PATTERN.fullmatch(ccn):
        raise ValueError(f"CCN does not match the six-character CMS shape: {ccn!r}")
    name = (row.get("Provider Name") or "").strip()
    if not name:
        raise ValueError("missing Provider Name")
    state = (row.get("State") or "").strip().upper()
    if state not in STATE_CODES:
        raise ValueError(f"invalid state or territory code: {state!r}")
    raw_zip = (row.get("ZIP Code") or "").strip()
    if not ZIP_PATTERN.fullmatch(raw_zip):
        raise ValueError(f"invalid ZIP Code shape: {raw_zip!r}")

    ratings = {
        key: _integer(row.get(column), column)
        for key, column in {
            "overall": "Overall Rating",
            "health_inspection": "Health Inspection Rating",
            "quality_measure": "QM Rating",
            "staffing": "Staffing Rating",
        }.items()
    }
    for key, value in ratings.items():
        if value is not None and not 1 <= value <= 5:
            raise ValueError(f"{key} rating must be between 1 and 5")

    latitude = _decimal(row.get("Latitude"), "Latitude", -90, 90)
    longitude = _decimal(row.get("Longitude"), "Longitude", -180, 180)
    return {
        "provider_identity": {"issuer": "CMS", "type": "CCN", "value": ccn},
        "source_record_locator": source_record_locator(row_number, ccn),
        "source_release": {
            "dataset_key": manifest.dataset_key,
            "release_date": manifest.source_release_date,
            "sha256": manifest.sha256,
            "retrieved_at": manifest.retrieval_timestamp,
            "transformation_version": TRANSFORMATION_VERSION,
        },
        "normalized": {
            "provider_name": name,
            "legal_business_name": _optional_text(row.get("Legal Business Name")),
            "address": _optional_text(row.get("Provider Address")),
            "city": _optional_text(row.get("City/Town")),
            "state": state,
            "zip_code": raw_zip[:5],
            "county": _optional_text(row.get("County/Parish")),
            "telephone": _optional_text(row.get("Telephone Number")),
            "ownership_type": _optional_text(row.get("Ownership Type")),
            "certified_beds": _integer(
                row.get("Number of Certified Beds"), "Number of Certified Beds"
            ),
            "provider_type": _optional_text(row.get("Provider Type")),
            "first_approved_date": _optional_text(
                row.get("Date First Approved to Provide Medicare and Medicaid Services")
            ),
            "changed_ownership_last_12_months": _optional_text(
                row.get("Provider Changed Ownership in Last 12 Months")
            ),
            "ratings": ratings,
            "latitude": latitude,
            "longitude": longitude,
            "source_processing_date": _optional_text(row.get("Processing Date")),
        },
        "raw": dict(row),
    }


def ingest_provider_information(
    source_file: Path,
    manifest: ReleaseManifest,
    data_root: Path,
    *,
    write_outputs: bool = True,
) -> IngestSummary:
    summary = IngestSummary(
        dataset_key=manifest.dataset_key,
        source_release=manifest.source_release_date,
        checksum=manifest.sha256,
        retrieval_time=manifest.retrieval_timestamp,
        transformation_version=TRANSFORMATION_VERSION,
    )
    release_key = manifest.source_release_date or "unknown"
    normalized_dir = data_root.resolve() / "normalized" / "cms" / manifest.dataset_key / release_key
    rejected_dir = data_root.resolve() / "rejected" / "cms" / manifest.dataset_key / release_key
    report_dir = data_root.resolve() / "reports" / "cms" / manifest.dataset_key / release_key
    for destination in (normalized_dir, rejected_dir, report_dir):
        if data_root.resolve() not in destination.parents:
            raise ValueError("ingest output escaped configured data root")
        if write_outputs:
            destination.mkdir(parents=True, exist_ok=True)

    normalized_path = normalized_dir / "providers.jsonl"
    rejected_path = rejected_dir / "rejected.jsonl"
    normalized_handle = (
        normalized_path.open("w", encoding="utf-8", newline="\n") if write_outputs else None
    )
    rejected_handle = (
        rejected_path.open("w", encoding="utf-8", newline="\n") if write_outputs else None
    )
    seen: set[str] = set()
    states: set[str] = set()
    try:
        with source_file.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            unexpected = verify_schema(reader.fieldnames)
            if unexpected:
                summary.warnings.append(
                    f"{len(unexpected)} additional columns preserved in raw records "
                    "and not normalized"
                )
            for row in reader:
                summary.total_rows_read += 1
                try:
                    normalized = normalize_row(row, reader.line_num, manifest)
                    ccn = normalized["provider_identity"]["value"]
                    if ccn in seen:
                        summary.duplicate_provider_identifiers += 1
                        raise ValueError(f"duplicate CCN within release: {ccn}")
                    seen.add(ccn)
                    states.add(normalized["normalized"]["state"])
                    summary.valid_rows += 1
                    if normalized_handle:
                        normalized_handle.write(json.dumps(normalized, sort_keys=True) + "\n")
                except ValueError as error:
                    summary.rejected_rows += 1
                    if "missing CMS Certification" in str(error):
                        summary.missing_critical_identifiers += 1
                    if rejected_handle:
                        rejected_handle.write(
                            json.dumps(
                                {
                                    "source_row_number": reader.line_num,
                                    "reason": str(error),
                                    "raw": row,
                                },
                                sort_keys=True,
                            )
                            + "\n"
                        )
    finally:
        if normalized_handle:
            normalized_handle.close()
        if rejected_handle:
            rejected_handle.close()

    summary.states_represented = sorted(states)
    summary.normalized_provider_count = len(seen)
    summary.completed_at = datetime.now(UTC).isoformat()
    if summary.rejected_rows:
        summary.warnings.append(
            f"{summary.rejected_rows} rejected rows were preserved for diagnosis"
        )
    if write_outputs:
        (report_dir / "summary.json").write_text(summary.to_json(), encoding="utf-8", newline="\n")
        RawArchive(data_root).update_status(
            source_file.parent / "manifest.json", "ingested", TRANSFORMATION_VERSION
        )
    return summary
