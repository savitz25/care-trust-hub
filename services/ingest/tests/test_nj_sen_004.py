# ruff: noqa: E501
from __future__ import annotations

import json
from pathlib import Path

from care_ingest.nj_doh_acute import (
    ADAPTER_VERSION,
    TYPE_MAP,
    branch_parent_links,
    identity_from_acute,
    inspect_payload,
    map_facility_type,
    match_home_health,
    match_hospice,
    parse_acute_rows,
    physical_location_areas,
    schema_fingerprint,
)
from care_ingest.nj_doh_enforcement import IdentityRecord, match_document
from care_ingest.nj_doh_ltc import TYPE_MAP as LTC_TYPE_MAP
from care_ingest.nj_doh_staffing import NURSING_TYPES
from care_ingest.nj_medicaid_al_rates import RateRow, infer_subtype, match_rate_row
from care_ingest.nj_pace import PaceOrganization, PaceStatusEvent
from care_ingest.nj_sen_004 import (
    CmsPaceRow,
    classify_staffing_facid,
    discover_ccrc,
    match_pace_cms,
    metric_contract_row,
    rematch_documents,
    upgrade_medicaid_match,
)
from care_ingest.state_regulator import CanonicalCmsFacility, load_state_regulator_sources

FIXTURE = json.loads(
    Path(__file__).parent.joinpath("fixtures/nj_doh_acute_sample.json").read_text(encoding="utf-8")
)
ROOT = Path(__file__).resolve().parents[3]


def _hh() -> CanonicalCmsFacility:
    return CanonicalCmsFacility(
        cms_ccn="317001",
        name="Cedar Crest Home Health",
        address="1 Cedar Crest Village Drive",
        city="Pompton Plains",
        state="NJ",
        zip_code="07444",
        phone="9735550100",
    )


def _hospice() -> CanonicalCmsFacility:
    return CanonicalCmsFacility(
        cms_ccn="311540",
        name="Hackensack Meridian Hospice",
        address="1340 Campus Parkway",
        city="Wall",
        state="NJ",
        zip_code="07719",
        phone="7325550200",
    )


def _parsed() -> list:
    parsed, quarantined = parse_acute_rows(FIXTURE["rows"])
    return parsed, quarantined


def test_all_acute_types_are_mapped_and_unknown_is_quarantined() -> None:
    assert "HOME HEALTH AGENCY" in TYPE_MAP
    assert TYPE_MAP["HOME HEALTH AGENCY"].canonical == "NJ_HHA"
    assert TYPE_MAP["HOSPICE CARE PROGRAM"].canonical == "NJ_HOSPICE_PROGRAM"
    assert TYPE_MAP["HOSPICE CARE BRANCH"].canonical == "NJ_HOSPICE_BRANCH"
    assert TYPE_MAP["HOSPICE CARE - INPATIENT"].canonical == "NJ_HOSPICE_INPATIENT"
    assert TYPE_MAP["HOME HEALTH AGENCY"].canonical != TYPE_MAP["HOSPICE CARE PROGRAM"].canonical
    assert map_facility_type("MADE UP ACUTE TYPE") is None
    parsed, quarantined = _parsed()
    assert {row.facility_type_canonical for row in parsed} == {
        "NJ_HHA",
        "NJ_HOSPICE_PROGRAM",
        "NJ_HOSPICE_BRANCH",
        "NJ_HOSPICE_INPATIENT",
        "NJ_HOSPITAL_GENERAL_ACUTE",
    }
    assert len(quarantined) == 1
    assert quarantined[0]["FACILITY_TYPE"] == "MADE UP ACUTE TYPE"
    assert all(spec.cms_crosswalk_class != "nursing_home" for spec in TYPE_MAP.values())
    assert all(spec.notes for spec in TYPE_MAP.values())


def test_facid_license_and_schema_fingerprint() -> None:
    parsed, _ = _parsed()
    hha = next(row for row in parsed if row.facility_type_canonical == "NJ_HHA")
    assert hha.source_facility_id == "NJ24165"
    assert hha.license_number == "24165"
    assert hha.source_facility_id != hha.license_number
    assert len(hha.record_fingerprint) == 64
    again, _ = parse_acute_rows(FIXTURE["rows"])
    assert again[0].record_fingerprint == parsed[0].record_fingerprint
    fp = schema_fingerprint(["FACILITY_TYPE", "FacID"])
    assert fp != schema_fingerprint(["FACILITY_TYPE", "FacID", "LIC#"])


def test_home_health_cms_match_rules() -> None:
    parsed, _ = _parsed()
    hha = next(row for row in parsed if row.facility_type_canonical == "NJ_HHA")
    exact_raw = dict(hha.raw)
    exact_raw["CCN"] = "317001"
    from dataclasses import replace

    with_ccn = replace(hha, raw=exact_raw)
    assert match_home_health(with_ccn, [_hh()]).bucket == "EXACT"
    high = match_home_health(hha, [_hh()])
    assert high.bucket == "HIGH_CONFIDENCE"
    nameless = replace(hha, street=None, phone=None, city="Pompton Plains")
    assert match_home_health(nameless, [_hh()]).bucket == "UNSAFE_REJECTED"
    hospital = next(
        row for row in parsed if row.facility_type_canonical == "NJ_HOSPITAL_GENERAL_ACUTE"
    )
    assert match_home_health(hospital, [_hh()]).bucket == "UNRESOLVED"
    assert match_home_health(hha, [_hospice()]).bucket != "EXACT"


def test_hospice_program_branch_inpatient_separation() -> None:
    parsed, _ = _parsed()
    program = next(row for row in parsed if row.facility_type_canonical == "NJ_HOSPICE_PROGRAM")
    branch = next(row for row in parsed if row.facility_type_canonical == "NJ_HOSPICE_BRANCH")
    inpatient = next(row for row in parsed if row.facility_type_canonical == "NJ_HOSPICE_INPATIENT")
    assert program.facility_type_canonical != branch.facility_type_canonical
    assert branch.facility_type_canonical != inpatient.facility_type_canonical
    assert match_hospice(program, [_hospice()]).bucket == "HIGH_CONFIDENCE"
    assert match_hospice(branch, [_hospice()]).bucket == "REVIEW_REQUIRED"
    assert match_hospice(branch, [_hospice()]).cms_ccn is None
    from dataclasses import replace

    nameless = replace(program, street=None, phone=None, city=None)
    assert match_hospice(nameless, [_hospice()]).bucket == "UNSAFE_REJECTED"
    assert match_hospice(program, [_hh()]).bucket != "HIGH_CONFIDENCE"
    assert match_home_health(program, [_hh()]).method == "non_cms_class"
    nh = CanonicalCmsFacility(
        "315001",
        program.official_name,
        program.street,
        program.city,
        "NJ",
        program.zip_code,
        program.phone,
    )
    assert match_hospice(inpatient, [nh]).bucket != "EXACT"
    links = branch_parent_links(parsed)
    assert any(item.bucket == "REVIEW_REQUIRED" for item in links)


def test_physical_county_is_not_service_area() -> None:
    parsed, _ = _parsed()
    areas = physical_location_areas(parsed)
    assert {item["coverage_type"] for item in areas} == {"PHYSICAL_LOCATION"}
    assert "FULL_COUNTY_SERVICE" not in {item["coverage_type"] for item in areas}
    hha = next(row for row in parsed if row.facility_type_canonical == "NJ_HHA")
    assert hha.county == "MORRIS"


def test_all_ltc_identities_remain_separate() -> None:
    parsed, _ = _parsed()
    acute_ids = {row.source_facility_id for row in parsed}
    assert "SNF001" not in acute_ids
    ltc_keys = set(LTC_TYPE_MAP)
    acute_keys = set(TYPE_MAP)
    assert ltc_keys.isdisjoint(acute_keys)
    hospital = next(
        row for row in parsed if row.facility_type_canonical == "NJ_HOSPITAL_GENERAL_ACUTE"
    )
    assert hospital.senior_relevant is False
    assert TYPE_MAP[hospital.facility_type_raw].cms_crosswalk_class == "none"


def test_enforcement_rematch_preserves_history_and_attaches_acute() -> None:
    parsed, _ = _parsed()
    acute = [identity_from_acute(row) for row in parsed]
    ltc = [
        IdentityRecord(
            "NJ60418",
            "NJ60418",
            "ABIGAIL HOUSE",
            None,
            "1 MAIN",
            "NEWARK",
            "ESSEX",
            "07102",
            None,
            "NJ_NF_SNF",
            "nj-doh-all-ltc",
            "LONG TERM CARE FACILITY SNF/NF",
        )
    ]
    docs = [
        {
            "printed_license_number": "NJ60418",
            "printed_source_facility_id": "NJ60418",
            "printed_facility_name": "ABIGAIL HOUSE",
            "printed_street": "1 MAIN",
            "printed_city": "NEWARK",
        },
        {
            "printed_license_number": "24165",
            "printed_source_facility_id": "NJ24165",
            "printed_facility_name": "CEDAR CREST HOME HEALTH (NJ24165)",
            "printed_street": "1 CEDAR CREST VILLAGE DRIVE",
            "printed_city": "POMPTON PLAINS",
        },
        {
            "printed_license_number": None,
            "printed_source_facility_id": None,
            "printed_facility_name": "Hackensack Meridian Health",
            "printed_street": None,
            "printed_city": None,
        },
        {
            "printed_license_number": None,
            "printed_source_facility_id": None,
            "printed_facility_name": "CLARA MAASS MEDICAL CENTER (NJ10701)",
            "printed_street": None,
            "printed_city": "BELLEVILLE",
        },
    ]
    report = rematch_documents(docs, ltc, acute)
    assert report.after.ltc_matched == 1
    assert report.after.home_health_matched == 1
    assert report.new_exact >= 1
    owner = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="Hackensack Meridian Health",
        printed_street=None,
        printed_city=None,
        identities=acute,
    )
    assert owner.bucket in {"REVIEW_REQUIRED", "UNSAFE_REJECTED"}
    campus = match_document(
        printed_license=None,
        printed_facid=None,
        printed_name="HACKENSACK MERIDIAN HOSPICE (NJ22440)",
        printed_street="1340 CAMPUS PARKWAY",
        printed_city="WALL",
        identities=acute,
    )
    assert campus.bucket in {"HIGH_CONFIDENCE", "REVIEW_REQUIRED", "EXACT"}
    again = rematch_documents(docs, ltc, acute)
    assert again.after.exact == report.after.exact
    assert report.duplicate_documents == 0


def test_staffing_facid_reconciliation_classes() -> None:
    ltc = [
        IdentityRecord(
            "061701",
            "061701",
            "FRIENDS VILLAGE AT WOODSTOWN (061701)",
            None,
            "1 ST",
            "WOODSTOWN",
            "SALEM",
            "08098",
            None,
            "NJ_LTC_UNSPECIFIED",
            "nj-doh-all-ltc",
            "LONG TERM CARE FACILITY",
        ),
        IdentityRecord(
            "NJ0182510",
            "0182510",
            "RENAISSANCE PAVILION (NJ0182510)",
            None,
            "2 ST",
            "NEWARK",
            "ESSEX",
            "07102",
            None,
            "NJ_NF_SNF",
            "nj-doh-all-ltc",
            "LONG TERM CARE FACILITY SNF/NF",
        ),
        IdentityRecord(
            "NJ060904",
            "060904",
            "OPTIMA CARE RIVERVIEW (NJ060904)",
            None,
            "3 ST",
            "WEST NEW YORK",
            "HUDSON",
            "07093",
            None,
            "NJ_NF_SNF",
            "nj-doh-all-ltc",
            "LONG TERM CARE FACILITY SNF/NF",
        ),
    ]
    acute = [
        identity_from_acute(
            next(
                row
                for row in _parsed()[0]
                if row.facility_type_canonical == "NJ_HOSPITAL_GENERAL_ACUTE"
            )
        )
    ]
    current = classify_staffing_facid(
        facid="61701",
        name="Friends Village At Woodstown, Inc.",
        ltc_identities=ltc,
        acute_identities=acute,
        last_quarter="2021_Q4",
    )
    assert current.classification in {"CURRENT_ALL_LTC_MATCH", "NON_NURSING_FACILITY"}
    assert current.attach_staffing is False
    renamed = classify_staffing_facid(
        facid="NJ018251",
        name="Renaissance Pavilion",
        ltc_identities=ltc,
        acute_identities=acute,
        last_quarter="2022_Q4",
    )
    assert renamed.classification == "RENAMED_LTC_FACILITY"
    assert renamed.attach_staffing is False
    closed = classify_staffing_facid(
        facid="NJ60312",
        name="Sterling Manor",
        ltc_identities=ltc,
        acute_identities=acute,
        last_quarter="2024_Q3",
    )
    assert closed.classification == "CLOSED_OR_NO_LONGER_IN_CURRENT_WORKBOOK"
    hospital = classify_staffing_facid(
        facid="NJ07011",
        name="CLARA MAASS MEDICAL CENTER (NJ10701)",
        ltc_identities=ltc,
        acute_identities=acute,
        last_quarter="2023_Q1",
    )
    assert hospital.classification == "ALL_ACUTE_MATCH"
    assert hospital.attach_staffing is False
    statewide = classify_staffing_facid(
        facid=None,
        name="Statewide Average",
        ltc_identities=ltc,
        acute_identities=acute,
        last_quarter="2026_Q1",
        statewide=True,
    )
    assert statewide.classification == "SOURCE_COMPARATOR_OR_NON_FACILITY"
    malformed = classify_staffing_facid(
        facid="NJJWOWMI",
        name="Southern Ocean Medical Center",
        ltc_identities=ltc,
        acute_identities=acute,
        last_quarter="2021_Q4",
    )
    assert malformed.classification in {
        "INVALID_OR_MALFORMED_FACID",
        "CLOSED_OR_NO_LONGER_IN_CURRENT_WORKBOOK",
        "ALL_ACUTE_MATCH",
    }
    assert NURSING_TYPES.isdisjoint({"NJ_ALR", "NJ_HHA", "NJ_HOSPICE_PROGRAM"})


def test_medicaid_rate_bridge_rules() -> None:
    row = RateRow("SUNRISE OF SUMMIT", "ALR", 91.10, "$91.10", "SFY_2026", None, 1)
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
    assert match_rate_row(row, identities).bucket == "UNSAFE_REJECTED"
    exact = upgrade_medicaid_match(
        row, identities, medicaid_provider_id="1234567", license_number="ALR001"
    )
    assert exact.bucket == "EXACT"
    high = upgrade_medicaid_match(row, identities, street="1 ST")
    assert high.bucket in {"HIGH_CONFIDENCE", "EXACT"}
    assert infer_subtype("ACTORS FUND HOME, ALR") == "ALR"
    assert infer_subtype("Mystery House") == "UNKNOWN_NOT_PRINTED"


def test_pace_cms_bridge_and_status_history() -> None:
    org = PaceOrganization("Capital Health LIFE", "OPERATING", None)
    exact = match_pace_cms(
        PaceOrganization("Capital Health LIFE", "OPERATING", "H9999"),
        [CmsPaceRow("H9999", "Capital Health LIFE")],
    )
    assert exact.bucket == "EXACT"
    alias = match_pace_cms(org, [CmsPaceRow("H5080", "Beacon Care Ventures LLC DBA BoldAge PACE")])
    assert alias.bucket in {"REVIEW_REQUIRED", "UNRESOLVED"}
    event = PaceStatusEvent(
        "Capital Health LIFE",
        "East Brunswick",
        "IN_DEVELOPMENT",
        None,
        "press",
        "pace:east-brunswick:in-development",
    )
    assert event.event_type == "IN_DEVELOPMENT"
    assert event.baseline_only is True


def test_ccrc_not_njdoh_and_missing_roster_is_not_zero() -> None:
    html = (
        Path(ROOT / "data/raw/nj-ccrc/ccrc.shtml.html").read_text(encoding="utf-8")
        if (ROOT / "data/raw/nj-ccrc/ccrc.shtml.html").is_file()
        else "<html>Continuing Care Retirement Communities Disclosure Statement Certificate of Authority</html>"
    )
    discovery = discover_ccrc(html, retrieved_at="2026-09-02T00:00:00Z")
    assert discovery["registry_acquired"] is False
    assert discovery["coverage_state"] == "SOURCE_AVAILABLE_BY_REQUEST"
    assert discovery["providers"] == 0
    assert "not an NJDOH" in " ".join(discovery["notes"])
    assert "CCRC" not in TYPE_MAP
    assert "CCRC" not in LTC_TYPE_MAP


def test_metric_contract_has_trace_fields() -> None:
    row = metric_contract_row(
        metric_id="nj.all_acute.home_health",
        display_label="NJ Home Health Agencies (state license)",
        definition="Count of current All_Acute rows whose official type is Home Health Agency.",
        numerator="COUNT(*) WHERE official_facility_type_canonical = NJ_HHA",
        denominator="All_Acute source identities in the current snapshot",
        population="NJDOH Home Health Agency",
        included="Current All_Acute Home Health Agency licenses",
        excluded="Hospice, hospital, ambulatory, LTC",
        source="https://healthapps.nj.gov/facilities/documents2/All_Acute.xlsx",
        source_as_of="2026-08-31",
        retrieval_date="2026-09-02",
        source_hash_or_snapshot="pending-local-hash",
        geographic_grain="state",
        identity_rule="dataset_key=nj-doh-all-acute AND canonical=NJ_HHA",
        known_limitations="Office county is not service area.",
        publication_status="NOT_PUBLIC",
        trace="SELECT COUNT(*) FROM state_facility_identity WHERE dataset_key='nj-doh-all-acute' AND official_facility_type_canonical='NJ_HHA'",
        value=None,
    )
    assert row["publication_status"] == "NOT_PUBLIC"
    assert "NJ_HHA" in row["trace"]


def test_no_public_new_jersey_route_or_vercel_relink() -> None:
    """NJ-SEN-005 publishes /new-jersey. Do not relink Vercel. CA/NY/TX remain the DB-backed state regulators."""
    web = ROOT / "apps" / "web" / "src" / "app"
    assert (web / "new-jersey" / "page.tsx").is_file()
    sitemap = (web / "sitemaps" / "[file]" / "route.ts").read_text(encoding="utf-8")
    assert '"/new-jersey"' in sitemap
    assert not (ROOT / ".vercel" / "project.json").exists()
    sources = load_state_regulator_sources()
    implemented = {source.state_code for source in sources if source.implemented}
    assert implemented == {"CA", "NY", "TX"}


def test_real_acute_workbook_when_archived_locally() -> None:
    path = ROOT / "data" / "raw" / "nj-doh-acute" / "All_Acute.xlsx"
    if not path.is_file():
        return
    inspect = inspect_payload(path.read_bytes())
    assert inspect["worksheet_names"] == ["All_Acute"]
    assert inspect["source_rows"] >= 1000
    assert inspect["home_health_agencies"] >= 1
    assert inspect["hospice_programs"] >= 1
    assert inspect["hospice_branches"] >= 1
    assert inspect["hospice_inpatient"] >= 1
    assert inspect["unknown_types"] == {}
    parsed, quarantined = parse_acute_rows(
        __import__("care_ingest.nj_doh_acute", fromlist=["parse_acute_xlsx"]).parse_acute_xlsx(
            path.read_bytes()
        )[1]
    )
    assert quarantined == []
    assert ADAPTER_VERSION == "nj-doh-acute-v1"
    assert inspect["bytes"] == path.stat().st_size


def test_florida_and_cms_class_tables_unchanged() -> None:
    florida = (ROOT / "db" / "migrations" / "0028_florida_state_licensed_provider.sql").read_text(
        encoding="utf-8"
    )
    assert "CHECK (state_code = 'FL')" in florida
    hh = (ROOT / "db" / "migrations" / "0023_home_health_hospice_national.sql").read_text(
        encoding="utf-8"
    )
    assert "CREATE TABLE home_health_snapshot" in hh
    assert "CREATE TABLE hospice_snapshot" in hh
    assert "nj_home_health" not in hh
    migration = (
        ROOT / "db" / "migrations" / "0035_state_service_area_regulated_org.sql"
    ).read_text(encoding="utf-8")
    assert "CREATE TABLE state_facility_service_area" in migration
    assert "CREATE TABLE state_regulated_organization" in migration
    assert "CREATE TABLE nj_acute_facilities" not in migration
    assert "CREATE TABLE nj_ccrc" not in migration
    assert "DROP TABLE" not in migration
    assert "public_eligible boolean NOT NULL DEFAULT false" in migration
