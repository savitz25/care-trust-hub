# ruff: noqa: E501
from pathlib import Path

from care_ingest.nj_doh_enforcement import IdentityRecord
from care_ingest.nj_doh_staffing import (
    build_staffing_report,
    parse_ratio,
    parse_staffing_html,
    parse_title_period,
)
from care_ingest.nj_medicaid_al_rates import (
    build_rate_report,
    infer_subtype,
    match_rate_row,
    parse_rate_text,
)
from care_ingest.nj_pace import build_pace_report, parse_doas_page
from care_ingest.nj_sen_002_reconcile import load_ledger
from care_ingest.state_enforcement import parse_california_events
from care_ingest.state_regulator import load_state_regulator_sources

FIXTURE_DIR = Path(__file__).parent / "fixtures"


def test_staffing_year_quarter_and_ratio_orientation() -> None:
    assert parse_title_period("Quarterly Report: First Quarter of the Year 2026") == (2026, "Q1")
    cell = parse_ratio(" 44.6")
    assert cell.numeric == 44.6
    assert cell.missing_code is None
    assert parse_ratio("M").missing_code == "M"
    assert parse_ratio("NS").numeric is None
    assert parse_ratio("-").missing_code == "-"
    assert parse_ratio("M").numeric is None


def test_staffing_html_facid_and_statewide_not_facility() -> None:
    html = (FIXTURE_DIR / "nj_doh_staffing_2026_q1.html").read_text(encoding="utf-8")
    rows = parse_staffing_html(html)
    statewide = [row for row in rows if row.is_statewide]
    facilities = [row for row in rows if not row.is_statewide]
    assert statewide
    assert all(row.source_facility_id is None for row in statewide)
    abigail = next(row for row in facilities if "ABIGAIL" in row.source_facility_name.upper())
    assert abigail.source_facility_id == "NJ60418"
    assert abigail.ratios[("day", "RN")].numeric == 44.6
    identities = [
        IdentityRecord(
            source_facility_id="NJ60418",
            license_number="NJ60418",
            official_name="ABIGAIL HOUSE FOR NURSING & REHABILITATION (NJ60418)",
            alpha_name=None,
            street="1 MAIN",
            city="NEWARK",
            county="ESSEX",
            zip_code="07102",
            licensed_owner=None,
            canonical_type="NJ_NF_SNF",
        ),
        IdentityRecord(
            source_facility_id="ALR001",
            license_number="ALR001",
            official_name="Sunrise",
            alpha_name=None,
            street="2 MAIN",
            city="MARLBORO",
            county="MONMOUTH",
            zip_code="07746",
            licensed_owner=None,
            canonical_type="NJ_ALR",
        ),
    ]
    report = build_staffing_report(rows, identities, html=html, dry_run=True)
    assert report.exact >= 1
    assert report.statewide_rows >= 1
    # name-only other facility without facid match is not auto-attached as exact
    from care_ingest.nj_doh_staffing import StaffingFacilityRow, match_staffing_row

    dummy = StaffingFacilityRow(
        source_facility_id=None,
        source_facility_name="Sunrise",
        is_statewide=False,
        statewide_label=None,
        day_census=parse_ratio("1"),
        evening_census=parse_ratio("1"),
        night_census=parse_ratio("1"),
        ratios={("day", "RN"): parse_ratio("1")},
        year=2026,
        quarter="Q1",
    )
    assert match_staffing_row(dummy, identities).bucket == "UNSAFE_REJECTED"


def test_medicaid_rates_do_not_invent_default_participation() -> None:
    text = """
SFY 2026 Assisted Living Provider Rates
Effective July 1, 2025
ACTORS FUND HOME, ALR $121.10
ACTORS FUND HOME, CPCH $81.10
CAPITAL HEALTH ASSISTED LIVING PROGRAM $99.10
SUNRISE OF SUMMIT $91.10
*Assisted Living Programs (ALP) not listed will receive a rate of $99.10. Assisted Living Residences (ALR) not listed will receive a rate of $91.10.
Comprehensive Personal Care Homes (CPCH) not listed will receive a rate of $81.10.
"""
    schedule = parse_rate_text(
        text,
        official_url="https://www.njmmis.com/downloadDocuments/SFY_2026_Assisted_Living_Rates.pdf",
    )
    assert schedule.fiscal_year == "SFY_2026"
    assert schedule.effective_on.isoformat() == "2025-07-01"
    assert infer_subtype("ACTORS FUND HOME, ALR") == "ALR"
    assert infer_subtype("ACTORS FUND HOME, CPCH") == "CPCH"
    assert infer_subtype("CAPITAL HEALTH ASSISTED LIVING PROGRAM") == "ALP"
    identities = [
        IdentityRecord(
            "ALR001",
            "ALR001",
            "SUNRISE OF SUMMIT",
            None,
            "1 ST",
            "SUMMIT",
            "UNION",
            "07901",
            None,
            "NJ_ALR",
        )
    ]
    matches = [match_rate_row(row, identities) for row in schedule.rows]
    report = build_rate_report(schedule, matches, dry_run=True)
    assert report.default_unlisted_participation_invented is False
    assert report.listed_providers == 4
    sunrise = next(row for row in schedule.rows if "SUNRISE" in row.provider_name)
    assert match_rate_row(sunrise, identities).bucket == "UNSAFE_REJECTED"


def test_pace_org_center_zip_and_status_history() -> None:
    html = "<html>Capital Health LIFE BoldAge PACE East Brunswick Plainfield</html>"
    corpus = parse_doas_page(html, retrieved="2026-09-02T00:00:00Z", sha256="abc")
    report = build_pace_report(corpus, dry_run=True)
    burlington = [item for item in corpus.service_areas if item.county == "Burlington"]
    hudson = [item for item in corpus.service_areas if item.county == "Hudson"]
    assert any(item.coverage_type == "PARTIAL_COUNTY_ZIPS" for item in burlington)
    assert {item.zip_code for item in hudson if item.zip_code} >= {"07302", "07306"}
    assert "08015" in {item.zip_code for item in burlington if item.zip_code}
    awarded = {
        item.county for item in corpus.service_areas if item.coverage_type == "AWARDED_FUTURE"
    }
    assert "Sussex" in awarded
    assert "Middlesex" not in awarded
    east = next(item for item in corpus.centers if "East Brunswick" in item.center_name)
    assert east.current_status == "OPERATING"
    types = {
        item.event_type
        for item in corpus.events
        if item.center_name and "East Brunswick" in item.center_name
    }
    assert types == {"IN_DEVELOPMENT", "OPERATING"}
    assert report.organizations >= 6
    assert report.centers >= 9
    names = {item.center_name for item in corpus.centers}
    assert "Capital Health LIFE Bordentown" in names


def test_reconciliation_indexed_equals_downloaded_plus_unavailable() -> None:
    ledger_path = (
        Path(__file__).resolve().parents[3]
        / "docs"
        / "data"
        / "nj-sen-002-acquisition-ledger.jsonl"
    )
    if not ledger_path.is_file():
        return
    rows = load_ledger(ledger_path)
    downloaded = sum(1 for row in rows if row.get("sha256"))
    unavailable = sum(
        1 for row in rows if str(row.get("final_acquisition_status", "")).startswith("HTTP_")
    )
    assert len(rows) == downloaded + unavailable
    hashes = [row["sha256"] for row in rows if row.get("sha256")]
    unique = len(set(hashes))
    extras = len(hashes) - unique
    assert downloaded == unique + extras


def test_cms_pbj_and_state_regulators_unchanged() -> None:
    events = parse_california_events(
        [
            {
                "FACID": "10000102",
                "FAC_TYPE_CODE": "SNF",
                "PENALTY_ISSUE_DATE": "2024-05-12 00:00:00",
                "PENALTY_NUMBER": "CA-1",
                "PENALTY_TYPE": "Citation",
                "TOTAL_AMOUNT_DUE_FINAL": "12000",
            }
        ]
    )
    assert events[0].event_type == "STATE_FINE"
    sources = load_state_regulator_sources()
    assert {source.state_code for source in sources if source.implemented} == {"CA", "NY", "TX"}
