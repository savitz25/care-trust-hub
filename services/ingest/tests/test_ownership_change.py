from care_ingest.ownership_change import (
    classify_source_dataset,
    created_at_is_effective_date,
    event_confidence,
    event_natural_key,
    event_propagates_to_sibling_providers,
    historical_edge_creates_event,
    home_health_event_availability,
    hospice_event_availability,
    later_snapshot_invents_effective_to,
    legal_entity_role,
    management_role_is_ownership_change,
    name_can_attach_event_to_provider,
    name_can_canonicalize_participant,
    normalize_event_type,
    owner_info_link_role,
    participant_confidence,
    provider_has_confirmed_change_history,
    publication_date_is_effective_date,
    snapshot_disappearance_creates_event,
    snf_chow_event_status,
    snf_chow_has_pending_status,
    timeline_evidence_type,
    unknown_edge_qualifies_change_history,
    unknown_relationship_is_divestiture,
)


def test_chow1_natural_key_is_stable() -> None:
    key = event_natural_key(
        ccn="015001",
        buyer_pac="111",
        seller_pac="222",
        effective_date="2025-05-01",
        change_type_code="CH",
    )
    again = event_natural_key(
        ccn="015001",
        buyer_pac="111",
        seller_pac="222",
        effective_date="2025-05-01",
        change_type_code="CH",
    )
    assert key == again
    assert "015001" in key
    assert "BUYER LLC" not in key


def test_chow2_event_confidence_requires_provider_id() -> None:
    assert event_confidence(provider_id_present=True) == "CONFIRMED"
    assert event_confidence(provider_id_present=False) == "UNRESOLVED"


def test_chow3_name_cannot_attach_event() -> None:
    assert name_can_attach_event_to_provider() is False


def test_chow4_unknown_is_not_historical_or_divestiture() -> None:
    assert unknown_relationship_is_divestiture() is False


def test_chow5_snapshot_gap_is_not_an_event() -> None:
    assert snapshot_disappearance_creates_event() is False


def test_chow6_created_and_publication_are_not_effective_dates() -> None:
    assert created_at_is_effective_date() is False
    assert publication_date_is_effective_date() is False


def test_chow7_and_8_raw_type_preserved_separately_from_normalized() -> None:
    assert normalize_event_type("CH", "CHANGE OF OWNERSHIP") == "CHANGE_OF_OWNERSHIP"
    assert normalize_event_type("AM", "ACQUISITION/MERGER") == "ACQUISITION_MERGER"
    assert normalize_event_type("CO", "CONSOLIDATION") == "CONSOLIDATION"
    assert normalize_event_type("CH", "CHANGE OF OWNERSHIP") != "ACQUISITION/MERGER"


def test_chow9_person_and_org_confidence_are_independent() -> None:
    assert participant_confidence(party_id_present=True, organization_id_present=False) == (
        "CONFIRMED"
    )
    assert participant_confidence(party_id_present=False, organization_id_present=False) == (
        "UNRESOLVED"
    )


def test_chow10_name_does_not_canonicalize_participant() -> None:
    assert name_can_canonicalize_participant() is False


def test_chow11_event_can_be_confirmed_while_party_unresolved() -> None:
    assert event_confidence(provider_id_present=True) == "CONFIRMED"
    assert participant_confidence(party_id_present=False, organization_id_present=False) == (
        "UNRESOLVED"
    )


def test_chow12_historical_edge_does_not_create_event() -> None:
    assert historical_edge_creates_event() is False


def test_chow13_attached_event_qualifies_history() -> None:
    assert provider_has_confirmed_change_history(attached_event_count=1) is True


def test_chow14_unknown_edge_does_not_qualify_history() -> None:
    assert unknown_edge_qualifies_change_history() is False
    assert provider_has_confirmed_change_history(attached_event_count=0) is False


def test_chow15_prior_post_only_for_owned_by_on_supported_side() -> None:
    assert owner_info_link_role(side="seller", relationship_type="OWNED_BY") == "PRE_EVENT_OWNER"
    assert owner_info_link_role(side="buyer", relationship_type="OWNED_BY") == "POST_EVENT_OWNER"
    assert owner_info_link_role(side="seller", relationship_type="MANAGED_BY") == (
        "EVENT_PARTICIPANT"
    )


def test_chow16_later_snapshot_does_not_invent_effective_to() -> None:
    assert later_snapshot_invents_effective_to() is False


def test_chow18_management_is_not_chow() -> None:
    assert management_role_is_ownership_change() is False
    assert classify_source_dataset("skilled-nursing-facility-all-owners") != "EVENT_SOURCE"


def test_chow20_event_does_not_propagate() -> None:
    assert event_propagates_to_sibling_providers() is False


def test_source_inventory_classes() -> None:
    assert classify_source_dataset("skilled-nursing-facility-change-of-ownership") == (
        "EVENT_SOURCE"
    )
    assert (
        classify_source_dataset("skilled-nursing-facility-change-of-ownership-owner-information")
        == "HISTORICAL_OWNER_SOURCE"
    )
    assert classify_source_dataset("home-health-agency-all-owners") == "CURRENT_OWNER_SOURCE"
    assert classify_source_dataset("hospice-enrollments") == "ENROLLMENT_SOURCE"


def test_hh_and_hospice_have_no_event_source() -> None:
    assert home_health_event_availability() == "NOT AVAILABLE"
    assert hospice_event_availability() == "NOT AVAILABLE"


def test_snf_chow_is_effective_only() -> None:
    assert snf_chow_has_pending_status() is False
    assert snf_chow_event_status() == "CONFIRMED_EFFECTIVE"


def test_legal_entity_roles_use_cms_buyer_seller() -> None:
    assert legal_entity_role("buyer") == "BUYER"
    assert legal_entity_role("seller") == "SELLER"


def test_timeline_separates_evidence_types() -> None:
    assert timeline_evidence_type(is_event=True) == "OWNERSHIP_CHANGE_EVENT"
    assert timeline_evidence_type("OWNERSHIP") == "OWNERSHIP_OBSERVATION"
    assert timeline_evidence_type("OPERATOR") == "OPERATOR_OBSERVATION"
    assert timeline_evidence_type("MANAGEMENT") == "MANAGEMENT_OBSERVATION"
