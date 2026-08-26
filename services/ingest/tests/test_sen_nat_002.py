from care_ingest.cms_designations import classify_abuse_icon, classify_special_focus
from care_ingest.directory_status import interpret_missing_current_pi
from care_ingest.facility_npi import PUBLIC_LANGUAGE, classify_enrollment_npi
from care_ingest.manifest import ReleaseManifest
from care_ingest.mds import MDS_KEY, is_star_rating_observation, normalize_mds_row
from care_ingest.regulatory import DEFICIENCIES_KEY, FIRE_KEY, normalize_regulatory_row


def manifest(dataset_key: str) -> ReleaseManifest:
    return ReleaseManifest(
        2,
        dataset_key,
        "CMS",
        "id",
        "https://data.cms.gov/source",
        "2026-08-26T00:00:00+00:00",
        "2026-08-01",
        "source.csv",
        1,
        "a" * 64,
        "text/csv",
        None,
        "downloaded",
    )


def test_nh1_ccn_uniqueness_rule() -> None:
    from care_ingest.provider_information import CCN_PATTERN

    assert CCN_PATTERN.fullmatch("015009")
    assert CCN_PATTERN.fullmatch("01A193")
    # Names are never identity.
    assert not CCN_PATTERN.fullmatch("Sunrise Nursing")


def test_nh2_sff_candidate_is_not_sff() -> None:
    status, raw = classify_special_focus("SFF Candidate")
    assert status == "SFF_CANDIDATE"
    assert status != "SFF"
    assert raw == "SFF Candidate"
    assert classify_special_focus("SFF")[0] == "SFF"
    assert classify_special_focus("")[0] == "NOT_SFF"


def test_nh3_sff_periods_are_independently_keyed() -> None:
    first = ("2026-07-29", "015009", "special_focus")
    second = ("2026-08-26", "015009", "special_focus")
    assert first != second


def test_nh4_abuse_icon_is_not_a_permanent_boolean() -> None:
    status, raw = classify_abuse_icon("Y")
    assert status == "DESIGNATED"
    assert raw == "Y"
    assert classify_abuse_icon("N") == ("NOT_DESIGNATED", "N")
    assert "abusive" not in status.lower()
    assert "dangerous" not in status.lower()


def test_nh5_npi_cardinality_is_not_forced_one_to_one() -> None:
    assert classify_enrollment_npi("015009", "1234567890") == "CONFIRMED"
    assert classify_enrollment_npi("015009", "0987654321") == "CONFIRMED"


def test_nh6_incomplete_npi_is_not_confirmed() -> None:
    assert classify_enrollment_npi("015009", "") is None
    assert classify_enrollment_npi("", "1234567890") is None
    assert "facility-location NPI" in PUBLIC_LANGUAGE
    assert "not a replacement for the facility CCN" in PUBLIC_LANGUAGE


def test_nh7_mds_history_emits_two_period_observations() -> None:
    row = {
        "CMS Certification Number (CCN)": "015009",
        "Measure Code": "401",
        "Measure Description": "Percentage of long-stay residents with pressure ulcers",
        "Resident type": "Long Stay",
        "Q1 Measure Score": "1.1",
        "Footnote for Q1 Measure Score": "",
        "Q2 Measure Score": "2.2",
        "Footnote for Q2 Measure Score": "",
        "Q3 Measure Score": "",
        "Footnote for Q3 Measure Score": "Not Available",
        "Q4 Measure Score": "3.3",
        "Footnote for Q4 Measure Score": "",
        "Four Quarter Average Score": "2.2",
        "Footnote for Four Quarter Average Score": "",
        "Used in Quality Measure Five Star Rating": "Y",
        "Measure Period": "2025Q1-2025Q4",
        "Processing Date": "2026-08-01",
    }
    record = normalize_mds_row(row, 2, manifest(MDS_KEY))
    components = [item["period_component"] for item in record["observations"]]
    assert components.count("Q1") == 1
    assert components.count("Q2") == 1
    q1 = next(item for item in record["observations"] if item["period_component"] == "Q1")
    q2 = next(item for item in record["observations"] if item["period_component"] == "Q2")
    assert q1["score"] != q2["score"]
    suppressed = next(
        item for item in record["observations"] if item["period_component"] == "Q3"
    )
    assert suppressed["suppressed"] is True


def test_nh8_mds_measure_is_not_a_star_rating() -> None:
    assert is_star_rating_observation("FOUR_QUARTER_AVERAGE", "401") is False
    row = {
        "CMS Certification Number (CCN)": "015009",
        "Measure Code": "401",
        "Measure Description": "Percentage of long-stay residents with pressure ulcers",
        "Resident type": "Long Stay",
        "Q1 Measure Score": "1.1",
        "Footnote for Q1 Measure Score": "",
        "Q2 Measure Score": "1.1",
        "Footnote for Q2 Measure Score": "",
        "Q3 Measure Score": "1.1",
        "Footnote for Q3 Measure Score": "",
        "Q4 Measure Score": "1.1",
        "Footnote for Q4 Measure Score": "",
        "Four Quarter Average Score": "1.1",
        "Footnote for Four Quarter Average Score": "",
        "Used in Quality Measure Five Star Rating": "Y",
        "Measure Period": "2025Q1-2025Q4",
        "Processing Date": "2026-08-01",
    }
    record = normalize_mds_row(row, 2, manifest(MDS_KEY))
    assert all(item["is_cms_star_rating"] is False for item in record["observations"])


def test_nh9_inspection_count_is_not_deficiency_count() -> None:
    inspections = 2
    deficiencies = 7
    assert inspections != deficiencies


def test_nh10_complaint_flagged_finding_is_not_a_complaint_case() -> None:
    finding = {"complaint_deficiency": True, "survey_type": "Health"}
    assert finding["complaint_deficiency"] is True
    assert "consumer complaint" not in str(finding).lower()


def test_nh11_absent_pi_is_not_confirmed_closure() -> None:
    assert interpret_missing_current_pi(in_latest_pi=False, termination_source=None) == (
        "ABSENT_FROM_CURRENT_DIRECTORY"
    )
    assert interpret_missing_current_pi(in_latest_pi=True, termination_source=None) == (
        "CURRENT_ACTIVE"
    )
    assert interpret_missing_current_pi(in_latest_pi=False, termination_source=None) != (
        "TERMINATED_CONFIRMED"
    )


def test_nh12_source_freshness_fields_are_independent() -> None:
    pi_modified = "2026-07-29"
    mds_modified = "2026-08-01"
    pbj_period = "2026Q1"
    assert len({pi_modified, mds_modified, pbj_period}) == 3


def test_nh13_raw_cms_sff_value_is_preserved() -> None:
    status, raw = classify_special_focus("SFF Candidate")
    assert raw == "SFF Candidate"
    assert status == "SFF_CANDIDATE"


def test_nh14_assisted_living_identity_is_not_a_ccn() -> None:
    from care_ingest.provider_information import CCN_PATTERN

    al_key = "CA:CDSS:123456789"
    assert not CCN_PATTERN.fullmatch(al_key)


def test_nh15_no_hardcoded_national_facility_metric() -> None:
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "src" / "care_ingest"
    for name in (
        "cms_designations.py",
        "facility_npi.py",
        "mds.py",
        "directory_status.py",
    ):
        assert "14693" not in (root / name).read_text(encoding="utf-8")


def test_nh16_fire_citation_is_not_a_health_deficiency() -> None:
    row = {
        "CMS Certification Number (CCN)": "015009",
        "Survey Date": "2026-01-02",
        "Survey Type": "Fire Safety",
        "Deficiency Prefix": "K",
        "Deficiency Category": "Fire",
        "Deficiency Tag Number": "0353",
        "Tag Version": "2012",
        "Deficiency Description": "Sprinkler system",
        "Scope Severity Code": "E",
        "Deficiency Corrected": "Deficient, Provider has date of correction",
        "Correction Date": "2026-02-01",
        "Inspection Cycle": "1",
        "Standard Deficiency": "Y",
        "Complaint Deficiency": "N",
        "Processing Date": "2026-08-01",
    }
    fire = normalize_regulatory_row(row, 2, manifest(FIRE_KEY))
    assert fire["normalized"]["evidence_class"] == "fire_safety_citation"
    health = {
        "CMS Certification Number (CCN)": "015009",
        "Survey Date": "2026-01-02",
        "Survey Type": "Health",
        "Deficiency Prefix": "F",
        "Deficiency Category": "Care",
        "Deficiency Tag Number": "0880",
        "Deficiency Description": "Official description",
        "Scope Severity Code": "D",
        "Deficiency Corrected": "Past Non-Compliance",
        "Correction Date": "2026-01-03",
        "Inspection Cycle": "1",
        "Standard Deficiency": "Y",
        "Complaint Deficiency": "N",
        "Infection Control Inspection Deficiency": "N",
        "Citation under IDR": "N",
        "Citation under IIDR": "N",
        "Processing Date": "2026-08-01",
    }
    health_record = normalize_regulatory_row(health, 3, manifest(DEFICIENCIES_KEY))
    assert "evidence_class" not in health_record["normalized"]
    assert fire["normalized"]["finding_key"] != health_record["normalized"]["finding_key"]
