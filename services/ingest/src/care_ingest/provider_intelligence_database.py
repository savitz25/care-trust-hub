"""Assemble one Provider Intelligence object with provider-scoped queries."""

from __future__ import annotations

import json
import time
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

import psycopg

from .provider_intelligence import (
    CONTRACT_VERSION,
    NATIONAL_INTEL_SNAPSHOT,
    PERSON_PUBLICATION_POLICY,
    TRANSFORMATION_VERSION,
    chow_history_available,
    chow_unavailability_reason,
    fingerprint_payload,
    identifier_type_for,
    limitations_for,
    profile_intelligence_status,
    project_directory_status,
)

OWNER_CAP = 25


def _connect(database_url: str) -> psycopg.Connection:
    connection = psycopg.connect(database_url, autocommit=True)
    connection.execute("SET statement_timeout = '15s'")
    return connection


def _resolve(
    connection: psycopg.Connection, provider_type: str, canonical_id: str
) -> dict[str, Any] | None:
    identifier_type = identifier_type_for(provider_type)
    row = connection.execute(
        """
        SELECT p.id, p.provider_type, i.identifier_type, i.identifier_value
        FROM provider p
        JOIN provider_identifier i ON i.provider_id = p.id
        WHERE p.provider_type = %s
          AND i.identifier_type = %s
          AND i.identifier_value = %s
        """,
        (provider_type, identifier_type, canonical_id.strip().upper()),
    ).fetchone()
    if not row:
        return None
    if row[1] != provider_type:
        raise ValueError("provider type mismatch")
    return {
        "provider_id": row[0],
        "provider_type": row[1],
        "identifier_type": row[2],
        "canonical_id": row[3],
    }


def _directory(connection: psycopg.Connection, provider_id: UUID, provider_type: str) -> dict:
    row = connection.execute(
        """
        SELECT directory_status, observed_at
        FROM provider_directory_status
        WHERE provider_id = %s
        ORDER BY observed_at DESC, ingested_at DESC
        LIMIT 1
        """,
        (provider_id,),
    ).fetchone()
    has_hh = connection.execute(
        "SELECT exists(SELECT 1 FROM home_health_snapshot WHERE provider_id=%s)",
        (provider_id,),
    ).fetchone()[0]
    has_hospice = connection.execute(
        "SELECT exists(SELECT 1 FROM hospice_snapshot WHERE provider_id=%s)",
        (provider_id,),
    ).fetchone()[0]
    official = row[0] if row else None
    has_class_row = (
        (provider_type == "nursing_home" and official == "CURRENT_ACTIVE")
        or (provider_type == "home_health" and has_hh)
        or (provider_type == "hospice" and has_hospice)
    )
    projection = project_directory_status(
        provider_type=provider_type,
        official_status=official,
        has_class_directory_row=bool(has_class_row),
    )
    return {
        "official_status": official,
        "projection": projection,
        "observed_at": row[1].isoformat() if row and row[1] else None,
        "has_home_health_snapshot": bool(has_hh),
        "has_hospice_gi_snapshot": bool(has_hospice),
    }


def _nh_identity(connection: psycopg.Connection, provider_id: UUID) -> dict[str, Any]:
    row = connection.execute(
        """
        SELECT provider_name, legal_business_name, address, city, state_code, zip_code,
               telephone, overall_rating, health_inspection_rating, staffing_rating,
               quality_measure_rating, source_release_id
        FROM facility_snapshot
        WHERE provider_id = %s
        ORDER BY observed_at DESC NULLS LAST, id DESC
        LIMIT 1
        """,
        (provider_id,),
    ).fetchone()
    if not row:
        return {}
    return {
        "name": row[0],
        "legal_name": row[1],
        "address": row[2],
        "city": row[3],
        "state": row[4],
        "zip": row[5],
        "phone": row[6],
        "cms_stars": {
            "overall": row[7],
            "health_inspection": row[8],
            "staffing": row[9],
            "quality_measure": row[10],
            "label": "CMS rating",
            "not_trust_hub_rating": True,
            "availability": "AVAILABLE" if row[7] is not None else "NOT_REPORTED",
        },
        "source_release_id": str(row[11]) if row[11] else None,
        "has_core_evidence": True,
    }


def _hh_identity(connection: psycopg.Connection, provider_id: UUID) -> dict[str, Any]:
    row = connection.execute(
        """
        SELECT provider_name, address, city, state_code, zip_code, telephone,
               quality_of_patient_care_star, quality_of_patient_care_star_footnote,
               ownership_type
        FROM home_health_snapshot
        WHERE provider_id = %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (provider_id,),
    ).fetchone()
    if not row:
        return {}
    return {
        "name": row[0],
        "address": row[1],
        "city": row[2],
        "state": row[3],
        "zip": row[4],
        "phone": row[5],
        "cms_quality_of_patient_care_star": {
            "value": row[6],
            "footnote": row[7],
            "label": "CMS Quality of Patient Care star",
            "not_trust_hub_rating": True,
            "availability": "AVAILABLE" if row[6] is not None else "NOT_REPORTED",
        },
        "ownership_type": row[8],
        "has_core_evidence": True,
    }


def _hospice_identity(connection: psycopg.Connection, provider_id: UUID) -> dict[str, Any]:
    row = connection.execute(
        """
        SELECT provider_name, address_line_1, city, state_code, zip_code, telephone,
               ownership_type, county_name
        FROM hospice_snapshot
        WHERE provider_id = %s
        ORDER BY id DESC
        LIMIT 1
        """,
        (provider_id,),
    ).fetchone()
    if not row:
        return {}
    return {
        "name": row[0],
        "address": row[1],
        "city": row[2],
        "state": row[3],
        "zip": row[4],
        "phone": row[5],
        "ownership_type": row[6],
        "office_county_name": row[7],
        "office_county_is_not_service_area": True,
        "has_core_evidence": True,
    }


def _quality_families(connection: psycopg.Connection, provider_id: UUID) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT measure_family, availability, count(*)
        FROM cms_agency_quality_observation
        WHERE provider_id = %s
        GROUP BY 1, 2
        ORDER BY 1, 2
        """,
        (provider_id,),
    ).fetchall()
    families: dict[str, dict[str, Any]] = {}
    for family, availability, n in rows:
        item = families.setdefault(
            family,
            {"family": family, "observation_count": 0, "by_availability": {}, "measures": []},
        )
        item["observation_count"] += int(n)
        item["by_availability"][availability] = int(n)
    return list(families.values())


def _services(connection: psycopg.Connection, provider_id: UUID) -> list[dict[str, Any]]:
    rows = connection.execute(
        """
        SELECT service_code, official_field, offered
        FROM cms_agency_service_offering
        WHERE provider_id = %s
        ORDER BY service_code
        """,
        (provider_id,),
    ).fetchall()
    return [{"code": r[0], "official_field": r[1], "offered": r[2]} for r in rows]


def _zip_coverage(connection: psycopg.Connection, provider_id: UUID) -> dict[str, Any]:
    count = connection.execute(
        "SELECT count(*) FROM cms_agency_service_zip WHERE provider_id=%s",
        (provider_id,),
    ).fetchone()[0]
    return {
        "zip_observation_count": int(count),
        "is_verified_county_service_area": False,
        "is_verified_service_area": False,
    }


def _nh_evidence_flags(connection: psycopg.Connection, provider_id: UUID) -> dict[str, bool]:
    return {
        "mds": connection.execute(
            """
            SELECT exists(
              SELECT 1 FROM facility_quality_measure_observation WHERE provider_id=%s
            )
            """,
            (provider_id,),
        ).fetchone()[0],
        "pbj": connection.execute(
            "SELECT exists(SELECT 1 FROM pbj_staffing_day WHERE provider_id=%s)",
            (provider_id,),
        ).fetchone()[0],
        "fire": connection.execute(
            "SELECT exists(SELECT 1 FROM fire_safety_citation WHERE provider_id=%s)",
            (provider_id,),
        ).fetchone()[0],
        "inspection": connection.execute(
            "SELECT exists(SELECT 1 FROM inspection_event WHERE provider_id=%s)",
            (provider_id,),
        ).fetchone()[0],
        "sff": connection.execute(
            """
            SELECT exists(
              SELECT 1 FROM cms_facility_designation
              WHERE provider_id=%s AND designation_kind='special_focus' AND is_current
                AND official_status IN ('SFF','SFF_CANDIDATE')
            )
            """,
            (provider_id,),
        ).fetchone()[0],
    }


def _ownership(connection: psycopg.Connection, provider_id: UUID) -> dict[str, Any]:
    rows = connection.execute(
        """
        SELECT e.relationship_type, e.temporal_status, e.party_kind, e.raw_role_text,
               e.ownership_percentage, e.effective_from, op.display_name, op.id,
               e.organization_id, e.confidence
        FROM provider_organization_edge e
        JOIN ownership_party op ON op.id = e.ownership_party_id
        WHERE e.provider_id = %s
          AND e.relationship_type IN ('OWNED_BY','OPERATED_BY','MANAGED_BY','ENROLLED_UNDER')
        ORDER BY e.relationship_type, e.temporal_status, op.display_name
        """,
        (provider_id,),
    ).fetchall()
    buckets = {
        "current_owners": [],
        "operators": [],
        "managers": [],
        "enrollment_organizations": [],
        "historical_ownership_observations": [],
        "unknown_ownership_observations": [],
    }
    counts = {key: 0 for key in buckets}
    for row in rows:
        rel, temporal, kind, role, pct, effective, name, party_id, org_id, confidence = row
        item = {
            "display_name": name,
            "party_kind": kind,
            "party_id": str(party_id),
            "organization_id": str(org_id) if org_id else None,
            "relationship_type": rel,
            "raw_cms_role": role,
            "ownership_percentage": float(pct) if pct is not None else None,
            "temporal_status": temporal,
            "effective_from": effective.isoformat() if effective else None,
            "confidence": confidence,
            "person_publication_policy": PERSON_PUBLICATION_POLICY
            if kind == "individual"
            else None,
            "public_profile": False,
        }
        if rel == "OWNED_BY" and temporal == "CURRENT":
            key = "current_owners"
        elif rel == "OWNED_BY" and temporal == "HISTORICAL":
            key = "historical_ownership_observations"
        elif rel == "OWNED_BY" and temporal == "UNKNOWN":
            key = "unknown_ownership_observations"
        elif rel == "OPERATED_BY":
            key = "operators"
        elif rel == "MANAGED_BY":
            key = "managers"
        else:
            key = "enrollment_organizations"
        counts[key] += 1
        if len(buckets[key]) < OWNER_CAP:
            buckets[key].append(item)
    return {**buckets, "counts": counts, "unresolved_edges_included": False}


def _chow(connection: psycopg.Connection, provider_id: UUID, provider_type: str) -> dict[str, Any]:
    available = chow_history_available(provider_type)
    if not available:
        return {
            "ownership_change_history_available": False,
            "reason": chow_unavailability_reason(provider_type),
            "confirmed_event_count": None,
            "events": None,
            "zero_does_not_mean_no_change_occurred": True,
        }
    rows = connection.execute(
        """
        SELECT e.id, e.effective_date, e.change_type_code, e.change_type_text,
               e.normalized_event_type, e.raw_record->>'ORGANIZATION NAME - BUYER',
               e.raw_record->>'ORGANIZATION NAME - SELLER', e.source_dataset_key,
               e.source_dataset_id, e.confidence
        FROM ownership_change_event e
        WHERE e.provider_id = %s
        ORDER BY e.effective_date, e.id
        """,
        (provider_id,),
    ).fetchall()
    events = [
        {
            "event_id": str(row[0]),
            "effective_date": row[1].isoformat() if row[1] else None,
            "cms_raw_type_code": row[2],
            "cms_raw_type_text": row[3],
            "normalized_type": row[4],
            "buyer_legal_entity": row[5],
            "seller_legal_entity": row[6],
            "source_dataset_key": row[7],
            "source_dataset_id": row[8],
            "confidence": row[9],
            "safe_language": (
                f"CMS records show an ownership change effective {row[1].isoformat()}."
                if row[1]
                else None
            ),
            "not_labeled_sale": True,
        }
        for row in rows
    ]
    return {
        "ownership_change_history_available": True,
        "confirmed_event_count": len(events),
        "events": events,
        "qualification": "attached_confirmed_event_only",
    }


def _freshness(connection: psycopg.Connection, dataset_keys: list[str]) -> dict[str, Any]:
    if not dataset_keys:
        return {}
    rows = connection.execute(
        """
        SELECT dataset_key, freshness_band, source_modified_at::text, age_days
        FROM cms_source_freshness
        WHERE dataset_key = ANY(%s)
        ORDER BY dataset_key
        """,
        (dataset_keys,),
    ).fetchall()
    return {
        row[0]: {
            "band": row[1],
            "source_modified_at": row[2],
            "age_days": float(row[3]) if row[3] is not None else None,
        }
        for row in rows
    }


def get_senior_provider_intelligence(
    database_url: str, provider_type: str, canonical_id: str
) -> dict[str, Any] | None:
    started = time.perf_counter()
    with _connect(database_url) as connection:
        identity = _resolve(connection, provider_type, canonical_id)
        if not identity:
            return None
        provider_id = identity["provider_id"]
        directory = _directory(connection, provider_id, provider_type)
        class_fields: dict[str, Any]
        families: list[dict[str, Any]] = []
        services: list[dict[str, Any]] = []
        zips: dict[str, Any] = {
            "zip_observation_count": 0,
            "is_verified_county_service_area": False,
        }
        nh_flags: dict[str, bool] = {}
        freshness_keys: list[str]
        if provider_type == "nursing_home":
            class_fields = _nh_identity(connection, provider_id)
            nh_flags = _nh_evidence_flags(connection, provider_id)
            freshness_keys = [
                "nursing-home-provider-information",
                "skilled-nursing-facility-all-owners",
                "skilled-nursing-facility-change-of-ownership",
                "nursing-home-mds-quality-measures",
            ]
        elif provider_type == "home_health":
            class_fields = _hh_identity(connection, provider_id)
            families = _quality_families(connection, provider_id)
            services = _services(connection, provider_id)
            zips = _zip_coverage(connection, provider_id)
            freshness_keys = [
                "home-health-care-agencies",
                "home-health-patient-survey-hhcahps",
                "home-health-agency-all-owners",
                "home-health-zip-codes",
            ]
        else:
            class_fields = _hospice_identity(connection, provider_id)
            families = _quality_families(connection, provider_id)
            zips = _zip_coverage(connection, provider_id)
            freshness_keys = [
                "hospice-general-information",
                "hospice-provider-data",
                "hospice-provider-cahps",
                "hospice-all-owners",
                "hospice-zip-data",
            ]
        ownership = _ownership(connection, provider_id)
        chow = _chow(connection, provider_id, provider_type)
        freshness = _freshness(connection, freshness_keys)
    has_core = bool(class_fields.get("has_core_evidence")) or directory["projection"] in {
        "CURRENT_DIRECTORY",
        "EVIDENCE_ONLY",
    }
    status = profile_intelligence_status(
        provider_type=provider_type,
        directory_projection=directory["projection"],
        has_identity=True,
        has_core_evidence=has_core or bool(class_fields),
    )
    availability = {
        "QUALITY": "AVAILABLE"
        if class_fields.get("cms_stars")
        or class_fields.get("cms_quality_of_patient_care_star")
        or families
        else "NOT_REPORTED",
        "OWNERSHIP": "AVAILABLE" if ownership["counts"]["current_owners"] else "NOT_REPORTED",
        "CHOW": "AVAILABLE" if chow.get("ownership_change_history_available") else "UNSUPPORTED",
        "STAFFING": "AVAILABLE"
        if nh_flags.get("pbj")
        else "NOT_APPLICABLE"
        if provider_type != "nursing_home"
        else "NOT_REPORTED",
        "FIRE": "AVAILABLE"
        if nh_flags.get("fire")
        else "NOT_APPLICABLE"
        if provider_type != "nursing_home"
        else "NOT_REPORTED",
        "INSPECTIONS": "AVAILABLE"
        if nh_flags.get("inspection")
        else "NOT_APPLICABLE"
        if provider_type != "nursing_home"
        else "NOT_REPORTED",
        "ZIP_COVERAGE": "AVAILABLE"
        if zips.get("zip_observation_count")
        else "NOT_APPLICABLE"
        if provider_type == "nursing_home"
        else "NOT_REPORTED",
        "SERVICES": "AVAILABLE"
        if services
        else "NOT_APPLICABLE"
        if provider_type != "home_health"
        else "NOT_REPORTED",
    }
    generated = datetime.now(UTC).isoformat()
    obj = {
        "contract_version": CONTRACT_VERSION,
        "national_metric_snapshot": NATIONAL_INTEL_SNAPSHOT,
        "transformation_version": TRANSFORMATION_VERSION,
        "generated_at": generated,
        "profile_generated_at": generated,
        "provider_id": str(provider_id),
        "provider_type": provider_type,
        "identifier_type": identity["identifier_type"],
        "canonical_id": identity["canonical_id"],
        "directory": directory,
        "profile_intelligence_status": status,
        "common": {
            "display_name": class_fields.get("name"),
            "legal_name": class_fields.get("legal_name"),
            "office": {
                "address": class_fields.get("address"),
                "city": class_fields.get("city"),
                "state": class_fields.get("state"),
                "zip": class_fields.get("zip"),
                "phone": class_fields.get("phone"),
            },
        },
        "nursing_home": class_fields if provider_type == "nursing_home" else None,
        "home_health": class_fields if provider_type == "home_health" else None,
        "hospice": class_fields if provider_type == "hospice" else None,
        "quality_summary": {
            "cms_stars": class_fields.get("cms_stars")
            or class_fields.get("cms_quality_of_patient_care_star"),
            "families": families,
            "nh_evidence_flags": nh_flags or None,
            "synthetic_trust_hub_rating": False,
        },
        "services": services,
        "ownership_summary": ownership,
        "chow": chow,
        "geography": {
            "office": {
                "address": class_fields.get("address"),
                "city": class_fields.get("city"),
                "state": class_fields.get("state"),
                "zip": class_fields.get("zip"),
            },
            "coverage": zips,
            "county_service_area": "UNSUPPORTED",
        },
        "evidence_as_of_by_family": freshness,
        "availability": availability,
        "limitations": limitations_for(provider_type),
        "person_publication_policy": PERSON_PUBLICATION_POLICY,
        "organization_public_route": False,
        "query_ms": None,
    }
    obj["fingerprint"] = fingerprint_payload(obj)
    obj["query_ms"] = round((time.perf_counter() - started) * 1000, 2)
    return obj


def provider_intelligence_census(database_url: str) -> dict[str, Any]:
    with _connect(database_url) as connection:
        connection.execute("SET statement_timeout = '120s'")
        nh = connection.execute(
            """
            SELECT jsonb_build_object(
              'current', (
                SELECT count(*) FROM (
                  SELECT DISTINCT ON (pds.ccn) pds.directory_status
                  FROM provider_directory_status pds
                  JOIN provider p ON p.id=pds.provider_id
                  WHERE p.provider_type='nursing_home'
                  ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
                ) t WHERE directory_status='CURRENT_ACTIVE'
              ),
              'known', (SELECT count(*) FROM provider WHERE provider_type='nursing_home'),
              'known_not_current', (
                SELECT count(*) FROM (
                  SELECT DISTINCT ON (pds.ccn) pds.directory_status
                  FROM provider_directory_status pds
                  JOIN provider p ON p.id=pds.provider_id
                  WHERE p.provider_type='nursing_home'
                  ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
                ) t WHERE directory_status='ABSENT_FROM_CURRENT_DIRECTORY'
              )
            )
            """
        ).fetchone()[0]
        hh = connection.execute("SELECT count(*) FROM home_health_snapshot").fetchone()[0]
        hospice_gi = connection.execute("SELECT count(*) FROM hospice_snapshot").fetchone()[0]
        hospice_typed = connection.execute(
            "SELECT count(*) FROM provider WHERE provider_type='hospice'"
        ).fetchone()[0]
        orgs = connection.execute("SELECT count(*) FROM organization").fetchone()[0]
        edges = connection.execute("SELECT count(*) FROM provider_organization_edge").fetchone()[0]
        chow = connection.execute("SELECT count(*) FROM ownership_change_event").fetchone()[0]
        unknown = connection.execute(
            "SELECT count(*) FROM provider_organization_edge WHERE temporal_status='UNKNOWN'"
        ).fetchone()[0]
        bytes_ = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
    return {
        "nh_ready": int(nh["current"]),
        "nh_partial": int(nh["known_not_current"]),
        "nh_known": int(nh["known"]),
        "hh_ready": int(hh),
        "hospice_ready": int(hospice_gi),
        "hospice_evidence_only": int(hospice_typed) - int(hospice_gi),
        "regression": {
            "nh_current": int(nh["current"]),
            "nh_known": int(nh["known"]),
            "hh_current": int(hh),
            "hospice_gi": int(hospice_gi),
            "hospice_typed": int(hospice_typed),
            "orgs": int(orgs),
            "edges": int(edges),
            "chow_events": int(chow),
            "unknown_edges": int(unknown),
            "database_bytes": int(bytes_),
        },
    }


def provider_intelligence_json(database_url: str, provider_type: str, canonical_id: str) -> str:
    obj = get_senior_provider_intelligence(database_url, provider_type, canonical_id)
    return json.dumps(obj, indent=2, default=str) + "\n"
