"""Set-based CHOW event intelligence. Does not fabricate events from UNKNOWN rows."""

from __future__ import annotations

import hashlib
import json
from typing import Any

import psycopg

from .ownership_change import (
    SNF_CHOW_CMS_ID,
    SNF_CHOW_DATASET,
    SNF_CHOW_OWNERS_DATASET,
    SOURCE_AGENCY,
    TRANSFORMATION_VERSION,
    home_health_event_availability,
    hospice_event_availability,
)

CLASSIFY_EVENTS_SQL = """
UPDATE ownership_change_event e SET
  event_natural_key = %s || '|' || upper(e.provider_identifier) || '|' ||
    coalesce(e.raw_record->>'ASSOCIATE ID - BUYER','') || '|' ||
    coalesce(e.raw_record->>'ASSOCIATE ID - SELLER','') || '|' ||
    e.effective_date::text || '|' || e.change_type_code,
  normalized_event_type = CASE e.change_type_code
    WHEN 'CH' THEN 'CHANGE_OF_OWNERSHIP'
    WHEN 'AM' THEN 'ACQUISITION_MERGER'
    WHEN 'CO' THEN 'CONSOLIDATION'
    ELSE 'OTHER'
  END,
  event_status = 'CONFIRMED_EFFECTIVE',
  confidence = CASE WHEN e.provider_id IS NULL THEN 'UNRESOLVED' ELSE 'CONFIRMED' END,
  source_dataset_key = %s,
  source_agency = %s,
  source_dataset_id = %s,
  buyer_pac_id = nullif(e.raw_record->>'ASSOCIATE ID - BUYER', ''),
  seller_pac_id = nullif(e.raw_record->>'ASSOCIATE ID - SELLER', ''),
  buyer_enrollment_id = nullif(e.raw_record->>'ENROLLMENT ID - BUYER', ''),
  seller_enrollment_id = nullif(e.raw_record->>'ENROLLMENT ID - SELLER', ''),
  source_observed_at = sr.source_modified_at,
  first_seen_source_release_id = coalesce(e.first_seen_source_release_id, e.source_release_id),
  last_seen_source_release_id = e.source_release_id,
  first_seen_at = coalesce(e.first_seen_at, sr.source_modified_at, e.effective_date::timestamptz),
  last_seen_at = coalesce(sr.source_modified_at, now()),
  transformation_version_event = %s
FROM source_release sr
WHERE sr.id = e.source_release_id
  AND (
    e.event_natural_key IS DISTINCT FROM (
      %s || '|' || upper(e.provider_identifier) || '|' ||
      coalesce(e.raw_record->>'ASSOCIATE ID - BUYER','') || '|' ||
      coalesce(e.raw_record->>'ASSOCIATE ID - SELLER','') || '|' ||
      e.effective_date::text || '|' || e.change_type_code
    )
    OR e.normalized_event_type IS DISTINCT FROM CASE e.change_type_code
      WHEN 'CH' THEN 'CHANGE_OF_OWNERSHIP'
      WHEN 'AM' THEN 'ACQUISITION_MERGER'
      WHEN 'CO' THEN 'CONSOLIDATION'
      ELSE 'OTHER'
    END
    OR e.event_status IS DISTINCT FROM 'CONFIRMED_EFFECTIVE'
    OR e.confidence IS DISTINCT FROM CASE
          WHEN e.provider_id IS NULL THEN 'UNRESOLVED' ELSE 'CONFIRMED'
        END
    OR e.transformation_version_event IS DISTINCT FROM %s
  )
"""

UPSERT_LEGAL_PARTIES_SQL = """
INSERT INTO ownership_change_event_party (
  event_id, party_id, organization_id, party_kind, participant_role,
  source_party_key, raw_name, ownership_percentage, raw_role_text,
  confidence, source_record_locator, source_release_id, transformation_version
)
SELECT
  e.id,
  NULL,
  CASE side.role WHEN 'BUYER' THEN e.buyer_organization_id ELSE e.seller_organization_id END,
  'organization',
  side.role,
  'CMS_PECOS:PAC:' || CASE side.role
    WHEN 'BUYER' THEN e.buyer_pac_id ELSE e.seller_pac_id
  END,
  CASE side.role
    WHEN 'BUYER' THEN e.raw_record->>'ORGANIZATION NAME - BUYER'
    ELSE e.raw_record->>'ORGANIZATION NAME - SELLER'
  END,
  NULL,
  NULL,
  CASE
    WHEN side.role = 'BUYER' AND e.buyer_organization_id IS NOT NULL THEN 'CONFIRMED'
    WHEN side.role = 'SELLER' AND e.seller_organization_id IS NOT NULL THEN 'CONFIRMED'
    ELSE 'UNRESOLVED'
  END,
  e.source_record_locator,
  e.source_release_id,
  %s
FROM ownership_change_event e
CROSS JOIN (VALUES ('BUYER'), ('SELLER')) AS side(role)
WHERE CASE side.role
        WHEN 'BUYER' THEN e.buyer_pac_id
        ELSE e.seller_pac_id
      END IS NOT NULL
ON CONFLICT (event_id, participant_role, source_party_key) DO NOTHING
"""

CREATE_EVENT_TEMP_SQL = """
CREATE TEMP TABLE tmp_chow_event AS
SELECT
  id,
  provider_id,
  source_release_id,
  source_record_locator,
  buyer_enrollment_id,
  seller_enrollment_id
FROM ownership_change_event
WHERE buyer_enrollment_id IS NOT NULL OR seller_enrollment_id IS NOT NULL
"""

CREATE_OWNER_INFO_TEMP_SQL = """
CREATE TEMP TABLE tmp_chow_owner_info AS
SELECT
  r.id AS relationship_id,
  r.ownership_party_id,
  r.provider_id,
  r.ownership_percentage,
  r.relationship_role_text,
  r.source_record_locator,
  r.source_release_id,
  r.raw_record->>'ENROLLMENT ID' AS enrollment_id
FROM provider_ownership_relationship r
JOIN source_release sr ON sr.id = r.source_release_id
JOIN source_dataset d ON d.id = sr.source_dataset_id
WHERE d.dataset_key = %s
"""

UPSERT_OWNER_INFO_PARTIES_SQL = """
INSERT INTO ownership_change_event_party (
  event_id, party_id, organization_id, party_kind, participant_role,
  source_party_key, raw_name, ownership_percentage, raw_role_text,
  confidence, source_record_locator, source_release_id, transformation_version
)
SELECT DISTINCT ON (
  e.id, role.participant_role, coalesce(op.source_identity_key, oi.relationship_id::text)
)
  e.id,
  oi.ownership_party_id,
  op.organization_id,
  op.party_kind,
  role.participant_role,
  coalesce(op.source_identity_key, oi.relationship_id::text),
  op.display_name,
  oi.ownership_percentage,
  oi.relationship_role_text,
  CASE WHEN oi.ownership_party_id IS NULL THEN 'UNRESOLVED' ELSE 'CONFIRMED' END,
  oi.source_record_locator,
  oi.source_release_id,
  %s
FROM tmp_chow_event e
JOIN tmp_chow_owner_info oi
  ON oi.enrollment_id IN (e.buyer_enrollment_id, e.seller_enrollment_id)
JOIN ownership_party op ON op.id = oi.ownership_party_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN oi.enrollment_id = e.seller_enrollment_id
     AND (
       position('OWNER' in upper(oi.relationship_role_text)) > 0
       OR position('PARTNER' in upper(oi.relationship_role_text)) > 0
     )
      THEN 'PRIOR_OWNER'
    WHEN oi.enrollment_id = e.buyer_enrollment_id
     AND (
       position('OWNER' in upper(oi.relationship_role_text)) > 0
       OR position('PARTNER' in upper(oi.relationship_role_text)) > 0
     )
      THEN 'NEW_OWNER'
    ELSE 'EVENT_PARTICIPANT'
  END AS participant_role
) role
ORDER BY e.id, role.participant_role, coalesce(op.source_identity_key, oi.relationship_id::text)
ON CONFLICT (event_id, participant_role, source_party_key) DO NOTHING
"""

UPSERT_LINKS_SQL = """
INSERT INTO ownership_change_relationship_link (
  event_id, provider_organization_edge_id, link_role, confidence, transformation_version
)
SELECT DISTINCT
  e.id,
  edge.id,
  CASE
    WHEN oi.enrollment_id = e.seller_enrollment_id
     AND edge.relationship_type = 'OWNED_BY'
      THEN 'PRE_EVENT_OWNER'
    WHEN oi.enrollment_id = e.buyer_enrollment_id
     AND edge.relationship_type = 'OWNED_BY'
      THEN 'POST_EVENT_OWNER'
    ELSE 'EVENT_PARTICIPANT'
  END,
  'CONFIRMED',
  %s
FROM tmp_chow_event e
JOIN tmp_chow_owner_info oi
  ON oi.enrollment_id IN (e.buyer_enrollment_id, e.seller_enrollment_id)
JOIN provider_organization_edge edge
  ON edge.provider_ownership_relationship_id = oi.relationship_id
WHERE e.provider_id IS NOT NULL
  AND edge.provider_id IS NOT NULL
  AND e.provider_id = edge.provider_id
ON CONFLICT (event_id, provider_organization_edge_id) DO NOTHING
"""

CENSUS_SQL = """
SELECT jsonb_build_object(
  'events', (SELECT count(*) FROM ownership_change_event),
  'events_classified', (
    SELECT count(*) FROM ownership_change_event WHERE event_natural_key IS NOT NULL
  ),
  'events_confirmed', (
    SELECT count(*) FROM ownership_change_event WHERE confidence='CONFIRMED'
  ),
  'events_unresolved_provider', (
    SELECT count(*) FROM ownership_change_event WHERE provider_id IS NULL
  ),
  'providers_with_events', (
    SELECT count(DISTINCT provider_id) FROM ownership_change_event WHERE provider_id IS NOT NULL
  ),
  'earliest', (SELECT min(effective_date) FROM ownership_change_event),
  'latest', (SELECT max(effective_date) FROM ownership_change_event),
  'by_type', (
    SELECT coalesce(jsonb_object_agg(normalized_event_type, n), '{}'::jsonb)
    FROM (
      SELECT normalized_event_type, count(*) AS n
      FROM ownership_change_event GROUP BY 1
    ) t
  ),
  'by_raw_type', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'code', change_type_code, 'text', change_type_text, 'n', n
    ) ORDER BY n DESC), '[]'::jsonb)
    FROM (
      SELECT change_type_code, change_type_text, count(*) AS n
      FROM ownership_change_event GROUP BY 1,2
    ) t
  ),
  'by_year', (
    SELECT coalesce(jsonb_object_agg(year::text, n), '{}'::jsonb)
    FROM (
      SELECT extract(year from effective_date)::int AS year, count(*) AS n
      FROM ownership_change_event GROUP BY 1
    ) t
  ),
  'repeat', (
    SELECT jsonb_build_object(
      '1', count(*) FILTER (WHERE n=1),
      '2', count(*) FILTER (WHERE n=2),
      '3_5', count(*) FILTER (WHERE n BETWEEN 3 AND 5),
      '6_plus', count(*) FILTER (WHERE n>=6)
    )
    FROM (
      SELECT provider_id, count(*) AS n
      FROM ownership_change_event
      WHERE provider_id IS NOT NULL
      GROUP BY 1
    ) t
  ),
  'parties', (SELECT count(*) FROM ownership_change_event_party),
  'parties_org', (
    SELECT count(*) FROM ownership_change_event_party WHERE party_kind='organization'
  ),
  'parties_person', (
    SELECT count(*) FROM ownership_change_event_party WHERE party_kind='individual'
  ),
  'parties_unresolved', (
    SELECT count(*) FROM ownership_change_event_party WHERE confidence='UNRESOLVED'
  ),
  'party_roles', (
    SELECT coalesce(jsonb_object_agg(participant_role, n), '{}'::jsonb)
    FROM (
      SELECT participant_role, count(*) AS n
      FROM ownership_change_event_party GROUP BY 1
    ) t
  ),
  'links', (SELECT count(*) FROM ownership_change_relationship_link),
  'link_roles', (
    SELECT coalesce(jsonb_object_agg(link_role, n), '{}'::jsonb)
    FROM (
      SELECT link_role, count(*) AS n
      FROM ownership_change_relationship_link GROUP BY 1
    ) t
  ),
  'completeness', (
    SELECT jsonb_build_object(
      'event_only', count(*) FILTER (
        WHERE NOT has_prior AND NOT has_new AND NOT has_pct AND NOT has_control
      ),
      'event_plus_prior', count(*) FILTER (WHERE has_prior AND NOT has_new),
      'event_plus_new', count(*) FILTER (WHERE has_new AND NOT has_prior),
      'event_plus_prior_and_new', count(*) FILTER (WHERE has_prior AND has_new),
      'event_plus_percentage', count(*) FILTER (WHERE has_pct),
      'event_plus_control_role', count(*) FILTER (WHERE has_control)
    )
    FROM (
      SELECT e.id,
        EXISTS (
          SELECT 1 FROM ownership_change_event_party p
          WHERE p.event_id=e.id AND p.participant_role IN ('SELLER','PRIOR_OWNER')
        ) AS has_prior,
        EXISTS (
          SELECT 1 FROM ownership_change_event_party p
          WHERE p.event_id=e.id AND p.participant_role IN ('BUYER','NEW_OWNER')
        ) AS has_new,
        EXISTS (
          SELECT 1 FROM ownership_change_event_party p
          WHERE p.event_id=e.id AND p.ownership_percentage IS NOT NULL
        ) AS has_pct,
        EXISTS (
          SELECT 1 FROM ownership_change_event_party p
          WHERE p.event_id=e.id AND p.participant_role='EVENT_PARTICIPANT'
        ) AS has_control
      FROM ownership_change_event e
    ) t
  ),
  'historical_overlap', (
    WITH hist AS (
      SELECT DISTINCT provider_id
      FROM provider_organization_edge
      WHERE temporal_status='HISTORICAL' AND provider_id IS NOT NULL
    ),
    chow AS (
      SELECT DISTINCT provider_id
      FROM ownership_change_event
      WHERE provider_id IS NOT NULL
    )
    SELECT jsonb_build_object(
      'chow_plus_historical', (SELECT count(*) FROM hist JOIN chow USING (provider_id)),
      'chow_only', (
        SELECT count(*) FROM chow WHERE provider_id NOT IN (SELECT provider_id FROM hist)
      ),
      'historical_only', (
        SELECT count(*) FROM hist WHERE provider_id NOT IN (SELECT provider_id FROM chow)
      )
    )
  ),
  'unknown_edges', (
    SELECT count(*) FROM provider_organization_edge WHERE temporal_status='UNKNOWN'
  ),
  'historical_edges', (
    SELECT count(*) FROM provider_organization_edge WHERE temporal_status='HISTORICAL'
  ),
  'effective_to_set', (
    SELECT count(*) FROM provider_organization_edge WHERE effective_to IS NOT NULL
  ),
  'unresolved_graph_edges', (
    SELECT count(*) FROM provider_organization_edge WHERE provider_id IS NULL
  ),
  'org_relationships', (SELECT count(*) FROM organization_relationship)
)
"""

REGRESSION_SQL = """
SELECT jsonb_build_object(
  'nh_known', (SELECT count(*) FROM provider WHERE provider_type='nursing_home'),
  'nh_current_directory', (
    SELECT count(*) FROM (
      SELECT DISTINCT ON (pds.ccn) pds.directory_status
      FROM provider_directory_status pds
      JOIN provider p ON p.id = pds.provider_id
      WHERE p.provider_type='nursing_home'
      ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
    ) latest
    WHERE directory_status='CURRENT_ACTIVE'
  ),
  'hh_snapshots', (SELECT count(*) FROM home_health_snapshot),
  'hospice_gi_snapshots', (SELECT count(*) FROM hospice_snapshot),
  'hospice_typed_providers', (SELECT count(*) FROM provider WHERE provider_type='hospice'),
  'mds', (SELECT count(*) FROM facility_quality_measure_observation),
  'fire', (SELECT count(*) FROM fire_safety_citation),
  'pbj', (SELECT count(*) FROM pbj_staffing_day)
)
"""


def _count(connection: psycopg.Connection, sql: str) -> int:
    return int(connection.execute(sql).fetchone()[0])


def derive_ownership_change_events(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute("SET statement_timeout = 0")
        before = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        events_before = _count(connection, "SELECT count(*) FROM ownership_change_event")
        parties_before = _count(connection, "SELECT count(*) FROM ownership_change_event_party")
        links_before = _count(connection, "SELECT count(*) FROM ownership_change_relationship_link")
        unknown_before = _count(
            connection,
            "SELECT count(*) FROM provider_organization_edge WHERE temporal_status='UNKNOWN'",
        )
        effective_to_before = _count(
            connection,
            "SELECT count(*) FROM provider_organization_edge WHERE effective_to IS NOT NULL",
        )
        print("change: classify events", flush=True)
        classified = connection.execute(
            CLASSIFY_EVENTS_SQL,
            (
                SNF_CHOW_DATASET,
                SNF_CHOW_DATASET,
                SOURCE_AGENCY,
                SNF_CHOW_CMS_ID,
                TRANSFORMATION_VERSION,
                SNF_CHOW_DATASET,
                TRANSFORMATION_VERSION,
            ),
        ).rowcount
        print(f"change: classified_writes={classified}", flush=True)
        print("change: legal entity parties", flush=True)
        legal = connection.execute(UPSERT_LEGAL_PARTIES_SQL, (TRANSFORMATION_VERSION,)).rowcount
        print(f"change: legal_party_writes={legal}", flush=True)
        print("change: materialize enrollment maps", flush=True)
        connection.execute("DROP TABLE IF EXISTS tmp_chow_event")
        connection.execute(CREATE_EVENT_TEMP_SQL)
        connection.execute(
            "CREATE INDEX tmp_chow_event_buyer_idx ON tmp_chow_event (buyer_enrollment_id)"
        )
        connection.execute(
            "CREATE INDEX tmp_chow_event_seller_idx ON tmp_chow_event (seller_enrollment_id)"
        )
        connection.execute("DROP TABLE IF EXISTS tmp_chow_owner_info")
        connection.execute(CREATE_OWNER_INFO_TEMP_SQL, (SNF_CHOW_OWNERS_DATASET,))
        connection.execute(
            "CREATE INDEX tmp_chow_owner_info_enr_idx ON tmp_chow_owner_info (enrollment_id)"
        )
        print("change: owner-info parties", flush=True)
        owners = connection.execute(
            UPSERT_OWNER_INFO_PARTIES_SQL, (TRANSFORMATION_VERSION,)
        ).rowcount
        print(f"change: owner_info_party_writes={owners}", flush=True)
        print("change: relationship links", flush=True)
        links = connection.execute(UPSERT_LINKS_SQL, (TRANSFORMATION_VERSION,)).rowcount
        print(f"change: link_writes={links}", flush=True)
        census = connection.execute(CENSUS_SQL).fetchone()[0]
        regression = connection.execute(REGRESSION_SQL).fetchone()[0]
        after = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        events_after = int(census["events"])
        parties_after = int(census["parties"])
        links_after = int(census["links"])
        unknown_after = int(census["unknown_edges"])
        payload = {
            "transformation_version": TRANSFORMATION_VERSION,
            "source_dataset_key": SNF_CHOW_DATASET,
            "source_dataset_id": SNF_CHOW_CMS_ID,
            "hh_event_availability": home_health_event_availability(),
            "hospice_event_availability": hospice_event_availability(),
            "pending_status_supported": False,
            "unknown_converted_to_historical": 0,
            "effective_to_invented_from_snapshot": 0,
            "sibling_event_propagation": 0,
            "public_writes": 0,
            "classified_event_writes": int(classified),
            "inserted_legal_parties": int(legal),
            "inserted_owner_info_parties": int(owners),
            "inserted_links": int(links),
            "new_events": events_after - events_before,
            "new_parties": parties_after - parties_before,
            "new_links": links_after - links_before,
            "unknown_before": unknown_before,
            "unknown_after": unknown_after,
            "unknown_resolved": unknown_before - unknown_after,
            "effective_to_before": effective_to_before,
            "effective_to_after": int(census["effective_to_set"]),
            "census": census,
            "regression": regression,
            "database_bytes_before": int(before),
            "database_bytes_after": int(after),
        }
        payload["quality_only_hospice_not_directory"] = int(
            regression["hospice_typed_providers"]
        ) - int(regression["hospice_gi_snapshots"])
        payload["fingerprint"] = hashlib.sha256(
            json.dumps(
                {
                    "events": census["events"],
                    "parties": census["parties"],
                    "links": census["links"],
                    "providers": census["providers_with_events"],
                    "public_writes": 0,
                },
                sort_keys=True,
                default=str,
            ).encode()
        ).hexdigest()
    return payload


def derive_ownership_change_events_json(database_url: str) -> str:
    return json.dumps(derive_ownership_change_events(database_url), indent=2, default=str) + "\n"
