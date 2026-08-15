"""Strict normalization and documented calculations for CMS PBJ nurse staffing."""

from __future__ import annotations

import csv
import hashlib
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .manifest import ReleaseManifest
from .provider_information import CCN_PATTERN, SchemaDriftError

PBJ_NURSE_KEY = "payroll-based-journal-daily-nurse-staffing"
TRANSFORMATION_VERSION = "pbj-daily-nurse-v1"

CATEGORY_FIELDS = {
    "rn_don": "Hrs_RNDON",
    "rn_admin": "Hrs_RNadmin",
    "rn": "Hrs_RN",
    "lpn_admin": "Hrs_LPNadmin",
    "lpn": "Hrs_LPN",
    "cna": "Hrs_CNA",
    "nurse_aide_training": "Hrs_NAtrn",
    "medication_aide": "Hrs_MedAide",
}
NURSE_HOUR_FIELDS = tuple(
    field for base in CATEGORY_FIELDS.values() for field in (base, f"{base}_emp", f"{base}_ctr")
)
IDENTITY_FIELDS = (
    "PROVNUM",
    "PROVNAME",
    "CITY",
    "STATE",
    "COUNTY_NAME",
    "COUNTY_FIPS",
    "CY_Qtr",
    "WorkDate",
    "MDScensus",
)
REQUIRED_COLUMNS = frozenset((*IDENTITY_FIELDS, *NURSE_HOUR_FIELDS))


@dataclass(slots=True)
class PbjSummary:
    dataset_key: str
    release: str | None
    source_period: str | None
    checksum: str
    transformation_version: str = TRANSFORMATION_VERSION
    source_rows: int = 0
    normalized_rows: int = 0
    rejected_rows: int = 0
    duplicate_provider_days: int = 0
    unique_providers: int = 0
    alphanumeric_ccns: int = 0
    date_min: str | None = None
    date_max: str | None = None
    missing_census: int = 0
    zero_census: int = 0
    negative_census_rows: int = 0
    missing_hour_values: int = 0
    negative_hour_rows: int = 0
    quarter_mismatch_rows: int = 0
    providers_with_incomplete_quarters: int = 0
    warnings: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _text(value: str | None) -> str | None:
    cleaned = value.strip() if value else ""
    return cleaned or None


def _decimal(value: str | None, field_name: str) -> str | None:
    cleaned = _text(value)
    if cleaned is None:
        return None
    try:
        parsed = Decimal(cleaned)
    except InvalidOperation as error:
        raise ValueError(f"invalid {field_name}: {cleaned!r}") from error
    if not parsed.is_finite():
        raise ValueError(f"invalid {field_name}: {cleaned!r}")
    if parsed < 0:
        raise ValueError(f"negative {field_name}: {cleaned!r}")
    return format(parsed, "f")


def _quarter_bounds(quarter: str) -> tuple[date, date]:
    match = re.fullmatch(r"(20\d{2})Q([1-4])", quarter)
    if not match:
        raise ValueError(f"invalid CY_Qtr: {quarter!r}")
    year, number = int(match.group(1)), int(match.group(2))
    start_month = (number - 1) * 3 + 1
    start = date(year, start_month, 1)
    end_month = start_month + 2
    end = date(year, end_month + 1, 1) if end_month < 12 else date(year + 1, 1, 1)
    return start, date.fromordinal(end.toordinal() - 1)


def _work_date(value: str | None) -> date:
    cleaned = _text(value)
    if cleaned is None:
        raise ValueError("missing WorkDate")
    try:
        return datetime.strptime(cleaned, "%Y%m%d").date()
    except ValueError as error:
        raise ValueError(f"invalid WorkDate: {cleaned!r}") from error


def daily_identity(ccn: str, work_date: str) -> str:
    """Stable identity inside one immutable source release."""
    return hashlib.sha256(f"{ccn}\x1f{work_date}".encode()).hexdigest()


def verify_pbj_schema(fieldnames: list[str] | None) -> list[str]:
    if not fieldnames:
        raise SchemaDriftError("PBJ source has no header")
    missing = sorted(REQUIRED_COLUMNS - set(fieldnames))
    if missing:
        raise SchemaDriftError(f"PBJ schema missing required columns: {', '.join(missing)}")
    return sorted(set(fieldnames) - REQUIRED_COLUMNS)


def normalize_pbj_row(
    row: dict[str, str | None], row_number: int, manifest: ReleaseManifest
) -> dict[str, Any]:
    ccn = (_text(row.get("PROVNUM")) or "").upper()
    if not CCN_PATTERN.fullmatch(ccn):
        raise ValueError(f"invalid CMS CCN: {ccn!r}")
    quarter = _text(row.get("CY_Qtr"))
    if quarter is None:
        raise ValueError("missing CY_Qtr")
    quarter_start, quarter_end = _quarter_bounds(quarter)
    work_date = _work_date(row.get("WorkDate"))
    if not quarter_start <= work_date <= quarter_end:
        raise ValueError(f"WorkDate {work_date} is outside {quarter}")
    if manifest.source_period and quarter != manifest.source_period:
        raise ValueError(f"row quarter {quarter} does not match release {manifest.source_period}")
    census_text = _text(row.get("MDScensus"))
    census = None
    if census_text is not None:
        try:
            census = int(census_text)
        except ValueError as error:
            raise ValueError(f"invalid MDScensus: {census_text!r}") from error
        if census < 0:
            raise ValueError(f"negative MDScensus: {census_text!r}")
    hours = {field: _decimal(row.get(field), field) for field in NURSE_HOUR_FIELDS}
    work_date_iso = work_date.isoformat()
    return {
        "ccn": ccn,
        "source_record_locator": f"csv-row:{row_number}:ccn:{ccn}:date:{work_date_iso}",
        "source_release": {
            "dataset_key": manifest.dataset_key,
            "release_date": manifest.source_release_date,
            "source_period": manifest.source_period,
            "source_version_identifier": manifest.source_version_identifier,
            "sha256": manifest.sha256,
            "transformation_version": TRANSFORMATION_VERSION,
        },
        "normalized": {
            "daily_key": daily_identity(ccn, work_date_iso),
            "quarter": quarter,
            "work_date": work_date_iso,
            "resident_census": census,
            "hours": hours,
        },
        "raw": dict(row),
    }


def ingest_pbj_source(
    source_file: Path,
    manifest: ReleaseManifest,
    data_root: Path,
    *,
    write_outputs: bool = True,
) -> PbjSummary:
    if manifest.dataset_key != PBJ_NURSE_KEY:
        raise ValueError(f"unsupported PBJ dataset: {manifest.dataset_key}")
    summary = PbjSummary(
        dataset_key=manifest.dataset_key,
        release=manifest.source_release_date,
        source_period=manifest.source_period,
        checksum=manifest.sha256,
    )
    release_key = manifest.source_release_date or manifest.sha256
    normalized_dir = data_root / "normalized" / "cms" / manifest.dataset_key / release_key
    rejected_dir = data_root / "rejected" / "cms" / manifest.dataset_key / release_key
    report_dir = data_root / "reports" / "cms" / manifest.dataset_key / release_key
    if write_outputs:
        normalized_dir.mkdir(parents=True, exist_ok=True)
        rejected_dir.mkdir(parents=True, exist_ok=True)
        report_dir.mkdir(parents=True, exist_ok=True)
    normalized_handle = (
        (normalized_dir / "records.jsonl").open("w", encoding="utf-8", newline="\n")
        if write_outputs
        else None
    )
    rejected_handle = (
        (rejected_dir / "records.jsonl").open("w", encoding="utf-8", newline="\n")
        if write_outputs
        else None
    )
    identities: set[str] = set()
    providers: set[str] = set()
    alphanumeric_providers: set[str] = set()
    provider_dates: dict[str, set[str]] = {}
    dates: list[str] = []
    try:
        with source_file.open("r", encoding="cp1252", newline="") as handle:
            reader = csv.DictReader(handle)
            unexpected = verify_pbj_schema(reader.fieldnames)
            if unexpected:
                summary.warnings.append(
                    f"{len(unexpected)} additional columns preserved in raw records"
                )
            for row in reader:
                summary.source_rows += 1
                try:
                    record = normalize_pbj_row(row, reader.line_num, manifest)
                    normalized = record["normalized"]
                    key = normalized["daily_key"]
                    if key in identities:
                        summary.duplicate_provider_days += 1
                        raise ValueError("duplicate CCN/work-date identity within release")
                    identities.add(key)
                    providers.add(record["ccn"])
                    if any(char.isalpha() for char in record["ccn"]):
                        alphanumeric_providers.add(record["ccn"])
                    provider_dates.setdefault(record["ccn"], set()).add(normalized["work_date"])
                    dates.append(normalized["work_date"])
                    census = normalized["resident_census"]
                    summary.missing_census += census is None
                    summary.zero_census += census == 0
                    summary.missing_hour_values += sum(
                        value is None for value in normalized["hours"].values()
                    )
                    summary.normalized_rows += 1
                    if normalized_handle:
                        normalized_handle.write(json.dumps(record, sort_keys=True) + "\n")
                except ValueError as error:
                    message = str(error)
                    summary.negative_census_rows += message.startswith("negative MDScensus")
                    summary.negative_hour_rows += message.startswith("negative Hrs_")
                    summary.quarter_mismatch_rows += (
                        "outside" in message or "row quarter" in message
                    )
                    summary.rejected_rows += 1
                    if rejected_handle:
                        rejected_handle.write(
                            json.dumps(
                                {
                                    "source_row_number": reader.line_num,
                                    "reason": message,
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
    summary.alphanumeric_ccns = len(alphanumeric_providers)
    if manifest.source_period:
        quarter_start, quarter_end = _quarter_bounds(manifest.source_period)
        expected_days = quarter_end.toordinal() - quarter_start.toordinal() + 1
        summary.providers_with_incomplete_quarters = sum(
            len(observed_dates) != expected_days for observed_dates in provider_dates.values()
        )
    if dates:
        summary.date_min, summary.date_max = min(dates), max(dates)
    if write_outputs:
        (report_dir / "summary.json").write_text(summary.to_json(), encoding="utf-8")
    return summary
