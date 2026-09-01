from care_ingest.senior_intelligence import (
    LIMITATIONS,
    METRICS,
    TOPLINES,
    chow_is_quality_or_stability_score,
    combined_senior_provider_denominator_allowed,
    fingerprint_includes_generated_at,
    pac_is_parent_company,
    unknown_counts_as_historical,
    zip_is_county_service_area,
)


def _metric(key: str) -> dict:
    return next(item for item in METRICS if item["metric_key"] == key)


def test_int1_nh_current_is_directory_not_known() -> None:
    current = _metric("nh_current")
    known = _metric("nh_known")
    assert current["publication_status"] == "PUBLIC_READY"
    assert known["publication_status"] == "INTERNAL_ONLY"
    assert "CURRENT_ACTIVE" in str(current["definition"])


def test_int2_hospice_current_is_gi_not_typed() -> None:
    current = _metric("hospice_current")
    typed = _metric("hospice_typed_identities")
    assert "General Information" in str(current["definition"])
    assert typed["publication_status"] == "INTERNAL_ONLY"
    extra = _metric("hospice_quality_only_non_directory")
    assert extra["derivation"] == "DERIVED"


def test_int3_hh_current_is_own_class() -> None:
    assert _metric("hh_current")["provider_type"] == "home_health"


def test_int4_classes_never_combined() -> None:
    assert combined_senior_provider_denominator_allowed() is False
    combined = _metric("combined_cms_senior_providers")
    assert combined["computability_status"] == "UNSUPPORTED"
    assert combined["publication_status"] == "DO_NOT_PUBLISH"


def test_int5_assisted_living_has_no_cms_national_count() -> None:
    metric = _metric("assisted_living_cms_national_count")
    assert metric["computability_status"] == "UNSUPPORTED"


def test_int6_memory_care_has_no_cms_national_count() -> None:
    metric = _metric("memory_care_cms_national_count")
    assert metric["computability_status"] == "UNSUPPORTED"


def test_int7_missing_quality_is_not_zero() -> None:
    assert "Missing evidence is not zero" in str(_metric("nh_mds_quality_coverage")["limitations"])


def test_int8_and_9_quality_families_stay_separate() -> None:
    score = _metric("nh_quality_combined_score")
    assert score["computability_status"] == "UNSUPPORTED"
    assert "hospice CAHPS" in str(_metric("hh_hhcahps_coverage")["limitations"])


def test_int10_and_11_entity_classes_are_distinct() -> None:
    assert _metric("unresolved_provider_org_edges")["entity_class"] == "OBSERVATION"
    assert _metric("canonical_organizations")["entity_class"] == "ORGANIZATION"
    assert _metric("nh_current")["entity_class"] == "PROVIDER"
    assert _metric("nh_chow_events")["entity_class"] == "EVENT"


def test_int12_unresolved_edges_are_internal_observation_counts() -> None:
    metric = _metric("unresolved_provider_org_edges")
    assert "not linked to a provider" in str(metric["language_safe"])


def test_int13_unknown_is_not_former_owner() -> None:
    assert unknown_counts_as_historical() is False
    assert "UNKNOWN ≠ HISTORICAL" in str(_metric("unknown_ownership_edges")["limitations"])


def test_int14_and_15_chow_event_and_provider_denominators_differ() -> None:
    events = _metric("nh_chow_events")
    providers = _metric("nh_chow_history_providers")
    assert events["entity_class"] == "EVENT"
    assert providers["entity_class"] == "PROVIDER"


def test_int16_and_17_hh_hospice_have_no_chow_metric() -> None:
    assert _metric("hh_chow_history_providers")["computability_status"] == "UNSUPPORTED"
    assert _metric("hospice_chow_history_providers")["computability_status"] == "UNSUPPORTED"


def test_int18_pac_is_not_parent_company() -> None:
    assert pac_is_parent_company() is False
    assert "not parent company" in str(_metric("cross_class_organizations")["limitations"])


def test_int19_and_20_zip_and_office_geography() -> None:
    assert zip_is_county_service_area() is False
    assert _metric("county_service_area_providers")["computability_status"] == "UNSUPPORTED"
    assert "Office geography" in str(_metric("org_multi_state_office_footprint")["limitations"])


def test_int21_derived_metrics_declare_numerator_and_denominator() -> None:
    derived = [item for item in METRICS if item["derivation"] == "DERIVED"]
    coverage = [item for item in derived if item["computability_status"] == "COMPUTABLE"]
    assert coverage
    assert all(item["numerator_definition"] and item["denominator_definition"] for item in coverage)


def test_int22_freshness_is_source_specific() -> None:
    assert "not a global last-updated" in str(_metric("source_freshness_bands")["freshness_rule"])


def test_int23_fingerprint_excludes_generated_at() -> None:
    assert fingerprint_includes_generated_at() is False


def test_int26_no_ranking_or_turnover_score() -> None:
    assert chow_is_quality_or_stability_score() is False
    assert TOPLINES["Ownership Turnover Rate"] == "DO_NOT_USE"
    assert TOPLINES["National Senior Quality Score"] == "DO_NOT_USE"
    assert TOPLINES["Best Senior Providers"] == "DO_NOT_USE"


def test_int27_no_public_person_owner_metric() -> None:
    keys = {item["metric_key"] for item in METRICS}
    assert "public_person_owners" not in keys


def test_int30_evidence_language_is_locked() -> None:
    titles = {item["limitation_key"] for item in LIMITATIONS}
    assert "ownership_is_not_quality" in titles
    assert "classes_are_separate" in titles


def test_toplines_never_use_combined_senior_total() -> None:
    assert TOPLINES["Total Senior Providers"] == "DO_NOT_USE"
    assert TOPLINES["Current CMS Nursing Homes"] == "PUBLIC_READY"
