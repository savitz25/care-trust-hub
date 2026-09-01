"""Home Health and Hospice normalization. Distinct from nursing-home facilities."""

# ruff: noqa: E501

from __future__ import annotations

import csv
import json
import re
from dataclasses import asdict, dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .manifest import ReleaseManifest
from .provider_information import SchemaDriftError

HH_AGENCIES_KEY = "home-health-care-agencies"
HH_HHCAHPS_KEY = "home-health-patient-survey-hhcahps"
HH_ZIP_KEY = "home-health-zip-codes"
HOSPICE_GI_KEY = "hospice-general-information"
HOSPICE_QUALITY_KEY = "hospice-provider-data"
HOSPICE_CAHPS_KEY = "hospice-provider-cahps"
HOSPICE_ZIP_KEY = "hospice-zip-data"
POST_ACUTE_KEYS = (
    HH_AGENCIES_KEY,
    HH_HHCAHPS_KEY,
    HH_ZIP_KEY,
    HOSPICE_GI_KEY,
    HOSPICE_QUALITY_KEY,
    HOSPICE_CAHPS_KEY,
    HOSPICE_ZIP_KEY,
)
TRANSFORMATION_VERSION = "post-acute-v1"
CCN_PATTERN = re.compile(r"^[0-9A-Z]{6}$")

HH_AGENCY_REQUIRED = frozenset(
    {
        "CMS Certification Number (CCN)",
        "Provider Name",
        "State",
        "Offers Nursing Care Services",
        "Offers Physical Therapy Services",
        "Offers Occupational Therapy Services",
        "Offers Speech Pathology Services",
        "Offers Medical Social Services",
        "Offers Home Health Aide Services",
    }
)
HH_HHCAHPS_REQUIRED = frozenset({"CMS Certification Number (CCN)"})
ZIP_REQUIRED = frozenset({"CMS Certification Number (CCN)", "ZIP Code"})
HOSPICE_GI_REQUIRED = frozenset({"CMS Certification Number (CCN)", "Facility Name", "State"})
LONG_QUALITY_REQUIRED = frozenset(
    {"CMS Certification Number (CCN)", "Measure Code", "Measure Name"}
)
HH_SERVICES = (
    ("nursing_care", "Offers Nursing Care Services"),
    ("physical_therapy", "Offers Physical Therapy Services"),
    ("occupational_therapy", "Offers Occupational Therapy Services"),
    ("speech_pathology", "Offers Speech Pathology Services"),
    ("medical_social", "Offers Medical Social Services"),
    ("home_health_aide", "Offers Home Health Aide Services"),
)
HH_QUALITY_SCORES = (
    "How often the home health team began their patients' care in a timely manner",
    "How often the home health team determined whether patients received a flu shot for the current flu season",
    "How often patients got better at walking or moving around",
    "How often patients got better at getting in and out of bed",
    "How often patients got better at bathing",
    "How often patients' breathing improved",
    "How often patients got better at taking their drugs correctly by mouth",
    "Changes in skin integrity post-acute care: pressure ulcer/injury",
    "How often physician-recommended actions to address medication issues were completely timely",
    "Percent of Residents Experiencing One or More Falls with Major Injury",
    "Discharge Function Score",
    "Transfer of Health Information to the Provider",
    "Transfer of Health Information to the Patient",
    "DTC Risk-Standardized Rate",
    "PPR Risk-Standardized Rate",
    "PPH Risk-Standardized Rate",
)


@dataclass
class PostAcuteSummary:
    dataset_key: str
    source_release: str | None
    checksum: str
    rows_read: int = 0
    valid_rows: int = 0
    rejected_rows: int = 0
    snapshot_rows: int = 0
    quality_rows: int = 0
    service_rows: int = 0
    zip_rows: int = 0
    warnings: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def normalize_agency_ccn(value: str) -> str | None:
    text = (value or "").strip().upper()
    if text.isdigit() and len(text) == 5:
        text = text.zfill(6)
    return text if CCN_PATTERN.fullmatch(text) else None


def parse_offered(raw: str | None) -> tuple[bool | None, str]:
    value = (raw or "").strip()
    lowered = value.lower()
    if lowered in {"yes", "y", "true"}:
        return True, value
    if lowered in {"no", "n", "false"}:
        return False, value
    if not value:
        return None, value
    return None, value


def classify_availability(
    score: str | None, footnote: str | None
) -> tuple[str, Decimal | None, str | None]:
    text = (score or "").strip()
    note = (footnote or "").strip() or None
    if not text:
        lowered = (note or "").lower()
        if note and any(
            token in lowered for token in ("suppressed", "too small", "not enough", "insufficient")
        ):
            return "INSUFFICIENT_DATA", None, note
        if note:
            return "SUPPRESSED", None, note
        return "NOT_AVAILABLE", None, note
    try:
        number = Decimal(text.replace("%", "").replace(",", ""))
    except InvalidOperation:
        return "REPORTED", None, note
    return "REPORTED", number, note


def parse_star(raw: str | None) -> int | None:
    text = (raw or "").strip()
    if not text:
        return None
    try:
        value = int(Decimal(text))
    except (InvalidOperation, ValueError):
        return None
    return value if 1 <= value <= 5 else None


def parse_date(raw: str | None) -> date | None:
    text = (raw or "").strip()
    if not text:
        return None
    if "/" in text:
        parts = text.split("/")
        if len(parts) == 3:
            month, day, year = int(parts[0]), int(parts[1]), int(parts[2])
            if year < 100:
                year += 2000
            return date(year, month, day)
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(json.dumps(row, sort_keys=True, default=str) + "\n")


def ingest_post_acute_source(
    source_file: Path,
    manifest: ReleaseManifest,
    data_root: Path,
    *,
    write_outputs: bool = True,
) -> PostAcuteSummary:
    key = manifest.dataset_key
    if key not in POST_ACUTE_KEYS:
        raise ValueError(f"unsupported post-acute dataset: {key}")
    summary = PostAcuteSummary(
        dataset_key=key,
        source_release=manifest.source_release_date,
        checksum=manifest.sha256,
    )
    records: list[dict[str, Any]] = []
    with source_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = {name.strip() for name in (reader.fieldnames or []) if name}
        required = {
            HH_AGENCIES_KEY: HH_AGENCY_REQUIRED,
            HH_HHCAHPS_KEY: HH_HHCAHPS_REQUIRED,
            HH_ZIP_KEY: ZIP_REQUIRED,
            HOSPICE_GI_KEY: HOSPICE_GI_REQUIRED,
            HOSPICE_QUALITY_KEY: LONG_QUALITY_REQUIRED,
            HOSPICE_CAHPS_KEY: LONG_QUALITY_REQUIRED,
            HOSPICE_ZIP_KEY: ZIP_REQUIRED,
        }[key]
        missing = sorted(required - columns)
        if missing:
            raise SchemaDriftError(
                "SCHEMA_DRIFT: " + "; ".join(f"missing required column: {name}" for name in missing)
            )
        for line, row in enumerate(reader, start=2):
            summary.rows_read += 1
            try:
                built = _normalize_row(key, row, line, manifest)
            except ValueError:
                summary.rejected_rows += 1
                continue
            if built is None:
                summary.rejected_rows += 1
                continue
            if isinstance(built, list):
                records.extend(built)
                summary.valid_rows += 1
                for item in built:
                    _count(summary, item)
            else:
                records.append(built)
                summary.valid_rows += 1
                _count(summary, built)
    if write_outputs:
        release = manifest.source_release_date or manifest.sha256
        dest = data_root / "normalized" / "cms" / key / release / "records.jsonl"
        _write_jsonl(dest, records)
        report = data_root / "reports" / "cms" / key / release
        report.mkdir(parents=True, exist_ok=True)
        (report / "summary.json").write_text(summary.to_json(), encoding="utf-8")
    return summary


def _count(summary: PostAcuteSummary, item: dict[str, Any]) -> None:
    kind = item.get("record_kind")
    if kind == "snapshot":
        summary.snapshot_rows += 1
    elif kind == "quality":
        summary.quality_rows += 1
    elif kind == "service":
        summary.service_rows += 1
    elif kind == "zip":
        summary.zip_rows += 1


def _normalize_row(
    key: str, row: dict[str, str], line: int, manifest: ReleaseManifest
) -> dict[str, Any] | list[dict[str, Any]] | None:
    locator = f"csv-row:{line}"
    ccn = normalize_agency_ccn(row.get("CMS Certification Number (CCN)") or "")
    if not ccn:
        return None
    if key == HH_AGENCIES_KEY:
        return _hh_agency(row, ccn, locator, manifest)
    if key == HH_HHCAHPS_KEY:
        return _hhcahps(row, ccn, locator, manifest)
    if key in {HH_ZIP_KEY, HOSPICE_ZIP_KEY}:
        zip_code = (row.get("ZIP Code") or "").strip()
        if not zip_code:
            return None
        return {
            "record_kind": "zip",
            "cms_ccn": ccn,
            "provider_type": "home_health" if key == HH_ZIP_KEY else "hospice",
            "state_code": (row.get("State") or "").strip().upper() or None,
            "zip_code": zip_code[:10],
            "source_record_locator": locator,
        }
    if key == HOSPICE_GI_KEY:
        state = (row.get("State") or "").strip().upper()
        if len(state) != 2:
            return None
        return {
            "record_kind": "snapshot",
            "provider_type": "hospice",
            "cms_ccn": ccn,
            "provider_name": (row.get("Facility Name") or "").strip(),
            "address_line_1": (row.get("Address Line 1") or "").strip() or None,
            "address_line_2": (row.get("Address Line 2") or "").strip() or None,
            "city": (row.get("City/Town") or "").strip() or None,
            "state_code": state,
            "zip_code": (row.get("ZIP Code") or "").strip() or None,
            "county_name": (row.get("County/Parish") or "").strip() or None,
            "telephone": (row.get("Telephone Number") or "").strip() or None,
            "cms_region": (row.get("CMS Region") or "").strip() or None,
            "ownership_type": (row.get("Ownership Type") or "").strip() or None,
            "certification_date": parse_date(row.get("Certification Date")),
            "source_record_locator": locator,
            "raw_record": row,
        }
    if key in {HOSPICE_QUALITY_KEY, HOSPICE_CAHPS_KEY}:
        family = "hospice_quality" if key == HOSPICE_QUALITY_KEY else "hospice_cahps"
        code = (row.get("Measure Code") or "").strip()
        name = (row.get("Measure Name") or "").strip()
        if not code or not name:
            return None
        availability, score, footnote = classify_availability(row.get("Score"), row.get("Footnote"))
        period = (row.get("Measure Date Range") or row.get("Date") or "").strip() or None
        star = parse_star(row.get("Star Rating"))
        return {
            "record_kind": "quality",
            "provider_type": "hospice",
            "cms_ccn": ccn,
            "measure_family": family,
            "measure_code": code,
            "official_name": name,
            "reporting_period": period,
            "score": str(score) if score is not None else None,
            "score_text": (row.get("Score") or "").strip() or None,
            "star_rating": star,
            "availability": availability,
            "footnote": footnote,
            "source_record_locator": locator,
            "raw_record": {"Measure Code": code, "Measure Name": name, "Score": row.get("Score")},
        }
    raise ValueError(key)


def _hh_agency(
    row: dict[str, str], ccn: str, locator: str, manifest: ReleaseManifest
) -> list[dict[str, Any]]:
    del manifest
    state = (row.get("State") or "").strip().upper()
    name = (row.get("Provider Name") or "").strip()
    if len(state) != 2 or not name:
        raise ValueError("missing identity")
    records: list[dict[str, Any]] = [
        {
            "record_kind": "snapshot",
            "provider_type": "home_health",
            "cms_ccn": ccn,
            "provider_name": name,
            "address": (row.get("Address") or "").strip() or None,
            "city": (row.get("City/Town") or "").strip() or None,
            "state_code": state,
            "zip_code": (row.get("ZIP Code") or "").strip() or None,
            "telephone": (row.get("Telephone Number") or "").strip() or None,
            "ownership_type": (row.get("Type of Ownership") or "").strip() or None,
            "certification_date": parse_date(row.get("Certification Date")),
            "quality_of_patient_care_star": parse_star(
                row.get("Quality of patient care star rating")
            ),
            "quality_of_patient_care_star_footnote": (
                row.get("Footnote for quality of patient care star rating") or ""
            ).strip()
            or None,
            "source_record_locator": locator,
            "raw_record": {
                "CMS Certification Number (CCN)": row.get("CMS Certification Number (CCN)"),
                "Provider Name": name,
                "State": state,
            },
        }
    ]
    for code, field_name in HH_SERVICES:
        offered, raw = parse_offered(row.get(field_name))
        records.append(
            {
                "record_kind": "service",
                "provider_type": "home_health",
                "cms_ccn": ccn,
                "service_code": code,
                "official_field": field_name,
                "offered": offered,
                "raw_value": raw or None,
                "source_record_locator": locator,
            }
        )
    for official in HH_QUALITY_SCORES:
        footnote_key = f"Footnote for {official}"
        if official not in row and official.startswith("Changes in skin"):
            footnote_key = (
                "Footnote Changes in skin integrity post-acute care: pressure ulcer/injury"
            )
        availability, score, footnote = classify_availability(
            row.get(official), row.get(footnote_key)
        )
        records.append(
            {
                "record_kind": "quality",
                "provider_type": "home_health",
                "cms_ccn": ccn,
                "measure_family": "hh_quality",
                "measure_code": official,
                "official_name": official,
                "reporting_period": None,
                "score": str(score) if score is not None else None,
                "score_text": (row.get(official) or "").strip() or None,
                "star_rating": None,
                "availability": availability,
                "footnote": footnote,
                "source_record_locator": locator,
                "raw_record": {"measure": official},
            }
        )
    return records


def _hhcahps(
    row: dict[str, str], ccn: str, locator: str, manifest: ReleaseManifest
) -> list[dict[str, Any]]:
    del manifest
    records: list[dict[str, Any]] = []
    summary_star = parse_star(row.get("HHCAHPS Survey Summary Star Rating"))
    availability, _, footnote = classify_availability(
        row.get("HHCAHPS Survey Summary Star Rating"),
        row.get("HHCAHPS Survey Summary Star Rating Footnote"),
    )
    records.append(
        {
            "record_kind": "quality",
            "provider_type": "home_health",
            "cms_ccn": ccn,
            "measure_family": "hh_hhcahps",
            "measure_code": "HHCAHPS_SUMMARY_STAR",
            "official_name": "HHCAHPS Survey Summary Star Rating",
            "reporting_period": None,
            "score": None,
            "score_text": (row.get("HHCAHPS Survey Summary Star Rating") or "").strip() or None,
            "star_rating": summary_star,
            "availability": "REPORTED" if summary_star is not None else availability,
            "footnote": footnote,
            "source_record_locator": locator,
            "raw_record": {"measure": "HHCAHPS_SUMMARY_STAR"},
        }
    )
    percent_fields = [
        (
            "HHCAHPS_CARE_PROFESSIONAL",
            "Percent of patients who reported that their home health team gave care in a professional way",
            "Footnote for Percent of patients who reported that their home health team gave care in a professional way",
        ),
        (
            "HHCAHPS_COMMUNICATED_WELL",
            "Percent of patients who reported that their home health team communicated well with them",
            "Footnote for Percent of patients who reported that their home health team communicated well with them",
        ),
        (
            "HHCAHPS_OVERALL_9_OR_10",
            "Percent of patients who gave their home health agency a rating of 9 or 10 on a scale from 0 (lowest) to 10 (highest)",
            "Footnote for Percent of patients who gave their home health agency a rating of 9 or 10 on a scale from 0(lowest) to 10(highest)",
        ),
        (
            "HHCAHPS_COMPLETED_SURVEYS",
            "Number of completed Surveys",
            "Footnote for number of completed surveys",
        ),
        (
            "HHCAHPS_RESPONSE_RATE",
            "Survey response rate",
            "Footnote for Survey response rate",
        ),
    ]
    for code, official, footnote_key in percent_fields:
        availability, score, footnote = classify_availability(
            row.get(official), row.get(footnote_key)
        )
        records.append(
            {
                "record_kind": "quality",
                "provider_type": "home_health",
                "cms_ccn": ccn,
                "measure_family": "hh_hhcahps",
                "measure_code": code,
                "official_name": official,
                "reporting_period": None,
                "score": str(score) if score is not None else None,
                "score_text": (row.get(official) or "").strip() or None,
                "star_rating": None,
                "availability": availability,
                "footnote": footnote,
                "source_record_locator": locator,
                "raw_record": {"measure": code},
            }
        )
    return records


def required_columns_for_post_acute(dataset_key: str) -> set[str]:
    return {
        HH_AGENCIES_KEY: set(HH_AGENCY_REQUIRED),
        HH_HHCAHPS_KEY: set(HH_HHCAHPS_REQUIRED),
        HH_ZIP_KEY: set(ZIP_REQUIRED),
        HOSPICE_GI_KEY: set(HOSPICE_GI_REQUIRED),
        HOSPICE_QUALITY_KEY: set(LONG_QUALITY_REQUIRED),
        HOSPICE_CAHPS_KEY: set(LONG_QUALITY_REQUIRED),
        HOSPICE_ZIP_KEY: set(ZIP_REQUIRED),
    }.get(dataset_key, set())
