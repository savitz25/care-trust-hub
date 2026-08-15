import csv
import json
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path

import pytest

from care_ingest.downloader import resolve_distribution
from care_ingest.manifest import ReleaseManifest, sha256_file
from care_ingest.pbj import (
    NURSE_HOUR_FIELDS,
    PBJ_NURSE_KEY,
    daily_identity,
    ingest_pbj_source,
    normalize_pbj_row,
    verify_pbj_schema,
)
from care_ingest.provider_information import SchemaDriftError
from care_ingest.registry import get_source


def _row(**overrides: str) -> dict[str, str]:
    row = {
        "PROVNUM": "37E109",
        "PROVNAME": "Synthetic fixture provider",
        "CITY": "Fixture City",
        "STATE": "AL",
        "COUNTY_NAME": "Fixture County",
        "COUNTY_FIPS": "001",
        "CY_Qtr": "2026Q1",
        "WorkDate": "20260103",
        "MDScensus": "10",
        **dict.fromkeys(NURSE_HOUR_FIELDS, "0.00"),
    }
    row.update(overrides)
    return row


def _manifest(path: Path) -> ReleaseManifest:
    return ReleaseManifest(
        manifest_version=2,
        dataset_key=PBJ_NURSE_KEY,
        source_organization="Centers for Medicare & Medicaid Services (CMS)",
        cms_identifier="7e0d53ba-8f02-4c66-98a5-14a1c997c50d",
        official_source_url=(
            "https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing"
        ),
        retrieval_timestamp=datetime(2026, 8, 14, tzinfo=UTC).isoformat(),
        source_release_date="2026-07-29",
        original_filename=path.name,
        byte_size=path.stat().st_size,
        sha256=sha256_file(path),
        content_type="text/csv",
        transformation_version=None,
        ingestion_status="downloaded",
        source_modified_at="2026-07-29",
        source_period="2026Q1",
        source_version_identifier="6e5d5e28-66fd-41bc-a36c-db54dcbffd3e",
    )


def _csv(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def test_schema_and_alphanumeric_daily_identity(tmp_path: Path) -> None:
    raw = tmp_path / "pbj.csv"
    _csv(raw, [_row()])
    row = _row(Hrs_RN="8.25", Hrs_RN_emp="7.00", Hrs_RN_ctr="1.25")
    record = normalize_pbj_row(row, 2, _manifest(raw))
    assert record["ccn"] == "37E109"
    assert record["normalized"]["work_date"] == "2026-01-03"
    assert record["normalized"]["hours"]["Hrs_RN"] == "8.25"
    assert record["normalized"]["daily_key"] == daily_identity("37E109", "2026-01-03")
    assert verify_pbj_schema(list(row)) == []


def test_schema_drift_and_quarter_boundaries_are_rejected(tmp_path: Path) -> None:
    raw = tmp_path / "pbj.csv"
    _csv(raw, [_row()])
    with pytest.raises(SchemaDriftError, match="MDScensus"):
        verify_pbj_schema([field for field in _row() if field != "MDScensus"])
    with pytest.raises(ValueError, match="outside"):
        normalize_pbj_row(_row(WorkDate="20260401"), 2, _manifest(raw))


def test_census_missingness_and_invalid_hours_are_explicit(tmp_path: Path) -> None:
    raw = tmp_path / "pbj.csv"
    _csv(raw, [_row()])
    record = normalize_pbj_row(_row(MDScensus="", Hrs_RN=""), 2, _manifest(raw))
    assert record["normalized"]["resident_census"] is None
    assert record["normalized"]["hours"]["Hrs_RN"] is None
    with pytest.raises(ValueError, match="negative Hrs_RN"):
        normalize_pbj_row(_row(Hrs_RN="-0.25"), 2, _manifest(raw))


def test_ingest_reports_duplicates_zero_census_and_rejects(tmp_path: Path) -> None:
    raw = tmp_path / "pbj.csv"
    _csv(
        raw,
        [
            _row(MDScensus="0"),
            _row(MDScensus="0"),
            _row(WorkDate="20260104", Hrs_CNA="-1"),
        ],
    )
    summary = ingest_pbj_source(raw, _manifest(raw), tmp_path)
    assert summary.source_rows == 3
    assert summary.normalized_rows == 1
    assert summary.rejected_rows == 2
    assert summary.duplicate_provider_days == 1
    assert summary.negative_hour_rows == 1
    assert summary.zero_census == 1
    assert summary.alphanumeric_ccns == 1
    assert summary.providers_with_incomplete_quarters == 1


def test_ingest_reads_official_windows_1252_text(tmp_path: Path) -> None:
    raw = tmp_path / "pbj.csv"
    row = _row(PROVNAME="Synthetic Director’s Center")
    with raw.open("w", encoding="cp1252", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(row))
        writer.writeheader()
        writer.writerow(row)
    summary = ingest_pbj_source(raw, _manifest(raw), tmp_path)
    assert summary.normalized_rows == 1
    normalized = tmp_path / "normalized" / "cms" / PBJ_NURSE_KEY / "2026-07-29" / "records.jsonl"
    record = json.loads(normalized.read_text(encoding="utf-8"))
    assert record["raw"]["PROVNAME"] == "Synthetic Director’s Center"


def test_official_catalog_resolution_chooses_fixed_pbj_release(monkeypatch) -> None:
    temporal = "2026-01-01/2026-03-31"
    modified = "2026-07-29"
    fixed_id = "6e5d5e28-66fd-41bc-a36c-db54dcbffd3e"
    catalog = {
        "dataset": [
            {
                "title": "Payroll Based Journal Daily Nurse Staffing",
                "distribution": [
                    {
                        "description": "latest",
                        "format": "API",
                        "temporal": temporal,
                        "modified": modified,
                    },
                    {
                        "mediaType": "text/csv",
                        "downloadURL": "https://data.cms.gov/sites/default/files/pbj.csv",
                        "temporal": temporal,
                        "modified": modified,
                    },
                    {
                        "description": "fixed",
                        "format": "API",
                        "accessURL": f"https://data.cms.gov/data-api/v1/dataset/{fixed_id}/data",
                        "temporal": temporal,
                        "modified": modified,
                    },
                ],
            }
        ]
    }
    monkeypatch.setattr(
        "care_ingest.downloader._request",
        lambda _url, _timeout: BytesIO(json.dumps(catalog).encode()),
    )
    resolved = resolve_distribution(get_source(PBJ_NURSE_KEY))
    assert resolved["source_period"] == "2026Q1"
    assert resolved["coverage_start"] == "2026-01-01"
    assert resolved["coverage_end"] == "2026-03-31"
    assert resolved["source_version_identifier"] == fixed_id
    assert resolved["download_url"].endswith("pbj.csv")
