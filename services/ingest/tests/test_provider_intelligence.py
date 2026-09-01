from care_ingest.provider_intelligence import (
    IDENTIFIER_BY_TYPE,
    PERSON_PUBLICATION_POLICY,
    SAFE_CLAIMS,
    UNSUPPORTED_CLAIMS,
    absence_means_closed,
    chow_history_available,
    chow_means_sale,
    chow_unavailability_reason,
    cms_star_is_trust_hub_rating,
    combined_senior_denominator_allowed,
    fingerprint_includes_generated_at,
    fingerprint_payload,
    identifier_type_for,
    limitations_for,
    missing_quality_is_zero,
    name_is_provider_identity,
    profile_intelligence_status,
    project_directory_status,
    provider_type_may_silently_change,
    public_organization_route_allowed,
    public_person_profile_allowed,
    quality_value_state,
    unknown_owner_is_former_owner,
    zip_is_county_service,
)


def test_prof1_canonical_id_not_name() -> None:
    assert name_is_provider_identity() is False
    assert identifier_type_for("nursing_home") == "CCN"


def test_prof2_provider_type_cannot_silently_change() -> None:
    assert provider_type_may_silently_change() is False
    assert IDENTIFIER_BY_TYPE["home_health"] == "HOME_HEALTH_CCN"
    assert IDENTIFIER_BY_TYPE["hospice"] == "HOSPICE_CCN"


def test_prof3_class_specific_identifiers_are_explicit() -> None:
    assert identifier_type_for("nursing_home") != identifier_type_for("home_health")


def test_prof4_and_5_directory_semantics() -> None:
    assert (
        project_directory_status(
            provider_type="nursing_home",
            official_status="CURRENT_ACTIVE",
            has_class_directory_row=True,
        )
        == "CURRENT_DIRECTORY"
    )
    assert (
        project_directory_status(
            provider_type="nursing_home",
            official_status="ABSENT_FROM_CURRENT_DIRECTORY",
            has_class_directory_row=False,
        )
        == "KNOWN_NOT_CURRENT"
    )
    assert absence_means_closed() is False


def test_prof6_fingerprint_excludes_generated_at() -> None:
    assert fingerprint_includes_generated_at() is False
    first = fingerprint_payload({"canonical_id": "015009", "generated_at": "a"})
    second = fingerprint_payload({"canonical_id": "015009", "generated_at": "b"})
    assert first == second


def test_prof7_missing_quality_is_not_zero() -> None:
    assert missing_quality_is_zero() is False
    assert quality_value_state(None) == "NOT_REPORTED"
    assert quality_value_state("", availability="SUPPRESSED") == "SUPPRESSED"


def test_prof10_unresolved_edges_not_in_contract_as_confirmed() -> None:
    assert "unresolved" not in SAFE_CLAIMS


def test_prof16_cms_stars_are_cms() -> None:
    assert cms_star_is_trust_hub_rating() is False


def test_prof17_20_chow_rules() -> None:
    assert chow_history_available("nursing_home") is True
    assert chow_means_sale() is False
    assert unknown_owner_is_former_owner() is False
    assert "sale" not in SAFE_CLAIMS["chow_event"].lower()


def test_prof21_27_identifiers() -> None:
    assert identifier_type_for("home_health") == "HOME_HEALTH_CCN"
    assert identifier_type_for("hospice") == "HOSPICE_CCN"


def test_prof24_32_zip_not_county() -> None:
    assert zip_is_county_service() is False
    assert "county" in UNSUPPORTED_CLAIMS["county_service"]


def test_prof25_33_hh_hospice_chow_unsupported() -> None:
    assert chow_history_available("home_health") is False
    assert chow_history_available("hospice") is False
    assert chow_unavailability_reason("home_health") == "NO_PUBLIC_CMS_CHOW_SOURCE"
    assert chow_unavailability_reason("hospice") == "NO_PUBLIC_CMS_CHOW_SOURCE"


def test_prof30_hospice_evidence_only() -> None:
    assert (
        project_directory_status(
            provider_type="hospice",
            official_status=None,
            has_class_directory_row=False,
        )
        == "EVIDENCE_ONLY"
    )
    assert (
        profile_intelligence_status(
            provider_type="hospice",
            directory_projection="EVIDENCE_ONLY",
            has_identity=True,
            has_core_evidence=False,
        )
        == "EVIDENCE_ONLY"
    )


def test_prof34_35_no_public_person_or_org_routes() -> None:
    assert public_person_profile_allowed() is False
    assert public_organization_route_allowed() is False
    assert "NO_PUBLIC_PROFILE" in PERSON_PUBLICATION_POLICY


def test_prof36_39_no_scores_or_combined_denominator() -> None:
    assert combined_senior_denominator_allowed() is False
    assert "senior quality score" in UNSUPPORTED_CLAIMS["combined_quality"]


def test_nh_ready_does_not_require_chow() -> None:
    assert (
        profile_intelligence_status(
            provider_type="nursing_home",
            directory_projection="CURRENT_DIRECTORY",
            has_identity=True,
            has_core_evidence=True,
        )
        == "READY"
    )
    assert (
        profile_intelligence_status(
            provider_type="nursing_home",
            directory_projection="KNOWN_NOT_CURRENT",
            has_identity=True,
            has_core_evidence=True,
        )
        == "PARTIAL"
    )


def test_limitations_are_class_specific() -> None:
    hh = limitations_for("home_health")
    hospice = limitations_for("hospice")
    nh = limitations_for("nursing_home")
    assert any("ZIP" in item for item in hh)
    assert any("6,669" in item or "General Information" in item for item in hospice)
    assert any("CHOW" in item for item in nh)
