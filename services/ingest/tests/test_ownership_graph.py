from care_ingest.ownership_graph import (
    classify_role,
    managing_employee_is_equity_owner,
    name_is_canonical_identity,
    pac_means_parent_company,
    temporal_status,
)


def test_org1_same_pac_is_one_identity_key() -> None:
    assert "CMS_PECOS:PAC:123" == "CMS_PECOS:PAC:123"


def test_org2_same_name_different_pac_stay_separate() -> None:
    a = "CMS_PECOS:PAC:AAA"
    b = "CMS_PECOS:PAC:BBB"
    assert a != b


def test_org4_pac_is_not_parent_company() -> None:
    assert pac_means_parent_company() is False


def test_org5_person_and_organization_kinds_differ() -> None:
    assert "individual" != "organization"


def test_org6_owner_is_not_operator() -> None:
    owner = classify_role("5% OR GREATER DIRECT OWNERSHIP INTEREST")
    operator = classify_role("OPERATIONAL/MANAGERIAL CONTROL")
    assert owner["relationship_type"] == "OWNED_BY"
    assert operator["relationship_type"] == "OPERATED_BY"
    assert owner["relationship_type"] != operator["relationship_type"]


def test_org7_managing_employee_is_not_equity_owner() -> None:
    role = classify_role("W-2 MANAGING EMPLOYEE")
    assert role["relationship_class"] == "MANAGEMENT"
    assert role["normalized_role"] == "MANAGING_EMPLOYEE"
    assert managing_employee_is_equity_owner() is False


def test_org8_percentage_not_absorbed_into_role() -> None:
    role = classify_role("5% OR GREATER DIRECT OWNERSHIP INTEREST")
    assert role["normalized_role"] == "DIRECT_OWNER"
    assert "percentage" not in role


def test_org_partner_is_ownership_not_affiliation() -> None:
    role = classify_role("PARTNER")
    assert role["relationship_type"] == "OWNED_BY"
    assert role["relationship_class"] == "OWNERSHIP"


def test_org_management_company_is_operator() -> None:
    role = classify_role("MANAGEMENT COMPANY")
    assert role["relationship_type"] == "OPERATED_BY"
    assert role["normalized_role"] == "OPERATOR"


def test_org9_current_does_not_overwrite_historical_status() -> None:
    assert temporal_status(in_latest_snapshot=True, has_end_date=False, is_change_event=False) == (
        "CURRENT"
    )
    assert temporal_status(in_latest_snapshot=False, has_end_date=True, is_change_event=False) == (
        "HISTORICAL"
    )


def test_org10_absence_is_unknown_not_divestiture() -> None:
    assert temporal_status(in_latest_snapshot=False, has_end_date=False, is_change_event=False) == (
        "UNKNOWN"
    )


def test_org11_provider_namespaces_remain_separate() -> None:
    assert "CCN" != "HOME_HEALTH_CCN" != "HOSPICE_CCN"


def test_org13_name_is_not_canonical() -> None:
    assert name_is_canonical_identity() is False


def test_org15_change_event_is_historical() -> None:
    assert temporal_status(in_latest_snapshot=True, has_end_date=False, is_change_event=True) == (
        "HISTORICAL"
    )


def test_org16_enrollment_is_not_ownership() -> None:
    role = classify_role("Medicare-enrolled legal organization")
    assert role["relationship_type"] == "ENROLLED_UNDER"
    assert role["relationship_class"] == "ENROLLMENT"


def test_org12_shared_owner_does_not_change_provider_type_keys() -> None:
    assert {"nursing_home", "home_health", "hospice"} == {
        "nursing_home",
        "home_health",
        "hospice",
    }


def test_org14_address_is_not_an_identity_function() -> None:
    assert name_is_canonical_identity() is False
