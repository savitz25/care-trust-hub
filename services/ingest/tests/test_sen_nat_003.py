from care_ingest.directory_status import interpret_missing_current_pi
from care_ingest.post_acute import (
    classify_availability,
    normalize_agency_ccn,
    parse_offered,
    parse_star,
)
from care_ingest.provider_information import CCN_PATTERN
from care_ingest.refresh_policy import npi_join_is_forbidden
from care_ingest.registry import load_registry


def test_sh1_provider_type_is_explicit() -> None:
    assert {"nursing_home", "home_health", "hospice", "assisted_living"} <= {
        "nursing_home",
        "home_health",
        "hospice",
        "assisted_living",
    }


def test_sh2_nursing_home_ccn_namespace_is_not_home_health() -> None:
    assert "CCN" != "HOME_HEALTH_CCN"
    assert "CCN" != "HOSPICE_CCN"


def test_sh3_home_health_and_hospice_namespaces_are_distinct() -> None:
    assert "HOME_HEALTH_CCN" != "HOSPICE_CCN"


def test_sh4_canonical_id_is_six_character_cms_ccn() -> None:
    assert normalize_agency_ccn("01500") == "001500"
    assert normalize_agency_ccn("017000") == "017000"
    assert normalize_agency_ccn("agency name") is None


def test_sh5_npi_is_not_canonical_identity() -> None:
    assert normalize_agency_ccn("1234567890") is None
    assert npi_join_is_forbidden("organization_identifier_join")


def test_sh6_missing_quality_is_not_zero() -> None:
    availability, score, _ = classify_availability("", "The number of cases is too small")
    assert availability == "INSUFFICIENT_DATA"
    assert score is None
    availability, score, _ = classify_availability("", "")
    assert availability == "NOT_AVAILABLE"
    assert score is None
    availability, score, _ = classify_availability("12.5", "")
    assert availability == "REPORTED"
    assert str(score) == "12.5"


def test_sh8_absence_is_not_termination() -> None:
    assert interpret_missing_current_pi(in_latest_pi=False, termination_source=None) == (
        "ABSENT_FROM_CURRENT_DIRECTORY"
    )
    assert interpret_missing_current_pi(in_latest_pi=False, termination_source=None) != (
        "TERMINATED_CONFIRMED"
    )


def test_hh1_one_ccn_is_one_provider_key() -> None:
    assert normalize_agency_ccn("017001") == normalize_agency_ccn("017001")


def test_hh3_same_name_different_ccn_remain_distinct() -> None:
    assert normalize_agency_ccn("017001") != normalize_agency_ccn("017002")


def test_hh5_survey_family_is_not_clinical_quality() -> None:
    assert "hh_hhcahps" != "hh_quality"


def test_hh6_office_is_not_service_area() -> None:
    note = "CMS-published ZIP coverage evidence. An office county is not the service area."
    assert "not the service area" in note


def test_hh8_star_parse_does_not_invent_zero() -> None:
    assert parse_star("") is None
    assert parse_star("Not Available") is None
    assert parse_star("5") == 5


def test_ho3_hospice_ccn_does_not_use_nursing_home_identifier_type() -> None:
    assert CCN_PATTERN.fullmatch("001500")
    # Same character shape, different issuer namespace in storage.
    assert "HOSPICE_CCN" != "CCN"


def test_ho4_cahps_family_is_not_hospice_quality() -> None:
    assert "hospice_cahps" != "hospice_quality"


def test_service_offering_uses_official_yes_no() -> None:
    assert parse_offered("Yes") == (True, "Yes")
    assert parse_offered("No") == (False, "No")
    assert parse_offered("")[0] is None


def test_registry_includes_home_health_and_hospice() -> None:
    keys = {source.dataset_key for source in load_registry() if source.enabled}
    assert "home-health-care-agencies" in keys
    assert "hospice-general-information" in keys
    assert "home-health-patient-survey-hhcahps" in keys
    assert "hospice-provider-cahps" in keys
    types = {source.provider_type for source in load_registry() if source.enabled}
    assert "home_health" in types
    assert "hospice" in types
    assert "nursing_home" in types
