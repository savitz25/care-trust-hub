from pathlib import Path

import pytest

from care_ingest.manifest import ReleaseManifest
from care_ingest.regulatory import (
    DEFICIENCIES_KEY,
    INSPECTIONS_KEY,
    PENALTIES_KEY,
    SCOPE_SEVERITY,
    ingest_regulatory_source,
    inspection_event_key,
    normalize_regulatory_row,
)


def manifest(dataset_key: str) -> ReleaseManifest:
    return ReleaseManifest(
        2,
        dataset_key,
        "CMS",
        "id",
        "https://data.cms.gov/source",
        "2026-08-14T00:00:00+00:00",
        "2026-06-01",
        "source.csv",
        1,
        "a" * 64,
        "text/csv",
        None,
        "downloaded",
    )


def test_scope_severity_registry_uses_official_grid() -> None:
    assert set(SCOPE_SEVERITY) == set("ABCDEFGHIJKL")
    assert SCOPE_SEVERITY["D"].scope == "Isolated"
    assert SCOPE_SEVERITY["J"].immediate_jeopardy is True
    assert SCOPE_SEVERITY["L"].scope == "Widespread"


def test_inspection_identity_is_deterministic() -> None:
    first = inspection_event_key("015009", "2026-01-01", "Health Standard", 1)
    assert first == inspection_event_key("015009", "2026-01-01", "Health Standard", 1)
    assert first != inspection_event_key("015009", "2026-01-01", "Health Complaint", 1)


def test_deficiency_preserves_ftag_and_rejects_unknown_severity() -> None:
    row = {
        "CMS Certification Number (CCN)": "01A193",
        "Survey Date": "2026-01-02",
        "Survey Type": "Health",
        "Deficiency Prefix": "F",
        "Deficiency Category": "Care",
        "Deficiency Tag Number": "0880",
        "Deficiency Description": "Official description",
        "Scope Severity Code": "J",
        "Deficiency Corrected": "Past Non-Compliance",
        "Correction Date": "2026-01-03",
        "Inspection Cycle": "1",
        "Standard Deficiency": "Y",
        "Complaint Deficiency": "N",
        "Infection Control Inspection Deficiency": "N",
        "Citation under IDR": "N",
        "Citation under IIDR": "N",
        "Processing Date": "2026-06-01",
    }
    record = normalize_regulatory_row(row, 2, manifest(DEFICIENCIES_KEY))
    assert record["normalized"]["deficiency_tag"] == "0880"
    assert record["ccn"] == "01A193"
    with pytest.raises(ValueError, match="unknown CMS scope/severity"):
        normalize_regulatory_row({**row, "Scope Severity Code": "Z"}, 2, manifest(DEFICIENCIES_KEY))


def test_penalty_currency_is_exact_and_types_remain_distinct() -> None:
    row = {
        "CMS Certification Number (CCN)": "015009",
        "Penalty Date": "2026-01-02",
        "Penalty Type": "Fine",
        "Fine ID": "7",
        "Fine Amount": "1234.5",
        "Payment Denial Start Date": "",
        "Payment Denial Length in Days": "",
        "Processing Date": "2026-06-01",
    }
    record = normalize_regulatory_row(row, 2, manifest(PENALTIES_KEY))
    assert record["normalized"]["fine_amount"] == "1234.50"
    assert record["normalized"]["payment_denial_days"] is None


def test_ingest_links_many_deficiencies_to_one_survey_identity(tmp_path: Path) -> None:
    source = tmp_path / "inspection.csv"
    source.write_text(
        "CMS Certification Number (CCN),Survey Date,Type of Survey,Survey Cycle,Processing Date\n"
        "015009,2026-01-01,Health Standard,1,2026-06-01\n",
        encoding="utf-8",
    )
    summary = ingest_regulatory_source(
        source, manifest(INSPECTIONS_KEY), tmp_path, write_outputs=False
    )
    assert summary.normalized_rows == 1
    assert summary.rejected_rows == 0
