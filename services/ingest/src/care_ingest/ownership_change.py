"""Classify CMS CHOW events without turning snapshot gaps into ownership changes."""

from __future__ import annotations

SNF_CHOW_DATASET = "skilled-nursing-facility-change-of-ownership"
SNF_CHOW_OWNERS_DATASET = "skilled-nursing-facility-change-of-ownership-owner-information"
SNF_CHOW_CMS_ID = "f557a6ed-95b3-4a22-8433-4175db2dec1c"
SNF_CHOW_OWNERS_CMS_ID = "a4358712-e910-4eaf-8f24-5e90ba3cf8d0"
SOURCE_AGENCY = "Centers for Medicare & Medicaid Services (CMS)"
TRANSFORMATION_VERSION = "ownership-change-v1"

EVENT_TYPES = (
    "CHANGE_OF_OWNERSHIP",
    "ACQUISITION_MERGER",
    "CONSOLIDATION",
    "OTHER",
    "UNKNOWN",
)
EVENT_STATUSES = ("CONFIRMED_EFFECTIVE",)
PARTICIPANT_ROLES = (
    "BUYER",
    "SELLER",
    "PRIOR_OWNER",
    "NEW_OWNER",
    "EVENT_PARTICIPANT",
    "OTHER",
)
LINK_ROLES = (
    "PRE_EVENT_OWNER",
    "POST_EVENT_OWNER",
    "EVENT_PARTICIPANT",
    "HISTORICAL_OWNER_UNLINKED_TO_EVENT",
    "CURRENT_OWNER_UNLINKED_TO_EVENT",
    "UNKNOWN",
)
TIMELINE_EVIDENCE_TYPES = (
    "OWNERSHIP_CHANGE_EVENT",
    "OWNERSHIP_OBSERVATION",
    "OPERATOR_OBSERVATION",
    "MANAGEMENT_OBSERVATION",
)

SOURCE_CLASS = {
    "skilled-nursing-facility-change-of-ownership": "EVENT_SOURCE",
    "skilled-nursing-facility-change-of-ownership-owner-information": "HISTORICAL_OWNER_SOURCE",
    "nursing-home-ownership": "CURRENT_OWNER_SOURCE",
    "skilled-nursing-facility-all-owners": "CURRENT_OWNER_SOURCE",
    "skilled-nursing-facility-enrollments": "ENROLLMENT_SOURCE",
    "home-health-agency-all-owners": "CURRENT_OWNER_SOURCE",
    "home-health-agency-enrollments": "ENROLLMENT_SOURCE",
    "hospice-all-owners": "CURRENT_OWNER_SOURCE",
    "hospice-enrollments": "ENROLLMENT_SOURCE",
}


def classify_source_dataset(dataset_key: str) -> str:
    return SOURCE_CLASS.get(dataset_key, "OTHER")


def home_health_event_availability() -> str:
    return "NOT AVAILABLE"


def hospice_event_availability() -> str:
    return "NOT AVAILABLE"


def snf_chow_has_pending_status() -> bool:
    return False


def snf_chow_event_status() -> str:
    return "CONFIRMED_EFFECTIVE"


def normalize_event_type(change_type_code: str, change_type_text: str) -> str:
    code = (change_type_code or "").strip().upper()
    if code == "CH":
        return "CHANGE_OF_OWNERSHIP"
    if code == "AM":
        return "ACQUISITION_MERGER"
    if code == "CO":
        return "CONSOLIDATION"
    if (change_type_text or "").strip():
        return "OTHER"
    return "UNKNOWN"


def event_confidence(*, provider_id_present: bool) -> str:
    return "CONFIRMED" if provider_id_present else "UNRESOLVED"


def participant_confidence(*, party_id_present: bool, organization_id_present: bool) -> str:
    if party_id_present or organization_id_present:
        return "CONFIRMED"
    return "UNRESOLVED"


def event_natural_key(
    *,
    ccn: str,
    buyer_pac: str,
    seller_pac: str,
    effective_date: str,
    change_type_code: str,
) -> str:
    return "|".join(
        (
            SNF_CHOW_DATASET,
            (ccn or "").strip().upper(),
            (buyer_pac or "").strip(),
            (seller_pac or "").strip(),
            (effective_date or "").strip(),
            (change_type_code or "").strip().upper(),
        )
    )


def snapshot_disappearance_creates_event() -> bool:
    return False


def unknown_relationship_is_divestiture() -> bool:
    return False


def historical_edge_creates_event() -> bool:
    return False


def provider_has_confirmed_change_history(*, attached_event_count: int) -> bool:
    return attached_event_count > 0


def unknown_edge_qualifies_change_history() -> bool:
    return False


def name_can_attach_event_to_provider() -> bool:
    return False


def name_can_canonicalize_participant() -> bool:
    return False


def management_role_is_ownership_change() -> bool:
    return False


def event_propagates_to_sibling_providers() -> bool:
    return False


def later_snapshot_invents_effective_to() -> bool:
    return False


def created_at_is_effective_date() -> bool:
    return False


def publication_date_is_effective_date() -> bool:
    return False


def legal_entity_role(side: str) -> str:
    if side == "buyer":
        return "BUYER"
    if side == "seller":
        return "SELLER"
    return "OTHER"


def owner_info_link_role(*, side: str, relationship_type: str) -> str:
    if relationship_type == "OWNED_BY" and side == "seller":
        return "PRE_EVENT_OWNER"
    if relationship_type == "OWNED_BY" and side == "buyer":
        return "POST_EVENT_OWNER"
    if side in {"buyer", "seller"}:
        return "EVENT_PARTICIPANT"
    return "UNKNOWN"


def timeline_evidence_type(relationship_class: str | None = None, *, is_event: bool = False) -> str:
    if is_event:
        return "OWNERSHIP_CHANGE_EVENT"
    if relationship_class == "OWNERSHIP":
        return "OWNERSHIP_OBSERVATION"
    if relationship_class == "OPERATOR":
        return "OPERATOR_OBSERVATION"
    if relationship_class == "MANAGEMENT":
        return "MANAGEMENT_OBSERVATION"
    return "OWNERSHIP_OBSERVATION"
