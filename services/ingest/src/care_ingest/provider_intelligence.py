"""Class-aware Provider Intelligence contract. No combined scores or fabricated CHOW."""

from __future__ import annotations

import hashlib
import json
from typing import Any

CONTRACT_VERSION = "provider-intel-v1"
TRANSFORMATION_VERSION = "provider-intel-v1"
NATIONAL_INTEL_SNAPSHOT = "senior-national-intel-v1"

IDENTIFIER_BY_TYPE = {
    "nursing_home": "CCN",
    "home_health": "HOME_HEALTH_CCN",
    "hospice": "HOSPICE_CCN",
}

DIRECTORY_PROJECTION = {
    "CURRENT_ACTIVE": "CURRENT_DIRECTORY",
    "ABSENT_FROM_CURRENT_DIRECTORY": "KNOWN_NOT_CURRENT",
}

PERSON_PUBLICATION_POLICY = "SOURCE_EVIDENCE_ONLY_NO_PUBLIC_PROFILE"

SAFE_CLAIMS = {
    "current_directory": "CMS reports this provider in its current directory.",
    "quality_available": "CMS quality data is available for this provider.",
    "chow_event": "CMS records show an ownership change effective {effective_date}.",
    "zip_coverage": "CMS ZIP coverage records include ZIP {zip_code}.",
}

UNSUPPORTED_CLAIMS = {
    "hh_chow_none": "This home-health agency has never changed ownership.",
    "hospice_chow_none": "This hospice has never changed ownership.",
    "county_service": "This provider serves this county.",
    "trust_rating": "Trust Hub rating",
    "combined_quality": "senior quality score",
}


def identifier_type_for(provider_type: str) -> str:
    if provider_type not in IDENTIFIER_BY_TYPE:
        raise ValueError(f"unsupported provider type: {provider_type}")
    return IDENTIFIER_BY_TYPE[provider_type]


def name_is_provider_identity() -> bool:
    return False


def provider_type_may_silently_change() -> bool:
    return False


def missing_quality_is_zero() -> bool:
    return False


def cms_star_is_trust_hub_rating() -> bool:
    return False


def zip_is_county_service() -> bool:
    return False


def chow_means_sale() -> bool:
    return False


def unknown_owner_is_former_owner() -> bool:
    return False


def combined_senior_denominator_allowed() -> bool:
    return False


def public_person_profile_allowed() -> bool:
    return False


def public_organization_route_allowed() -> bool:
    return False


def fingerprint_includes_generated_at() -> bool:
    return False


def project_directory_status(
    *,
    provider_type: str,
    official_status: str | None,
    has_class_directory_row: bool,
) -> str:
    if provider_type == "hospice" and not has_class_directory_row:
        return "EVIDENCE_ONLY"
    if official_status in DIRECTORY_PROJECTION:
        return DIRECTORY_PROJECTION[official_status]
    if has_class_directory_row:
        return "CURRENT_DIRECTORY"
    return "KNOWN_NOT_CURRENT"


def absence_means_closed() -> bool:
    return False


def chow_history_available(provider_type: str) -> bool | None:
    if provider_type == "nursing_home":
        return True
    if provider_type in {"home_health", "hospice"}:
        return False
    return None


def chow_unavailability_reason(provider_type: str) -> str | None:
    if provider_type in {"home_health", "hospice"}:
        return "NO_PUBLIC_CMS_CHOW_SOURCE"
    return None


def quality_value_state(raw: object | None, *, availability: str | None = None) -> str:
    if availability in {"SUPPRESSED", "NOT_AVAILABLE", "INSUFFICIENT_DATA"}:
        return availability
    if raw is None or raw == "":
        return "NOT_REPORTED"
    return "AVAILABLE"


def profile_intelligence_status(
    *,
    provider_type: str,
    directory_projection: str,
    has_identity: bool,
    has_core_evidence: bool,
) -> str:
    if not has_identity:
        return "BLOCKED"
    if directory_projection == "EVIDENCE_ONLY":
        return "EVIDENCE_ONLY"
    if directory_projection == "KNOWN_NOT_CURRENT":
        return "PARTIAL"
    if directory_projection == "CURRENT_DIRECTORY" and has_core_evidence:
        return "READY"
    return "PARTIAL"


def limitations_for(provider_type: str) -> list[str]:
    common = [
        "Ownership evidence is not a quality measure.",
        "Missing evidence is not a zero score.",
        "CMS ratings are CMS ratings, not Trust Hub ratings.",
    ]
    if provider_type == "nursing_home":
        return [
            *common,
            "UNKNOWN ownership does not prove an owner left.",
            "CHOW records are CMS transaction records, not Trust Hub judgments or sales.",
        ]
    if provider_type == "home_health":
        return [
            *common,
            "CMS ZIP coverage records are not a verified county service area.",
            "CMS does not publish a Home Health ownership-change event file.",
        ]
    return [
        *common,
        "The Hospice General Information directory is the current-provider denominator.",
        "Quality-only typed CCNs are not current-directory providers.",
        "CMS ZIP coverage records are not a verified county service area.",
        "CMS does not publish a Hospice ownership-change event file.",
    ]


def fingerprint_payload(obj: dict[str, Any]) -> str:
    body = {
        "canonical_id": obj.get("canonical_id"),
        "provider_type": obj.get("provider_type"),
        "directory": obj.get("directory"),
        "quality_summary": obj.get("quality_summary"),
        "ownership_summary": obj.get("ownership_summary"),
        "chow": obj.get("chow"),
        "geography": obj.get("geography"),
        "freshness": obj.get("evidence_as_of_by_family"),
        "limitations": obj.get("limitations"),
        "availability": obj.get("availability"),
    }
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()
