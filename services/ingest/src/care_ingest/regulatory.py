"""Strict normalization contracts for CMS nursing-home regulatory records."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .manifest import ReleaseManifest
from .provider_information import CCN_PATTERN, SchemaDriftError

INSPECTIONS_KEY = "nursing-home-inspection-dates"
DEFICIENCIES_KEY = "nursing-home-health-deficiencies"
PENALTIES_KEY = "nursing-home-penalties"
TRANSFORMATION_VERSIONS = {
    INSPECTIONS_KEY: "inspection-dates-v1",
    DEFICIENCIES_KEY: "health-deficiencies-v1",
    PENALTIES_KEY: "penalties-v1",
}

REQUIRED_COLUMNS = {
    INSPECTIONS_KEY: frozenset(
        {
            "CMS Certification Number (CCN)",
            "Survey Date",
            "Type of Survey",
            "Survey Cycle",
            "Processing Date",
        }
    ),
    DEFICIENCIES_KEY: frozenset(
        {
            "CMS Certification Number (CCN)",
            "Survey Date",
            "Survey Type",
            "Deficiency Prefix",
            "Deficiency Category",
            "Deficiency Tag Number",
            "Deficiency Description",
            "Scope Severity Code",
            "Deficiency Corrected",
            "Correction Date",
            "Inspection Cycle",
            "Standard Deficiency",
            "Complaint Deficiency",
            "Infection Control Inspection Deficiency",
            "Citation under IDR",
            "Citation under IIDR",
            "Processing Date",
        }
    ),
    PENALTIES_KEY: frozenset(
        {
            "CMS Certification Number (CCN)",
            "Penalty Date",
            "Penalty Type",
            "Fine ID",
            "Fine Amount",
            "Payment Denial Start Date",
            "Payment Denial Length in Days",
            "Processing Date",
        }
    ),
}


@dataclass(frozen=True, slots=True)
class ScopeSeverity:
    code: str
    scope: str
    severity: str
    severity_level: int
    immediate_jeopardy: bool


_SCOPES = ("Isolated", "Pattern", "Widespread")
_SEVERITIES = (
    ("No actual harm with potential for minimal harm", 1, False, "ABC"),
    (
        "No actual harm with potential for more than minimal harm that is not immediate jeopardy",
        2,
        False,
        "DEF",
    ),
    ("Actual harm that is not immediate jeopardy", 3, False, "GHI"),
    ("Immediate jeopardy to resident health or safety", 4, True, "JKL"),
)
SCOPE_SEVERITY = {
    code: ScopeSeverity(code, _SCOPES[index], label, level, immediate)
    for label, level, immediate, codes in _SEVERITIES
    for index, code in enumerate(codes)
}


@dataclass(slots=True)
class RegulatorySummary:
    dataset_key: str
    release: str | None
    checksum: str
    transformation_version: str
    rows_read: int = 0
    normalized_rows: int = 0
    rejected_rows: int = 0
    duplicate_records: int = 0
    unique_providers: int = 0
    unmatched_providers: int = 0
    date_min: str | None = None
    date_max: str | None = None
    warnings: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _text(value: str | None) -> str | None:
    value = value.strip() if value else ""
    return value or None


def _date(value: str | None, field: str, *, required: bool = False) -> str | None:
    value = _text(value)
    if value is None:
        if required:
            raise ValueError(f"missing {field}")
        return None
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError as error:
        raise ValueError(f"invalid {field}: {value!r}") from error


def _integer(value: str | None, field: str, *, required: bool = False) -> int | None:
    value = _text(value)
    if value is None:
        if required:
            raise ValueError(f"missing {field}")
        return None
    try:
        parsed = int(value)
    except ValueError as error:
        raise ValueError(f"invalid {field}: {value!r}") from error
    if parsed < 0:
        raise ValueError(f"{field} cannot be negative")
    return parsed


def _yes_no(value: str | None, field: str) -> bool | None:
    value = _text(value)
    if value is None:
        return None
    if value not in {"Y", "N"}:
        raise ValueError(f"invalid {field}: {value!r}")
    return value == "Y"


def _money(value: str | None) -> str | None:
    value = _text(value)
    if value is None:
        return None
    try:
        parsed = Decimal(value)
    except InvalidOperation as error:
        raise ValueError(f"invalid Fine Amount: {value!r}") from error
    if parsed < 0:
        raise ValueError("Fine Amount cannot be negative")
    return format(parsed.quantize(Decimal("0.01")), "f")


def _key(*parts: object) -> str:
    canonical = "\x1f".join("" if part is None else str(part) for part in parts)
    return hashlib.sha256(canonical.encode()).hexdigest()


def inspection_event_key(ccn: str, survey_date: str, survey_type: str, cycle: int) -> str:
    return _key(ccn, survey_date, survey_type, cycle)


def _base(row: dict[str, str | None], row_number: int, manifest: ReleaseManifest) -> dict[str, Any]:
    ccn = (_text(row.get("CMS Certification Number (CCN)")) or "").upper()
    if not CCN_PATTERN.fullmatch(ccn):
        raise ValueError(f"invalid CMS CCN: {ccn!r}")
    return {
        "ccn": ccn,
        "source_record_locator": f"csv-row:{row_number}:ccn:{ccn}",
        "source_release": {
            "dataset_key": manifest.dataset_key,
            "release_date": manifest.source_release_date,
            "sha256": manifest.sha256,
            "transformation_version": TRANSFORMATION_VERSIONS[manifest.dataset_key],
        },
        "raw": dict(row),
    }


def normalize_regulatory_row(
    row: dict[str, str | None], row_number: int, manifest: ReleaseManifest
) -> dict[str, Any]:
    base = _base(row, row_number, manifest)
    ccn = base["ccn"]
    if manifest.dataset_key == INSPECTIONS_KEY:
        survey_date = _date(row.get("Survey Date"), "Survey Date", required=True)
        survey_type = _text(row.get("Type of Survey"))
        cycle = _integer(row.get("Survey Cycle"), "Survey Cycle", required=True)
        if not survey_type:
            raise ValueError("missing Type of Survey")
        normalized = {
            "event_key": inspection_event_key(ccn, survey_date, survey_type, cycle),
            "survey_date": survey_date,
            "survey_type": survey_type,
            "survey_cycle": cycle,
            "processing_date": _date(row.get("Processing Date"), "Processing Date"),
        }
    elif manifest.dataset_key == DEFICIENCIES_KEY:
        survey_date = _date(row.get("Survey Date"), "Survey Date", required=True)
        prefix = _text(row.get("Deficiency Prefix"))
        tag = _text(row.get("Deficiency Tag Number"))
        code = (_text(row.get("Scope Severity Code")) or "").upper()
        if not prefix or not tag or not re.fullmatch(r"\d{4}", tag):
            raise ValueError("deficiency prefix and four-digit tag are required")
        if code not in SCOPE_SEVERITY:
            raise ValueError(f"unknown CMS scope/severity code: {code!r}")
        normalized = {
            "finding_key": _key(
                ccn,
                survey_date,
                row.get("Survey Type"),
                prefix,
                tag,
                code,
                row.get("Standard Deficiency"),
                row.get("Complaint Deficiency"),
                row.get("Infection Control Inspection Deficiency"),
                row.get("Correction Date"),
            ),
            "survey_date": survey_date,
            "survey_type": _text(row.get("Survey Type")),
            "deficiency_prefix": prefix,
            "deficiency_tag": tag,
            "deficiency_category": _text(row.get("Deficiency Category")),
            "official_description": _text(row.get("Deficiency Description")),
            "scope_severity_code": code,
            "deficiency_corrected": _text(row.get("Deficiency Corrected")),
            "correction_date": _date(row.get("Correction Date"), "Correction Date"),
            "inspection_cycle": _integer(
                row.get("Inspection Cycle"), "Inspection Cycle", required=True
            ),
            "standard": _yes_no(row.get("Standard Deficiency"), "Standard Deficiency"),
            "complaint": _yes_no(row.get("Complaint Deficiency"), "Complaint Deficiency"),
            "infection_control": _yes_no(
                row.get("Infection Control Inspection Deficiency"),
                "Infection Control Inspection Deficiency",
            ),
            "under_idr": _yes_no(row.get("Citation under IDR"), "Citation under IDR"),
            "under_iidr": _yes_no(row.get("Citation under IIDR"), "Citation under IIDR"),
            "processing_date": _date(row.get("Processing Date"), "Processing Date"),
        }
    elif manifest.dataset_key == PENALTIES_KEY:
        penalty_date = _date(row.get("Penalty Date"), "Penalty Date", required=True)
        penalty_type = _text(row.get("Penalty Type"))
        if penalty_type not in {"Fine", "Payment Denial"}:
            raise ValueError(f"unknown Penalty Type: {penalty_type!r}")
        amount = _money(row.get("Fine Amount"))
        denial_days = _integer(
            row.get("Payment Denial Length in Days"), "Payment Denial Length in Days"
        )
        if penalty_type == "Fine" and amount is None:
            raise ValueError("Fine record is missing Fine Amount")
        normalized = {
            "penalty_key": _key(
                ccn,
                penalty_date,
                penalty_type,
                row.get("Fine ID"),
                amount,
                row.get("Payment Denial Start Date"),
                denial_days,
            ),
            "penalty_date": penalty_date,
            "penalty_type": penalty_type,
            "fine_id": _text(row.get("Fine ID")),
            "fine_amount": amount,
            "payment_denial_start_date": _date(
                row.get("Payment Denial Start Date"), "Payment Denial Start Date"
            ),
            "payment_denial_days": denial_days,
            "processing_date": _date(row.get("Processing Date"), "Processing Date"),
        }
    else:
        raise ValueError(f"unsupported regulatory dataset: {manifest.dataset_key}")
    return {**base, "normalized": normalized}


def verify_regulatory_schema(dataset_key: str, fieldnames: list[str] | None) -> list[str]:
    if not fieldnames:
        raise SchemaDriftError("CSV has no header row")
    missing = sorted(REQUIRED_COLUMNS[dataset_key] - set(fieldnames))
    if missing:
        raise SchemaDriftError(f"required CMS columns missing or renamed: {', '.join(missing)}")
    return sorted(set(fieldnames) - REQUIRED_COLUMNS[dataset_key])


def ingest_regulatory_source(
    source_file: Path, manifest: ReleaseManifest, data_root: Path, *, write_outputs: bool = True
) -> RegulatorySummary:
    version = TRANSFORMATION_VERSIONS[manifest.dataset_key]
    summary = RegulatorySummary(
        manifest.dataset_key, manifest.source_release_date, manifest.sha256, version
    )
    release = manifest.source_release_date or manifest.sha256
    normalized_dir = data_root.resolve() / "normalized" / "cms" / manifest.dataset_key / release
    rejected_dir = data_root.resolve() / "rejected" / "cms" / manifest.dataset_key / release
    report_dir = data_root.resolve() / "reports" / "cms" / manifest.dataset_key / release
    if write_outputs:
        for destination in (normalized_dir, rejected_dir, report_dir):
            destination.mkdir(parents=True, exist_ok=True)
    normalized_path = normalized_dir / "records.jsonl"
    rejected_path = rejected_dir / "rejected.jsonl"
    normalized_handle = (
        normalized_path.open("w", encoding="utf-8", newline="\n") if write_outputs else None
    )
    rejected_handle = (
        rejected_path.open("w", encoding="utf-8", newline="\n") if write_outputs else None
    )
    providers: set[str] = set()
    keys: set[str] = set()
    dates: list[str] = []
    try:
        with source_file.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            unexpected = verify_regulatory_schema(manifest.dataset_key, reader.fieldnames)
            if unexpected:
                summary.warnings.append(
                    f"{len(unexpected)} additional columns preserved in raw records"
                )
            for row in reader:
                summary.rows_read += 1
                try:
                    record = normalize_regulatory_row(row, reader.line_num, manifest)
                    normalized = record["normalized"]
                    key = (
                        normalized.get("event_key")
                        or normalized.get("finding_key")
                        or normalized["penalty_key"]
                    )
                    if key in keys:
                        summary.duplicate_records += 1
                        raise ValueError("duplicate deterministic record key within release")
                    keys.add(key)
                    providers.add(record["ccn"])
                    dates.append(normalized.get("survey_date") or normalized["penalty_date"])
                    summary.normalized_rows += 1
                    if normalized_handle:
                        normalized_handle.write(json.dumps(record, sort_keys=True) + "\n")
                except ValueError as error:
                    summary.rejected_rows += 1
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
    summary.unique_providers = len(providers)
    if dates:
        summary.date_min, summary.date_max = min(dates), max(dates)
    if write_outputs:
        (report_dir / "summary.json").write_text(summary.to_json(), encoding="utf-8")
    return summary
