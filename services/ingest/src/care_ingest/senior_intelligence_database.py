"""Materialize the National Senior Intelligence snapshot. Read-only vs source evidence."""

from __future__ import annotations

import hashlib
import json
from typing import Any

import psycopg
from psycopg.types.json import Jsonb

from .senior_intelligence import (
    LIMITATIONS,
    METRIC_VERSION,
    METRICS,
    SNAPSHOT_VERSION,
    TRANSFORMATION_VERSION,
)

CENSUS_SQL = """
WITH current_nh AS (
  SELECT latest.provider_id
  FROM (
    SELECT DISTINCT ON (pds.ccn) pds.provider_id, pds.directory_status
    FROM provider_directory_status pds
    JOIN provider p ON p.id = pds.provider_id
    WHERE p.provider_type='nursing_home'
    ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
  ) latest
  WHERE latest.directory_status='CURRENT_ACTIVE'
),
current_hh AS (
  SELECT DISTINCT provider_id FROM home_health_snapshot
),
current_hospice AS (
  SELECT DISTINCT provider_id FROM hospice_snapshot
),
resolved_owned AS (
  SELECT provider_type, provider_id
  FROM provider_organization_edge
  WHERE relationship_type='OWNED_BY' AND provider_id IS NOT NULL
  GROUP BY 1,2
)
SELECT jsonb_build_object(
  'core', jsonb_build_object(
  'nh_current', (SELECT count(*) FROM current_nh),
  'nh_known', (SELECT count(*) FROM provider WHERE provider_type='nursing_home'),
  'hh_current', (SELECT count(*) FROM current_hh),
  'hospice_current', (SELECT count(*) FROM current_hospice),
  'hospice_typed_identities', (SELECT count(*) FROM provider WHERE provider_type='hospice'),
  'orgs', (SELECT count(*) FROM organization),
  'edges', (SELECT count(*) FROM provider_organization_edge),
  'unresolved_edges', (
    SELECT count(*) FROM provider_organization_edge WHERE provider_id IS NULL
  ),
  'unknown_edges', (
    SELECT count(*) FROM provider_organization_edge WHERE temporal_status='UNKNOWN'
  ),
  'historical_edges', (
    SELECT count(*) FROM provider_organization_edge WHERE temporal_status='HISTORICAL'
  ),
  'chow_events', (SELECT count(*) FROM ownership_change_event),
  'chow_providers', (
    SELECT count(DISTINCT provider_id) FROM ownership_change_event WHERE provider_id IS NOT NULL
  ),
  'chow_unresolved', (
    SELECT count(*) FROM ownership_change_event WHERE provider_id IS NULL
  ),
  'nh_mds', (
    SELECT count(*) FROM current_nh c
    WHERE EXISTS (
      SELECT 1 FROM facility_quality_measure_observation q WHERE q.provider_id=c.provider_id
    )
  ),
  'nh_pbj', (
    SELECT count(*) FROM current_nh c
    WHERE EXISTS (
      SELECT 1 FROM pbj_staffing_day d WHERE d.provider_id=c.provider_id
    )
  ),
  'nh_fire', (
    SELECT count(*) FROM current_nh c
    WHERE EXISTS (
      SELECT 1 FROM fire_safety_citation f WHERE f.provider_id=c.provider_id
    )
  ),
  'nh_inspection', (
    SELECT count(*) FROM current_nh c
    WHERE EXISTS (
      SELECT 1 FROM inspection_event i WHERE i.provider_id=c.provider_id
    )
  ),
  'nh_sff', (
    SELECT count(DISTINCT d.provider_id) FROM cms_facility_designation d
    JOIN current_nh c ON c.provider_id=d.provider_id
    WHERE d.designation_kind='special_focus'
      AND d.is_current
      AND d.official_status IN ('SFF','SFF_CANDIDATE')
  ),
  'nh_owned', (
    SELECT count(*) FROM current_nh c
    JOIN resolved_owned o ON o.provider_id=c.provider_id AND o.provider_type='nursing_home'
  ),
  'nh_operated', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_nh c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='OPERATED_BY'
  ),
  'nh_managed', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_nh c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='MANAGED_BY'
  )
  ),
  'agency', jsonb_build_object(
  'hh_quality', (
    SELECT count(DISTINCT q.provider_id) FROM cms_agency_quality_observation q
    JOIN current_hh c ON c.provider_id=q.provider_id
    WHERE q.measure_family='hh_quality'
  ),
  'hh_hhcahps', (
    SELECT count(DISTINCT q.provider_id) FROM cms_agency_quality_observation q
    JOIN current_hh c ON c.provider_id=q.provider_id
    WHERE q.measure_family='hh_hhcahps'
  ),
  'hh_owned', (
    SELECT count(*) FROM current_hh c
    JOIN resolved_owned o ON o.provider_id=c.provider_id AND o.provider_type='home_health'
  ),
  'hh_operated', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_hh c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='OPERATED_BY'
  ),
  'hh_managed', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_hh c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='MANAGED_BY'
  ),
  'hh_enrolled', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_hh c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='ENROLLED_UNDER'
  ),
  'hh_zip', (
    SELECT count(DISTINCT z.provider_id) FROM cms_agency_service_zip z
    JOIN current_hh c ON c.provider_id=z.provider_id
  ),
  'hospice_qrp', (
    SELECT count(DISTINCT q.provider_id) FROM cms_agency_quality_observation q
    JOIN current_hospice c ON c.provider_id=q.provider_id
    WHERE q.measure_family='hospice_quality'
  ),
  'hospice_cahps', (
    SELECT count(DISTINCT q.provider_id) FROM cms_agency_quality_observation q
    JOIN current_hospice c ON c.provider_id=q.provider_id
    WHERE q.measure_family='hospice_cahps'
  ),
  'hospice_owned', (
    SELECT count(*) FROM current_hospice c
    JOIN resolved_owned o ON o.provider_id=c.provider_id AND o.provider_type='hospice'
  ),
  'hospice_operated', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_hospice c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='OPERATED_BY'
  ),
  'hospice_managed', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_hospice c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='MANAGED_BY'
  ),
  'hospice_enrolled', (
    SELECT count(DISTINCT e.provider_id) FROM provider_organization_edge e
    JOIN current_hospice c ON c.provider_id=e.provider_id
    WHERE e.relationship_type='ENROLLED_UNDER'
  ),
  'hospice_zip', (
    SELECT count(DISTINCT z.provider_id) FROM cms_agency_service_zip z
    JOIN current_hospice c ON c.provider_id=z.provider_id
  ),
  'owner_organizations', (
    SELECT count(DISTINCT organization_id) FROM provider_organization_edge
    WHERE relationship_class='OWNERSHIP' AND organization_id IS NOT NULL
  ),
  'person_equity_owners', (
    SELECT count(DISTINCT ownership_party_id) FROM provider_organization_edge
    WHERE party_kind='individual' AND relationship_class='OWNERSHIP'
  ),
  'owned_by_providers', (
    SELECT jsonb_build_object(
      'nursing_home', count(*) FILTER (WHERE provider_type='nursing_home'),
      'home_health', count(*) FILTER (WHERE provider_type='home_health'),
      'hospice', count(*) FILTER (WHERE provider_type='hospice')
    )
    FROM resolved_owned
  ),
  'operated_by_providers', (
    SELECT jsonb_build_object(
      'nursing_home', count(*) FILTER (WHERE provider_type='nursing_home'),
      'home_health', count(*) FILTER (WHERE provider_type='home_health'),
      'hospice', count(*) FILTER (WHERE provider_type='hospice')
    )
    FROM (
      SELECT DISTINCT provider_type, provider_id FROM provider_organization_edge
      WHERE relationship_type='OPERATED_BY' AND provider_id IS NOT NULL
    ) t
  ),
  'managed_by_providers', (
    SELECT jsonb_build_object(
      'nursing_home', count(*) FILTER (WHERE provider_type='nursing_home'),
      'home_health', count(*) FILTER (WHERE provider_type='home_health'),
      'hospice', count(*) FILTER (WHERE provider_type='hospice')
    )
    FROM (
      SELECT DISTINCT provider_type, provider_id FROM provider_organization_edge
      WHERE relationship_type='MANAGED_BY' AND provider_id IS NOT NULL
    ) t
  ),
  'chow_by_year', (
    SELECT coalesce(jsonb_object_agg(year::text, n), '{}'::jsonb)
    FROM (
      SELECT extract(year from effective_date)::int AS year, count(*) AS n
      FROM ownership_change_event GROUP BY 1
    ) t
  ),
  'chow_repeat', (
    SELECT jsonb_build_object(
      '1', count(*) FILTER (WHERE n=1),
      '2', count(*) FILTER (WHERE n=2),
      '3_5', count(*) FILTER (WHERE n BETWEEN 3 AND 5),
      '6_plus', count(*) FILTER (WHERE n>=6)
    )
    FROM (
      SELECT provider_id, count(*) AS n FROM ownership_change_event
      WHERE provider_id IS NOT NULL GROUP BY 1
    ) t
  ),
  'chow_last_12_months', (
    SELECT count(*) FROM ownership_change_event
    WHERE effective_date >= (current_date - 365)
  ),
  'freshness_bands', (
    SELECT coalesce(jsonb_object_agg(coalesce(freshness_band,'UNKNOWN'), n), '{}'::jsonb)
    FROM (
      SELECT freshness_band, count(*) AS n FROM cms_source_freshness GROUP BY 1
    ) t
  ),
  'nh_states', (SELECT count(DISTINCT state_code) FROM facility_snapshot s
    JOIN current_nh c ON c.provider_id=s.provider_id),
  'hh_states', (SELECT count(DISTINCT state_code) FROM home_health_snapshot),
  'hospice_states', (SELECT count(DISTINCT state_code) FROM hospice_snapshot),
  'nh_by_state', (
    SELECT coalesce(jsonb_object_agg(state_code, n), '{}'::jsonb)
    FROM (
      SELECT s.state_code, count(DISTINCT s.provider_id) AS n
      FROM facility_snapshot s JOIN current_nh c ON c.provider_id=s.provider_id
      GROUP BY 1
    ) t
  ),
  'hh_by_state', (
    SELECT coalesce(jsonb_object_agg(state_code, n), '{}'::jsonb)
    FROM (
      SELECT state_code, count(DISTINCT provider_id) AS n
      FROM home_health_snapshot GROUP BY 1
    ) t
  ),
  'hospice_by_state', (
    SELECT coalesce(jsonb_object_agg(state_code, n), '{}'::jsonb)
    FROM (
      SELECT state_code, count(DISTINCT provider_id) AS n
      FROM hospice_snapshot GROUP BY 1
    ) t
  ),
  'mds_rows', (SELECT count(*) FROM facility_quality_measure_observation),
  'fire_rows', (SELECT count(*) FROM fire_safety_citation),
  'pbj_rows', (SELECT count(*) FROM pbj_staffing_day)
  )
)
"""

CROSS_SQL = """
WITH typed AS (
  SELECT organization_id, provider_type, count(DISTINCT provider_id) AS providers
  FROM provider_organization_edge
  WHERE organization_id IS NOT NULL AND provider_id IS NOT NULL AND provider_type IS NOT NULL
  GROUP BY 1,2
),
pivoted AS (
  SELECT organization_id,
    coalesce(sum(providers) FILTER (WHERE provider_type='nursing_home'),0) AS nh,
    coalesce(sum(providers) FILTER (WHERE provider_type='home_health'),0) AS hh,
    coalesce(sum(providers) FILTER (WHERE provider_type='hospice'),0) AS hospice
  FROM typed GROUP BY 1
)
SELECT jsonb_build_object(
  'nh_only', count(*) FILTER (WHERE nh>0 AND hh=0 AND hospice=0),
  'hh_only', count(*) FILTER (WHERE nh=0 AND hh>0 AND hospice=0),
  'hospice_only', count(*) FILTER (WHERE nh=0 AND hh=0 AND hospice>0),
  'nh_hh', count(*) FILTER (WHERE nh>0 AND hh>0 AND hospice=0),
  'nh_hospice', count(*) FILTER (WHERE nh>0 AND hh=0 AND hospice>0),
  'hh_hospice', count(*) FILTER (WHERE nh=0 AND hh>0 AND hospice>0),
  'all_three', count(*) FILTER (WHERE nh>0 AND hh>0 AND hospice>0)
)
FROM pivoted
"""

NETWORK_SQL = """
WITH owned AS (
  SELECT organization_id, count(DISTINCT provider_id) AS n
  FROM provider_organization_edge
  WHERE organization_id IS NOT NULL AND provider_id IS NOT NULL
    AND relationship_type='OWNED_BY'
  GROUP BY 1
)
SELECT jsonb_build_object(
  '1', count(*) FILTER (WHERE n=1),
  '2_5', count(*) FILTER (WHERE n BETWEEN 2 AND 5),
  '6_10', count(*) FILTER (WHERE n BETWEEN 6 AND 10),
  '11_25', count(*) FILTER (WHERE n BETWEEN 11 AND 25),
  '26_50', count(*) FILTER (WHERE n BETWEEN 26 AND 50),
  '51_100', count(*) FILTER (WHERE n BETWEEN 51 AND 100),
  '101_plus', count(*) FILTER (WHERE n>=101)
)
FROM owned
"""

STATES_SQL = """
WITH nh_state AS (
  SELECT DISTINCT ON (provider_id) provider_id, state_code
  FROM facility_snapshot ORDER BY provider_id, id DESC
),
hh_state AS (
  SELECT DISTINCT ON (provider_id) provider_id, state_code
  FROM home_health_snapshot ORDER BY provider_id, id DESC
),
hs_state AS (
  SELECT DISTINCT ON (provider_id) provider_id, state_code
  FROM hospice_snapshot ORDER BY provider_id, id DESC
),
org_states AS (
  SELECT e.organization_id,
         count(DISTINCT coalesce(nh.state_code, hh.state_code, hs.state_code)) AS states
  FROM provider_organization_edge e
  LEFT JOIN nh_state nh ON nh.provider_id=e.provider_id
  LEFT JOIN hh_state hh ON hh.provider_id=e.provider_id
  LEFT JOIN hs_state hs ON hs.provider_id=e.provider_id
  WHERE e.organization_id IS NOT NULL AND e.provider_id IS NOT NULL
  GROUP BY 1
)
SELECT jsonb_build_object(
  '1', count(*) FILTER (WHERE states=1),
  '2_5', count(*) FILTER (WHERE states BETWEEN 2 AND 5),
  '6_10', count(*) FILTER (WHERE states BETWEEN 6 AND 10),
  '11_plus', count(*) FILTER (WHERE states>=11)
)
FROM org_states
"""


def _pct(part: int, whole: int) -> float | None:
    if whole <= 0:
        return None
    return round(100.0 * part / whole, 2)


def _fingerprint(rows: list[dict[str, Any]]) -> str:
    payload = [
        {
            "metric_key": row["metric_key"],
            "metric_version": row["metric_version"],
            "geography_code": row["geography_code"],
            "value_numeric": row["value_numeric"],
            "value_jsonb": row["value_jsonb"],
            "numerator": row["numerator"],
            "denominator": row["denominator"],
            "status": row["status"],
        }
        for row in sorted(rows, key=lambda item: (item["metric_key"], item["geography_code"]))
    ]
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def _value_rows(
    census: dict[str, Any], cross: dict[str, Any], network: dict[str, Any], multi: dict[str, Any]
) -> list[dict[str, Any]]:
    nh = int(census["nh_current"])
    hh = int(census["hh_current"])
    hospice = int(census["hospice_current"])
    typed = int(census["hospice_typed_identities"])
    rows: list[dict[str, Any]] = []

    def add(
        key: str,
        *,
        numeric: float | None = None,
        payload: Any = None,
        numerator: float | None = None,
        denominator: float | None = None,
        status: str = "COMPUTABLE",
        geo: str = "",
    ) -> None:
        rows.append(
            {
                "metric_key": key,
                "metric_version": METRIC_VERSION,
                "geography_code": geo,
                "value_numeric": numeric,
                "value_jsonb": payload,
                "numerator": numerator,
                "denominator": denominator,
                "status": status,
            }
        )

    add("nh_current", numeric=nh, denominator=nh)
    add("nh_known", numeric=int(census["nh_known"]))
    add("hh_current", numeric=hh, denominator=hh)
    add("hospice_current", numeric=hospice, denominator=hospice)
    add("hospice_typed_identities", numeric=typed)
    add(
        "hospice_quality_only_non_directory",
        numeric=typed - hospice,
        numerator=typed - hospice,
        denominator=typed,
    )
    add("combined_cms_senior_providers", status="UNSUPPORTED")
    add("assisted_living_cms_national_count", status="UNSUPPORTED")
    add("memory_care_cms_national_count", status="UNSUPPORTED")
    add("cms_provider_types_researched", numeric=3)
    add("nh_chow_events", numeric=int(census["chow_events"]))
    add("nh_chow_history_providers", numeric=int(census["chow_providers"]))
    add("hh_chow_history_providers", status="UNSUPPORTED")
    add("hospice_chow_history_providers", status="UNSUPPORTED")
    add("unresolved_provider_org_edges", numeric=int(census["unresolved_edges"]))
    add("canonical_organizations", numeric=int(census["orgs"]))
    add("nh_quality_combined_score", status="UNSUPPORTED")
    add("county_service_area_providers", status="UNSUPPORTED")
    add(
        "nh_mds_quality_coverage",
        numeric=_pct(int(census["nh_mds"]), nh),
        numerator=int(census["nh_mds"]),
        denominator=nh,
    )
    add(
        "hh_quality_coverage",
        numeric=_pct(int(census["hh_quality"]), hh),
        numerator=int(census["hh_quality"]),
        denominator=hh,
    )
    add(
        "hh_hhcahps_coverage",
        numeric=_pct(int(census["hh_hhcahps"]), hh),
        numerator=int(census["hh_hhcahps"]),
        denominator=hh,
    )
    add(
        "hospice_qrp_coverage",
        numeric=_pct(int(census["hospice_qrp"]), hospice),
        numerator=int(census["hospice_qrp"]),
        denominator=hospice,
    )
    add(
        "hospice_cahps_coverage",
        numeric=_pct(int(census["hospice_cahps"]), hospice),
        numerator=int(census["hospice_cahps"]),
        denominator=hospice,
    )
    add("owned_by_providers_by_class", payload=census["owned_by_providers"])
    add("cross_class_organizations", payload=cross)
    add("owner_network_size", payload=network)
    add("org_multi_state_office_footprint", payload=multi)
    add("source_freshness_bands", payload=census["freshness_bands"])
    add("nh_chow_events_by_year", payload=census["chow_by_year"])
    add("nh_chow_repeat_providers", payload=census["chow_repeat"])
    add("unknown_ownership_edges", numeric=int(census["unknown_edges"]))
    add(
        "nh_evidence_coverage",
        payload={
            "mds": int(census["nh_mds"]),
            "mds_missing": nh - int(census["nh_mds"]),
            "pbj": int(census["nh_pbj"]),
            "fire": int(census["nh_fire"]),
            "inspection": int(census["nh_inspection"]),
            "sff_or_candidate": int(census["nh_sff"]),
            "owned_by": int(census["nh_owned"]),
            "operated_by": int(census["nh_operated"]),
            "managed_by": int(census["nh_managed"]),
            "chow_history": int(census["chow_providers"]),
            "directory": nh,
        },
        denominator=nh,
    )
    add(
        "hh_evidence_coverage",
        payload={
            "quality": int(census["hh_quality"]),
            "hhcahps": int(census["hh_hhcahps"]),
            "owned_by": int(census["hh_owned"]),
            "operated_by": int(census["hh_operated"]),
            "managed_by": int(census["hh_managed"]),
            "enrolled_under": int(census["hh_enrolled"]),
            "zip_coverage": int(census["hh_zip"]),
            "states": int(census["hh_states"]),
            "chow_history": None,
            "directory": hh,
        },
        denominator=hh,
    )
    add(
        "hospice_evidence_coverage",
        payload={
            "qrp": int(census["hospice_qrp"]),
            "cahps": int(census["hospice_cahps"]),
            "owned_by": int(census["hospice_owned"]),
            "operated_by": int(census["hospice_operated"]),
            "managed_by": int(census["hospice_managed"]),
            "enrolled_under": int(census["hospice_enrolled"]),
            "zip_coverage": int(census["hospice_zip"]),
            "states": int(census["hospice_states"]),
            "chow_history": None,
            "directory": hospice,
            "quality_only_non_directory": typed - hospice,
        },
        denominator=hospice,
    )
    add(
        "provider_office_states",
        payload={
            "nursing_home_states": int(census["nh_states"]),
            "home_health_states": int(census["hh_states"]),
            "hospice_states": int(census["hospice_states"]),
            "nursing_home_by_state": census["nh_by_state"],
            "home_health_by_state": census["hh_by_state"],
            "hospice_by_state": census["hospice_by_state"],
        },
    )
    return rows


def materialize_senior_intelligence(database_url: str) -> dict[str, Any]:
    catalog = {item["metric_key"]: item for item in METRICS}
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute("SET statement_timeout = 0")
        before = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        defs_before = int(
            connection.execute(
                "SELECT count(*) FROM senior_intelligence_metric_definition"
            ).fetchone()[0]
        )
        print("intel: census", flush=True)
        nested = connection.execute(CENSUS_SQL).fetchone()[0]
        census = {**nested["core"], **nested["agency"]}
        print("intel: cross-class", flush=True)
        cross = connection.execute(CROSS_SQL).fetchone()[0]
        print("intel: network", flush=True)
        network = connection.execute(NETWORK_SQL).fetchone()[0]
        print("intel: multi-state", flush=True)
        multi = connection.execute(STATES_SQL).fetchone()[0]
        values = _value_rows(census, cross, network, multi)
        missing = {row["metric_key"] for row in values} - set(catalog)
        if missing:
            raise RuntimeError(f"values without definitions: {sorted(missing)}")
        fingerprint = _fingerprint(values)
        print("intel: upsert definitions", flush=True)
        def_writes = 0
        for item in METRICS:
            result = connection.execute(
                """
                INSERT INTO senior_intelligence_metric_definition (
                  metric_key, metric_version, display_name, provider_type, evidence_family,
                  entity_class, definition, numerator_definition, denominator_definition,
                  derivation, source_datasets, geography_grain, freshness_rule,
                  computability_status, publication_status, language_safe, language_unsafe,
                  limitations
                ) VALUES (
                  %(metric_key)s, %(metric_version)s, %(display_name)s, %(provider_type)s,
                  %(evidence_family)s, %(entity_class)s, %(definition)s, %(numerator_definition)s,
                  %(denominator_definition)s, %(derivation)s, %(source_datasets)s,
                  %(geography_grain)s, %(freshness_rule)s, %(computability_status)s,
                  %(publication_status)s, %(language_safe)s, %(language_unsafe)s, %(limitations)s
                )
                ON CONFLICT (metric_key, metric_version) DO NOTHING
                """,
                item,
            )
            def_writes += int(result.rowcount)
        lim_writes = 0
        for item in LIMITATIONS:
            result = connection.execute(
                """
                INSERT INTO senior_intelligence_limitation (
                  limitation_key, limitation_version, title, body, provider_type,
                  publication_status
                ) VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (limitation_key, limitation_version) DO NOTHING
                """,
                (
                    item["limitation_key"],
                    METRIC_VERSION,
                    item["title"],
                    item["body"],
                    item["provider_type"],
                    item["publication_status"],
                ),
            )
            lim_writes += int(result.rowcount)
        existing = connection.execute(
            """
            SELECT id FROM senior_intelligence_snapshot
            WHERE snapshot_version=%s AND fingerprint=%s
            """,
            (SNAPSHOT_VERSION, fingerprint),
        ).fetchone()
        value_writes = 0
        snapshot_writes = 0
        if existing:
            snapshot_id = existing[0]
        else:
            snapshot_id = connection.execute(
                """
                INSERT INTO senior_intelligence_snapshot (
                  snapshot_version, fingerprint, transformation_version, public_writes
                ) VALUES (%s, %s, %s, 0)
                RETURNING id
                """,
                (SNAPSHOT_VERSION, fingerprint, TRANSFORMATION_VERSION),
            ).fetchone()[0]
            snapshot_writes = 1
            for row in values:
                connection.execute(
                    """
                    INSERT INTO senior_intelligence_metric_value (
                      snapshot_id, metric_key, metric_version, geography_code,
                      value_numeric, value_jsonb, numerator, denominator, status
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        snapshot_id,
                        row["metric_key"],
                        row["metric_version"],
                        row["geography_code"],
                        row["value_numeric"],
                        Jsonb(row["value_jsonb"]) if row["value_jsonb"] is not None else None,
                        row["numerator"],
                        row["denominator"],
                        row["status"],
                    ),
                )
                value_writes += 1
        after = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        defs_after = int(
            connection.execute(
                "SELECT count(*) FROM senior_intelligence_metric_definition"
            ).fetchone()[0]
        )
        stored = int(
            connection.execute(
                "SELECT count(*) FROM senior_intelligence_metric_value WHERE snapshot_id=%s",
                (snapshot_id,),
            ).fetchone()[0]
        )
    return {
        "snapshot_version": SNAPSHOT_VERSION,
        "fingerprint": fingerprint,
        "snapshot_id": str(snapshot_id),
        "new_definitions": defs_after - defs_before,
        "definition_writes": def_writes,
        "limitation_writes": lim_writes,
        "snapshot_writes": snapshot_writes,
        "value_writes": value_writes,
        "stored_values": stored,
        "public_writes": 0,
        "census": census,
        "cross_class": cross,
        "network_size": network,
        "multi_state": multi,
        "database_bytes_before": int(before),
        "database_bytes_after": int(after),
        "regression": {
            "nh_known": int(census["nh_known"]),
            "nh_current": int(census["nh_current"]),
            "hh_current": int(census["hh_current"]),
            "hospice_current": int(census["hospice_current"]),
            "hospice_typed": int(census["hospice_typed_identities"]),
            "mds": int(census["mds_rows"]),
            "fire": int(census["fire_rows"]),
            "pbj": int(census["pbj_rows"]),
            "orgs": int(census["orgs"]),
            "edges": int(census["edges"]),
            "unknown_edges": int(census["unknown_edges"]),
            "chow_events": int(census["chow_events"]),
            "chow_providers": int(census["chow_providers"]),
        },
    }


def materialize_senior_intelligence_json(database_url: str) -> str:
    return json.dumps(materialize_senior_intelligence(database_url), indent=2, default=str) + "\n"
