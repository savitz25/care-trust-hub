"""Set-based derivation of the classified ownership graph from existing CMS rows."""

from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import psycopg
from psycopg import OperationalError

TRANSFORMATION_VERSION = "ownership-graph-v1"
CHOW_OWNER_DATASET = "skilled-nursing-facility-change-of-ownership-owner-information"
BATCH_SIZE = 8000
RECONNECT_EVERY = 15
ZERO_UUID = UUID("00000000-0000-0000-0000-000000000000")

DROP_LATEST_SQL = "DROP TABLE IF EXISTS tmp_graph_latest_release"
CREATE_LATEST_SQL = """
CREATE TEMP TABLE tmp_graph_latest_release AS
SELECT DISTINCT ON (sr.source_dataset_id) sr.id AS release_id
FROM source_release sr
WHERE EXISTS (
  SELECT 1 FROM ingest_run ir
  WHERE ir.source_release_id = sr.id AND ir.status = 'succeeded'
)
ORDER BY sr.source_dataset_id, sr.source_modified_at DESC NULLS LAST,
  sr.release_key DESC
"""
INDEX_LATEST_SQL = (
    "CREATE INDEX tmp_graph_latest_release_idx ON tmp_graph_latest_release (release_id)"
)

NEXT_BATCH_SQL = """
SELECT id
FROM provider_ownership_relationship
WHERE id > %s
  AND btrim(coalesce(relationship_role_text, '')) <> ''
ORDER BY id
LIMIT %s
"""

UPSERT_EDGES_SQL = """
INSERT INTO provider_organization_edge (
  provider_id, provider_type, ownership_party_id, organization_id, party_kind,
  relationship_type, relationship_class, normalized_role, raw_role_text, raw_role_code,
  ownership_percentage, temporal_status, confidence, effective_from, effective_to,
  observed_at, ingested_at, source_release_id, source_dataset_key, source_record_locator,
  provider_ownership_relationship_id, transformation_version
)
SELECT
  r.provider_id,
  p.provider_type,
  r.ownership_party_id,
  op.organization_id,
  op.party_kind,
  CASE
    WHEN r.relationship_role_text = 'Medicare-enrolled legal organization'
      THEN 'ENROLLED_UNDER'
    WHEN position('MANAGING EMPLOYEE' in upper(r.relationship_role_text)) > 0
      OR position('W-2' in upper(r.relationship_role_text)) = 1
      THEN 'MANAGED_BY'
    WHEN position('AUTHORIZED OFFICIAL' in upper(r.relationship_role_text)) > 0
      THEN 'AFFILIATED_WITH'
    WHEN position('DIRECTOR' in upper(r.relationship_role_text)) > 0
      OR position('OFFICER' in upper(r.relationship_role_text)) > 0
      THEN 'AFFILIATED_WITH'
    WHEN position('PARTNER' in upper(r.relationship_role_text)) > 0
      THEN 'OWNED_BY'
    WHEN position('OPERATIONAL' in upper(r.relationship_role_text)) > 0
      OR position('MANAGERIAL CONTROL' in upper(r.relationship_role_text)) > 0
      OR position('MANAGEMENT COMPANY' in upper(r.relationship_role_text)) > 0
      THEN 'OPERATED_BY'
    WHEN position('OWNER' in upper(r.relationship_role_text)) > 0
      OR position('OWNERSHIP' in upper(r.relationship_role_text)) > 0
      THEN 'OWNED_BY'
    ELSE 'AFFILIATED_WITH'
  END,
  CASE
    WHEN r.relationship_role_text = 'Medicare-enrolled legal organization'
      THEN 'ENROLLMENT'
    WHEN position('MANAGING EMPLOYEE' in upper(r.relationship_role_text)) > 0
      OR position('W-2' in upper(r.relationship_role_text)) = 1
      THEN 'MANAGEMENT'
    WHEN position('AUTHORIZED OFFICIAL' in upper(r.relationship_role_text)) > 0
      THEN 'AUTHORIZED_OFFICIAL'
    WHEN position('DIRECTOR' in upper(r.relationship_role_text)) > 0
      OR position('OFFICER' in upper(r.relationship_role_text)) > 0
      THEN 'OFFICER'
    WHEN position('PARTNER' in upper(r.relationship_role_text)) > 0
      THEN 'OWNERSHIP'
    WHEN position('OPERATIONAL' in upper(r.relationship_role_text)) > 0
      OR position('MANAGERIAL CONTROL' in upper(r.relationship_role_text)) > 0
      OR position('MANAGEMENT COMPANY' in upper(r.relationship_role_text)) > 0
      THEN 'OPERATOR'
    WHEN position('OWNER' in upper(r.relationship_role_text)) > 0
      OR position('OWNERSHIP' in upper(r.relationship_role_text)) > 0
      THEN 'OWNERSHIP'
    ELSE 'OTHER'
  END,
  CASE
    WHEN r.relationship_role_text = 'Medicare-enrolled legal organization'
      THEN 'ENROLLED_ORGANIZATION'
    WHEN position('MANAGING EMPLOYEE' in upper(r.relationship_role_text)) > 0
      THEN 'MANAGING_EMPLOYEE'
    WHEN position('AUTHORIZED OFFICIAL' in upper(r.relationship_role_text)) > 0
      THEN 'AUTHORIZED_OFFICIAL'
    WHEN position('DIRECTOR' in upper(r.relationship_role_text)) > 0 THEN 'DIRECTOR'
    WHEN position('OFFICER' in upper(r.relationship_role_text)) > 0 THEN 'OFFICER'
    WHEN position('PARTNER' in upper(r.relationship_role_text)) > 0 THEN 'PARTNER'
    WHEN position('OPERATIONAL' in upper(r.relationship_role_text)) > 0
      OR position('MANAGERIAL CONTROL' in upper(r.relationship_role_text)) > 0
      OR position('MANAGEMENT COMPANY' in upper(r.relationship_role_text)) > 0
      THEN 'OPERATOR'
    WHEN position('INDIRECT' in upper(r.relationship_role_text)) > 0 THEN 'INDIRECT_OWNER'
    WHEN position('DIRECT' in upper(r.relationship_role_text)) > 0
      AND position('OWNER' in upper(r.relationship_role_text)) > 0 THEN 'DIRECT_OWNER'
    WHEN position('OWNER' in upper(r.relationship_role_text)) > 0
      OR position('OWNERSHIP' in upper(r.relationship_role_text)) > 0 THEN 'OWNER'
    ELSE 'OTHER'
  END,
  r.relationship_role_text,
  r.relationship_role_code,
  r.ownership_percentage,
  CASE
    WHEN d.dataset_key = 'skilled-nursing-facility-change-of-ownership-owner-information'
      THEN 'HISTORICAL'
    WHEN latest.release_id IS NOT NULL THEN 'CURRENT'
    ELSE 'UNKNOWN'
  END,
  CASE WHEN r.provider_id IS NULL THEN 'UNRESOLVED' ELSE 'CONFIRMED' END,
  r.association_date,
  NULL,
  sr.source_modified_at,
  NULL,
  r.source_release_id,
  d.dataset_key,
  r.source_record_locator,
  r.id,
  'ownership-graph-v1'
FROM provider_ownership_relationship r
JOIN ownership_party op ON op.id = r.ownership_party_id
JOIN source_release sr ON sr.id = r.source_release_id
JOIN source_dataset d ON d.id = sr.source_dataset_id
LEFT JOIN provider p ON p.id = r.provider_id
LEFT JOIN tmp_graph_latest_release latest ON latest.release_id = r.source_release_id
WHERE r.id = ANY(%s)
ON CONFLICT (provider_ownership_relationship_id) DO UPDATE SET
  provider_id = EXCLUDED.provider_id,
  provider_type = EXCLUDED.provider_type,
  relationship_type = EXCLUDED.relationship_type,
  relationship_class = EXCLUDED.relationship_class,
  normalized_role = EXCLUDED.normalized_role,
  temporal_status = EXCLUDED.temporal_status,
  confidence = EXCLUDED.confidence,
  ownership_percentage = EXCLUDED.ownership_percentage,
  transformation_version = EXCLUDED.transformation_version
WHERE provider_organization_edge.provider_id IS DISTINCT FROM EXCLUDED.provider_id
   OR provider_organization_edge.provider_type IS DISTINCT FROM EXCLUDED.provider_type
   OR provider_organization_edge.relationship_type IS DISTINCT FROM EXCLUDED.relationship_type
   OR provider_organization_edge.relationship_class IS DISTINCT FROM EXCLUDED.relationship_class
   OR provider_organization_edge.normalized_role IS DISTINCT FROM EXCLUDED.normalized_role
   OR provider_organization_edge.temporal_status IS DISTINCT FROM EXCLUDED.temporal_status
   OR provider_organization_edge.confidence IS DISTINCT FROM EXCLUDED.confidence
   OR provider_organization_edge.ownership_percentage
        IS DISTINCT FROM EXCLUDED.ownership_percentage
   OR provider_organization_edge.transformation_version
        IS DISTINCT FROM EXCLUDED.transformation_version
"""

UPSERT_NAMES_SQL = """
INSERT INTO organization_name_observation (
  organization_id, name_text, name_kind, source_release_id, source_record_locator,
  observed_at, transformation_version
)
SELECT DISTINCT
  op.organization_id,
  op.display_name,
  'observed',
  r.source_release_id,
  r.source_record_locator,
  sr.source_modified_at,
  'ownership-graph-v1'
FROM provider_ownership_relationship r
JOIN ownership_party op ON op.id = r.ownership_party_id
JOIN source_release sr ON sr.id = r.source_release_id
WHERE r.id = ANY(%s)
  AND op.organization_id IS NOT NULL
  AND btrim(op.display_name) <> ''
ON CONFLICT (organization_id, name_text, name_kind, source_release_id) DO NOTHING
"""

CENSUS_SQL = """
SELECT jsonb_build_object(
  'organizations', (SELECT count(*) FROM organization),
  'person_parties', (SELECT count(*) FROM ownership_party WHERE party_kind='individual'),
  'organization_parties', (SELECT count(*) FROM ownership_party WHERE party_kind='organization'),
  'edges', (SELECT count(*) FROM provider_organization_edge),
  'edges_by_type', (
    SELECT coalesce(jsonb_object_agg(relationship_type, n), '{}'::jsonb)
    FROM (SELECT relationship_type, count(*) AS n FROM provider_organization_edge GROUP BY 1) t
  ),
  'edges_by_class', (
    SELECT coalesce(jsonb_object_agg(relationship_class, n), '{}'::jsonb)
    FROM (SELECT relationship_class, count(*) AS n FROM provider_organization_edge GROUP BY 1) t
  ),
  'temporal', (
    SELECT coalesce(jsonb_object_agg(temporal_status, n), '{}'::jsonb)
    FROM (SELECT temporal_status, count(*) AS n FROM provider_organization_edge GROUP BY 1) t
  ),
  'confidence', (
    SELECT coalesce(jsonb_object_agg(confidence, n), '{}'::jsonb)
    FROM (SELECT confidence, count(*) AS n FROM provider_organization_edge GROUP BY 1) t
  ),
  'edges_by_provider_type', (
    SELECT coalesce(jsonb_object_agg(coalesce(provider_type,'unmatched'), n), '{}'::jsonb)
    FROM (
      SELECT provider_type, count(*) AS n FROM provider_organization_edge GROUP BY 1
    ) t
  ),
  'owner_organizations', (
    SELECT count(DISTINCT organization_id) FROM provider_organization_edge
    WHERE relationship_class='OWNERSHIP' AND organization_id IS NOT NULL
  ),
  'enrollment_only_organizations', (
    SELECT count(*) FROM (
      SELECT organization_id
      FROM provider_organization_edge
      WHERE organization_id IS NOT NULL
      GROUP BY organization_id
      HAVING bool_and(relationship_class='ENROLLMENT')
    ) t
  ),
  'person_equity_owners', (
    SELECT count(DISTINCT ownership_party_id) FROM provider_organization_edge
    WHERE party_kind='individual' AND relationship_class='OWNERSHIP'
  ),
  'org_owned_by_edges', (
    SELECT count(*) FROM provider_organization_edge
    WHERE relationship_type='OWNED_BY' AND party_kind='organization'
  ),
  'person_owned_by_edges', (
    SELECT count(*) FROM provider_organization_edge
    WHERE relationship_type='OWNED_BY' AND party_kind='individual'
  ),
  'owned_by_with_percentage', (
    SELECT count(*) FROM provider_organization_edge
    WHERE relationship_type='OWNED_BY' AND ownership_percentage IS NOT NULL
  ),
  'providers_with_historical_edge', (
    SELECT count(DISTINCT provider_id) FROM provider_organization_edge
    WHERE temporal_status='HISTORICAL' AND provider_id IS NOT NULL
  ),
  'class_x_rel', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'provider_type', coalesce(provider_type,'unmatched'),
      'relationship_type', relationship_type,
      'n', n
    ) ORDER BY provider_type, relationship_type), '[]'::jsonb)
    FROM (
      SELECT provider_type, relationship_type, count(*) AS n
      FROM provider_organization_edge
      GROUP BY 1,2
    ) t
  ),
  'class_x_temporal', (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'provider_type', coalesce(provider_type,'unmatched'),
      'temporal_status', temporal_status,
      'n', n
    ) ORDER BY provider_type, temporal_status), '[]'::jsonb)
    FROM (
      SELECT provider_type, temporal_status, count(*) AS n
      FROM provider_organization_edge
      GROUP BY 1,2
    ) t
  ),
  'owned_by_providers', (
    SELECT jsonb_build_object(
      'nursing_home', count(*) FILTER (WHERE provider_type='nursing_home'),
      'home_health', count(*) FILTER (WHERE provider_type='home_health'),
      'hospice', count(*) FILTER (WHERE provider_type='hospice')
    )
    FROM (
      SELECT DISTINCT provider_id, provider_type
      FROM provider_organization_edge
      WHERE relationship_type='OWNED_BY' AND provider_id IS NOT NULL
    ) t
  ),
  'org_relationships', (SELECT count(*) FROM organization_relationship),
  'chow_events', (SELECT count(*) FROM ownership_change_event),
  'name_observations', (SELECT count(*) FROM organization_name_observation)
)
"""

CROSS_CLASS_SQL = """
WITH typed AS (
  SELECT organization_id, provider_type, count(DISTINCT provider_id) AS providers
  FROM provider_organization_edge
  WHERE organization_id IS NOT NULL
    AND provider_id IS NOT NULL
    AND provider_type IS NOT NULL
  GROUP BY 1,2
),
pivoted AS (
  SELECT
    organization_id,
    coalesce(sum(providers) FILTER (WHERE provider_type='nursing_home'),0) AS nh,
    coalesce(sum(providers) FILTER (WHERE provider_type='home_health'),0) AS hh,
    coalesce(sum(providers) FILTER (WHERE provider_type='hospice'),0) AS hospice
  FROM typed
  GROUP BY organization_id
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
WITH all_counts AS (
  SELECT organization_id, count(DISTINCT provider_id) AS n
  FROM provider_organization_edge
  WHERE organization_id IS NOT NULL AND provider_id IS NOT NULL
  GROUP BY 1
),
owned AS (
  SELECT organization_id, count(DISTINCT provider_id) AS n
  FROM provider_organization_edge
  WHERE organization_id IS NOT NULL
    AND provider_id IS NOT NULL
    AND relationship_type='OWNED_BY'
  GROUP BY 1
),
by_class AS (
  SELECT provider_type, count(DISTINCT provider_id) AS n, organization_id
  FROM provider_organization_edge
  WHERE organization_id IS NOT NULL AND provider_id IS NOT NULL
  GROUP BY 1,3
)
SELECT jsonb_build_object(
  'all_relationships', jsonb_build_object(
    '1', (SELECT count(*) FROM all_counts WHERE n=1),
    '2_5', (SELECT count(*) FROM all_counts WHERE n BETWEEN 2 AND 5),
    '6_10', (SELECT count(*) FROM all_counts WHERE n BETWEEN 6 AND 10),
    '11_25', (SELECT count(*) FROM all_counts WHERE n BETWEEN 11 AND 25),
    '26_50', (SELECT count(*) FROM all_counts WHERE n BETWEEN 26 AND 50),
    '51_100', (SELECT count(*) FROM all_counts WHERE n BETWEEN 51 AND 100),
    '101_plus', (SELECT count(*) FROM all_counts WHERE n>=101)
  ),
  'owned_by_only', jsonb_build_object(
    '1', (SELECT count(*) FROM owned WHERE n=1),
    '2_5', (SELECT count(*) FROM owned WHERE n BETWEEN 2 AND 5),
    '6_10', (SELECT count(*) FROM owned WHERE n BETWEEN 6 AND 10),
    '11_25', (SELECT count(*) FROM owned WHERE n BETWEEN 11 AND 25),
    '26_50', (SELECT count(*) FROM owned WHERE n BETWEEN 26 AND 50),
    '51_100', (SELECT count(*) FROM owned WHERE n BETWEEN 51 AND 100),
    '101_plus', (SELECT count(*) FROM owned WHERE n>=101)
  ),
  'by_class', (
    SELECT coalesce(jsonb_object_agg(provider_type, buckets), '{}'::jsonb)
    FROM (
      SELECT provider_type, jsonb_build_object(
        '1', count(*) FILTER (WHERE n=1),
        '2_5', count(*) FILTER (WHERE n BETWEEN 2 AND 5),
        '6_10', count(*) FILTER (WHERE n BETWEEN 6 AND 10),
        '11_25', count(*) FILTER (WHERE n BETWEEN 11 AND 25),
        '26_50', count(*) FILTER (WHERE n BETWEEN 26 AND 50),
        '51_100', count(*) FILTER (WHERE n BETWEEN 51 AND 100),
        '101_plus', count(*) FILTER (WHERE n>=101)
      ) AS buckets
      FROM by_class
      GROUP BY provider_type
    ) t
  )
)
"""

STATES_SQL = """
WITH nh_state AS (
  SELECT DISTINCT ON (provider_id) provider_id, state_code
  FROM facility_snapshot
  ORDER BY provider_id, id DESC
),
hh_state AS (
  SELECT DISTINCT ON (provider_id) provider_id, state_code
  FROM home_health_snapshot
  ORDER BY provider_id, id DESC
),
hs_state AS (
  SELECT DISTINCT ON (provider_id) provider_id, state_code
  FROM hospice_snapshot
  ORDER BY provider_id, id DESC
),
org_states AS (
  SELECT e.organization_id,
         count(DISTINCT coalesce(nh.state_code, hh.state_code, hs.state_code)) AS states
  FROM provider_organization_edge e
  LEFT JOIN nh_state nh ON nh.provider_id = e.provider_id
  LEFT JOIN hh_state hh ON hh.provider_id = e.provider_id
  LEFT JOIN hs_state hs ON hs.provider_id = e.provider_id
  WHERE e.organization_id IS NOT NULL AND e.provider_id IS NOT NULL
  GROUP BY 1
)
SELECT jsonb_build_object(
  '1', count(*) FILTER (WHERE states=1),
  '2_5', count(*) FILTER (WHERE states BETWEEN 2 AND 5),
  '6_10', count(*) FILTER (WHERE states BETWEEN 6 AND 10),
  '11_plus', count(*) FILTER (WHERE states>=11),
  'unknown', count(*) FILTER (WHERE states=0)
)
FROM org_states
"""

COLLISION_SQL = """
SELECT jsonb_build_object(
  'pac_multiple_names', (
    SELECT count(*) FROM (
      SELECT oi.identifier_value
      FROM organization_identifier oi
      JOIN ownership_party op ON op.organization_id = oi.organization_id
      WHERE oi.issuer='CMS_PECOS' AND oi.identifier_type='PAC_ID'
      GROUP BY oi.identifier_value
      HAVING count(DISTINCT op.display_name) > 1
    ) t
  ),
  'same_name_many_pacs', (
    SELECT count(*) FROM (
      SELECT lower(op.display_name)
      FROM ownership_party op
      JOIN organization_identifier oi ON oi.organization_id = op.organization_id
      WHERE oi.issuer='CMS_PECOS' AND oi.identifier_type='PAC_ID'
        AND op.party_kind='organization'
      GROUP BY 1
      HAVING count(DISTINCT oi.identifier_value) > 1
    ) t
  ),
  'npi_multiple_orgs', (
    SELECT count(*) FROM (
      SELECT identifier_value FROM organization_identifier
      WHERE issuer='NPPES' AND identifier_type='NPI'
      GROUP BY 1 HAVING count(DISTINCT organization_id) > 1
    ) t
  ),
  'pac_person_and_org', (
    SELECT count(*) FROM (
      SELECT regexp_replace(
        source_identity_key,
        '^CMS_PECOS:(PAC|PERSON):',
        ''
      )
      FROM ownership_party
      WHERE position('CMS_PECOS:' in source_identity_key) = 1
      GROUP BY 1
      HAVING count(DISTINCT party_kind) > 1
    ) t
  ),
  'org_relationships', (SELECT count(*) FROM organization_relationship)
)
"""

BASELINE_SQL = """
SELECT jsonb_build_object(
  'organizations', (SELECT count(*) FROM organization),
  'ownership_parties', (SELECT count(*) FROM ownership_party),
  'organization_relationships', (SELECT count(*) FROM organization_relationship),
  'edges', (SELECT count(*) FROM provider_organization_edge),
  'name_observations', (SELECT count(*) FROM organization_name_observation)
)
"""


def _count(connection: psycopg.Connection, sql: str) -> int:
    return int(connection.execute(sql).fetchone()[0])


def collect_ownership_graph_metrics(connection: psycopg.Connection) -> dict[str, Any]:
    print("graph: census", flush=True)
    census = connection.execute(CENSUS_SQL).fetchone()[0]
    print("graph: cross-class", flush=True)
    cross = connection.execute(CROSS_CLASS_SQL).fetchone()[0]
    print("graph: network", flush=True)
    network = connection.execute(NETWORK_SQL).fetchone()[0]
    print("graph: multi-state", flush=True)
    states = connection.execute(STATES_SQL).fetchone()[0]
    print("graph: collisions", flush=True)
    collisions = connection.execute(COLLISION_SQL).fetchone()[0]
    print("graph: regression counts", flush=True)
    nh_known = _count(
        connection,
        "SELECT count(*) FROM provider WHERE provider_type='nursing_home'",
    )
    nh_pi = _count(
        connection,
        """
        SELECT count(*) FROM (
          SELECT DISTINCT ON (pds.ccn) pds.directory_status
          FROM provider_directory_status pds
          JOIN provider p ON p.id = pds.provider_id
          WHERE p.provider_type='nursing_home'
          ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
        ) latest
        WHERE directory_status='CURRENT_ACTIVE'
        """,
    )
    hh = _count(connection, "SELECT count(*) FROM home_health_snapshot")
    hospice_dir = _count(connection, "SELECT count(*) FROM hospice_snapshot")
    hospice_typed = _count(
        connection,
        "SELECT count(*) FROM provider WHERE provider_type='hospice'",
    )
    mds = _count(connection, "SELECT count(*) FROM facility_quality_measure_observation")
    fire = _count(connection, "SELECT count(*) FROM fire_safety_citation")
    pbj = _count(connection, "SELECT count(*) FROM pbj_staffing_day")
    bytes_after = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
    return {
        "census": census,
        "cross_class": cross,
        "network_size": network,
        "multi_state": states,
        "collisions": collisions,
        "database_bytes": int(bytes_after),
        "regression": {
            "nh_known": int(nh_known),
            "nh_current_directory": int(nh_pi),
            "hh_snapshots": int(hh),
            "hospice_gi_snapshots": int(hospice_dir),
            "hospice_typed_providers": int(hospice_typed),
            "quality_only_hospice_not_directory": int(hospice_typed - hospice_dir),
            "mds": int(mds),
            "fire": int(fire),
            "pbj": int(pbj),
        },
    }


def ownership_graph_report(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url, autocommit=True) as connection:
        connection.execute("SET statement_timeout = 0")
        baseline = connection.execute(BASELINE_SQL).fetchone()[0]
        metrics = collect_ownership_graph_metrics(connection)
    return {
        "transformation_version": TRANSFORMATION_VERSION,
        "chow_owner_dataset": CHOW_OWNER_DATASET,
        "parent_subsidiary_edges": 0,
        "pac_is_not_parent_company": True,
        "name_is_not_canonical_identity": True,
        "baseline": baseline,
        **metrics,
    }


def _open_graph_connection(database_url: str) -> psycopg.Connection:
    connection = psycopg.connect(database_url, autocommit=True)
    connection.execute("SET statement_timeout = 0")
    connection.execute(DROP_LATEST_SQL)
    connection.execute(CREATE_LATEST_SQL)
    connection.execute(INDEX_LATEST_SQL)
    return connection


def derive_ownership_graph(database_url: str, *, resume: bool = True) -> dict[str, Any]:
    connection = _open_graph_connection(database_url)
    try:
        print("graph: measuring baseline", flush=True)
        before = connection.execute("SELECT pg_database_size(current_database())").fetchone()[0]
        baseline_before = connection.execute(BASELINE_SQL).fetchone()[0]
        edges_before = int(baseline_before["edges"])
        names_before = int(baseline_before["name_observations"])
        last_id = ZERO_UUID
        if resume:
            last_row = connection.execute(
                """
                SELECT provider_ownership_relationship_id
                FROM provider_organization_edge
                ORDER BY provider_ownership_relationship_id DESC
                LIMIT 1
                """
            ).fetchone()
            last_id = last_row[0] if last_row else ZERO_UUID
        print(f"graph: resume={resume} after {last_id}", flush=True)
        edge_writes = 0
        name_writes = 0
        batches = 0
        failures = 0
        while True:
            try:
                batch = connection.execute(NEXT_BATCH_SQL, (last_id, BATCH_SIZE)).fetchall()
                if not batch:
                    break
                batch_ids = [row[0] for row in batch]
                with connection.transaction():
                    edge_writes += int(connection.execute(UPSERT_EDGES_SQL, (batch_ids,)).rowcount)
                    name_writes += int(connection.execute(UPSERT_NAMES_SQL, (batch_ids,)).rowcount)
                last_id = batch_ids[-1]
                batches += 1
                if batches == 1 or batches % 10 == 0:
                    print(
                        f"graph: batch={batches} last_id={last_id} "
                        f"edge_writes={edge_writes} name_writes={name_writes}",
                        flush=True,
                    )
                if batches % RECONNECT_EVERY == 0:
                    connection.close()
                    connection = _open_graph_connection(database_url)
                    print(f"graph: reconnected after {batches} batches", flush=True)
            except OperationalError as exc:
                failures += 1
                print(f"graph: reconnect after operational error ({failures}): {exc}", flush=True)
                try:
                    connection.close()
                except OperationalError:
                    pass
                if failures > 25:
                    raise
                connection = _open_graph_connection(database_url)
        print(
            f"graph: batches={batches} edge_writes={edge_writes} name_writes={name_writes} "
            f"failures={failures}",
            flush=True,
        )
        baseline_after = connection.execute(BASELINE_SQL).fetchone()[0]
        inserted_edges = int(baseline_after["edges"]) - edges_before
        updated_edges = max(int(edge_writes) - inserted_edges, 0)
        inserted_names = int(baseline_after["name_observations"]) - names_before
        metrics = collect_ownership_graph_metrics(connection)
    finally:
        try:
            connection.close()
        except OperationalError:
            pass
    return {
        "transformation_version": TRANSFORMATION_VERSION,
        "chow_owner_dataset": CHOW_OWNER_DATASET,
        "load_method": f"batched INSERT...SELECT {BATCH_SIZE} by relationship PK",
        "batches": batches,
        "failures": failures,
        "inserted_edges": int(inserted_edges),
        "updated_edges": int(updated_edges),
        "inserted_name_observations": int(inserted_names),
        "parent_subsidiary_edges": 0,
        "pac_is_not_parent_company": True,
        "name_is_not_canonical_identity": True,
        "baseline_before": baseline_before,
        "baseline_after": baseline_after,
        "census": metrics["census"],
        "cross_class": metrics["cross_class"],
        "network_size": metrics["network_size"],
        "multi_state": metrics["multi_state"],
        "collisions": metrics["collisions"],
        "database_bytes_before": int(before),
        "database_bytes_after": metrics["database_bytes"],
        "regression": metrics["regression"],
    }


def derive_ownership_graph_json(database_url: str) -> str:
    return json.dumps(derive_ownership_graph(database_url), indent=2, default=str) + "\n"
