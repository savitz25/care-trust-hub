"""Classify CMS/PECOS ownership roles without collapsing owner, operator, or enrollment."""

from __future__ import annotations

RELATIONSHIP_TYPES = (
    "OWNED_BY",
    "OPERATED_BY",
    "MANAGED_BY",
    "ENROLLED_UNDER",
    "AFFILIATED_WITH",
)
RELATIONSHIP_CLASSES = (
    "OWNERSHIP",
    "OPERATOR",
    "MANAGEMENT",
    "ENROLLMENT",
    "OFFICER",
    "AUTHORIZED_OFFICIAL",
    "AFFILIATION",
    "OTHER",
)
NORMALIZED_ROLES = (
    "OWNER",
    "DIRECT_OWNER",
    "INDIRECT_OWNER",
    "OPERATOR",
    "MANAGING_ORGANIZATION",
    "MANAGING_EMPLOYEE",
    "AUTHORIZED_OFFICIAL",
    "OFFICER",
    "DIRECTOR",
    "PARTNER",
    "ENROLLED_ORGANIZATION",
    "CHAIN_ORGANIZATION",
    "OTHER",
    "UNKNOWN",
)
TEMPORAL_STATUSES = ("CURRENT", "HISTORICAL", "UNKNOWN")


def classify_role(raw_role_text: str, *, party_kind: str | None = None) -> dict[str, str]:
    del party_kind
    text = (raw_role_text or "").strip()
    lowered = text.upper()
    if text == "Medicare-enrolled legal organization" or "ENROLLED" in lowered:
        return {
            "relationship_type": "ENROLLED_UNDER",
            "relationship_class": "ENROLLMENT",
            "normalized_role": "ENROLLED_ORGANIZATION",
        }
    if "MANAGING EMPLOYEE" in lowered or lowered.startswith("W-2"):
        return {
            "relationship_type": "MANAGED_BY",
            "relationship_class": "MANAGEMENT",
            "normalized_role": "MANAGING_EMPLOYEE",
        }
    if "AUTHORIZED OFFICIAL" in lowered:
        return {
            "relationship_type": "AFFILIATED_WITH",
            "relationship_class": "AUTHORIZED_OFFICIAL",
            "normalized_role": "AUTHORIZED_OFFICIAL",
        }
    if "DIRECTOR" in lowered:
        return {
            "relationship_type": "AFFILIATED_WITH",
            "relationship_class": "OFFICER",
            "normalized_role": "DIRECTOR",
        }
    if "OFFICER" in lowered:
        return {
            "relationship_type": "AFFILIATED_WITH",
            "relationship_class": "OFFICER",
            "normalized_role": "OFFICER",
        }
    if "PARTNER" in lowered:
        return {
            "relationship_type": "OWNED_BY",
            "relationship_class": "OWNERSHIP",
            "normalized_role": "PARTNER",
        }
    if (
        "OPERATIONAL" in lowered
        or "MANAGERIAL CONTROL" in lowered
        or "MANAGEMENT COMPANY" in lowered
    ):
        return {
            "relationship_type": "OPERATED_BY",
            "relationship_class": "OPERATOR",
            "normalized_role": "OPERATOR",
        }
    if "INDIRECT" in lowered and "OWNER" in lowered:
        return {
            "relationship_type": "OWNED_BY",
            "relationship_class": "OWNERSHIP",
            "normalized_role": "INDIRECT_OWNER",
        }
    if "DIRECT" in lowered and "OWNER" in lowered:
        return {
            "relationship_type": "OWNED_BY",
            "relationship_class": "OWNERSHIP",
            "normalized_role": "DIRECT_OWNER",
        }
    if "OWNER" in lowered or "OWNERSHIP" in lowered:
        return {
            "relationship_type": "OWNED_BY",
            "relationship_class": "OWNERSHIP",
            "normalized_role": "OWNER",
        }
    if not text:
        return {
            "relationship_type": "AFFILIATED_WITH",
            "relationship_class": "OTHER",
            "normalized_role": "UNKNOWN",
        }
    return {
        "relationship_type": "AFFILIATED_WITH",
        "relationship_class": "OTHER",
        "normalized_role": "OTHER",
    }


def temporal_status(*, in_latest_snapshot: bool, has_end_date: bool, is_change_event: bool) -> str:
    if is_change_event or has_end_date:
        return "HISTORICAL"
    if in_latest_snapshot:
        return "CURRENT"
    return "UNKNOWN"


def pac_means_parent_company() -> bool:
    return False


def name_is_canonical_identity() -> bool:
    return False


def managing_employee_is_equity_owner() -> bool:
    return False
