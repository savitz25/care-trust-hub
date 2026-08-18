"""Idempotent national derivation of ownership portfolios from existing CMS evidence."""

# Set-based SQL is kept readable; statements are long by design.
# ruff: noqa: E501

from __future__ import annotations

import json
from typing import Any

import psycopg

DERIVATION_VERSION = "ownership-portfolio-v1"
HIGH_VALUE_FINE_USD = 10_000
RECENT_MONTHS = 18
PORTFOLIO_MIN_FACILITIES = 3

OWNERSHIP_DATASET_KEYS = (
    "skilled-nursing-facility-enrollments",
    "skilled-nursing-facility-all-owners",
    "nursing-home-ownership",
)

UPSERT_MEMBERS_SQL = """
WITH latest AS (
  SELECT DISTINCT ON (sr.source_dataset_id) sr.id AS release_id
  FROM source_release sr
  JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
  JOIN source_dataset sd ON sd.id = sr.source_dataset_id
  WHERE sd.dataset_key IN (
    'skilled-nursing-facility-enrollments',
    'skilled-nursing-facility-all-owners',
    'nursing-home-ownership'
  )
  ORDER BY sr.source_dataset_id, sr.source_modified_at DESC NULLS LAST,
    sr.source_release_date DESC NULLS LAST, sr.release_key DESC
),
rel AS (
  SELECT
    p.organization_id,
    r.provider_id,
    r.relationship_role_text,
    r.association_date,
    r.source_release_id,
    sr.source_modified_at,
    (r.source_release_id IN (SELECT release_id FROM latest)) AS in_latest
  FROM provider_ownership_relationship r
  JOIN ownership_party p ON p.id = r.ownership_party_id
  JOIN source_release sr ON sr.id = r.source_release_id
  WHERE p.organization_id IS NOT NULL
    AND r.provider_id IS NOT NULL
),
classified AS (
  SELECT
    organization_id,
    provider_id,
    CASE WHEN bool_or(in_latest) THEN 'current' ELSE 'historical' END AS membership_status,
    array_agg(DISTINCT relationship_role_text ORDER BY relationship_role_text) AS relationship_roles,
    min(association_date) AS association_date,
    (array_agg(source_release_id ORDER BY source_modified_at ASC NULLS LAST, source_release_id))[1] AS first_seen_release_id,
    (array_agg(source_release_id ORDER BY source_modified_at DESC NULLS LAST, source_release_id))[1] AS last_seen_release_id
  FROM rel
  GROUP BY organization_id, provider_id
)
INSERT INTO ownership_portfolio_member (
  organization_id, provider_id, membership_status, relationship_roles, association_date,
  first_seen_release_id, last_seen_release_id, fingerprint, derivation_version
)
SELECT
  organization_id,
  provider_id,
  membership_status,
  relationship_roles,
  association_date,
  first_seen_release_id,
  last_seen_release_id,
  %s || '|' || organization_id::text || '|' || provider_id::text || '|' || membership_status,
  %s
FROM classified
ON CONFLICT (organization_id, provider_id) DO UPDATE SET
  membership_status = EXCLUDED.membership_status,
  relationship_roles = EXCLUDED.relationship_roles,
  association_date = EXCLUDED.association_date,
  first_seen_release_id = EXCLUDED.first_seen_release_id,
  last_seen_release_id = EXCLUDED.last_seen_release_id,
  fingerprint = EXCLUDED.fingerprint,
  derivation_version = EXCLUDED.derivation_version,
  derived_at = now()
WHERE ownership_portfolio_member.fingerprint IS DISTINCT FROM EXCLUDED.fingerprint
RETURNING (xmax = 0) AS inserted
"""

DELETE_STALE_MEMBERS_SQL = """
DELETE FROM ownership_portfolio_member m
WHERE m.derivation_version = %s
  AND NOT EXISTS (
    SELECT 1
    FROM ownership_party p
    JOIN provider_ownership_relationship r ON r.ownership_party_id = p.id
    WHERE p.organization_id = m.organization_id
      AND r.provider_id = m.provider_id
      AND p.organization_id IS NOT NULL
      AND r.provider_id IS NOT NULL
  )
"""

UPSERT_PORTFOLIOS_SQL = """
WITH latest AS (
  SELECT DISTINCT ON (sr.source_dataset_id) sr.id AS release_id
  FROM source_release sr
  JOIN ingest_run ir ON ir.source_release_id = sr.id AND ir.status = 'succeeded'
  JOIN source_dataset sd ON sd.id = sr.source_dataset_id
  WHERE sd.dataset_key IN (
    'skilled-nursing-facility-enrollments',
    'skilled-nursing-facility-all-owners',
    'nursing-home-ownership'
  )
  ORDER BY sr.source_dataset_id, sr.source_modified_at DESC NULLS LAST,
    sr.source_release_date DESC NULLS LAST, sr.release_key DESC
),
names AS (
  SELECT organization_id, display_name
  FROM (
    SELECT
      p.organization_id,
      p.display_name,
      row_number() OVER (
        PARTITION BY p.organization_id
        ORDER BY count(*) FILTER (
          WHERE r.source_release_id IN (SELECT release_id FROM latest)
        ) DESC,
        count(*) DESC,
        p.display_name
      ) AS rn
    FROM ownership_party p
    JOIN provider_ownership_relationship r ON r.ownership_party_id = p.id
    WHERE p.organization_id IS NOT NULL
    GROUP BY p.organization_id, p.display_name
  ) ranked
  WHERE rn = 1
),
latest_snapshot AS (
  SELECT DISTINCT ON (provider_id)
    provider_id, provider_name, city, state_code,
    overall_rating, staffing_rating, health_inspection_rating, quality_measure_rating
  FROM facility_snapshot
  ORDER BY provider_id, observed_at DESC NULLS LAST
),
staffing AS (
  SELECT DISTINCT ON (provider_id)
    provider_id, rn_hprd, total_nurse_hprd
  FROM pbj_staffing_quarter_summary
  ORDER BY provider_id, source_quarter DESC
),
penalties AS (
  SELECT
    provider_id,
    true AS had_penalty,
    sum(fine_amount) FILTER (WHERE penalty_type = 'Fine') AS penalty_amount,
    bool_or(penalty_date >= CURRENT_DATE - make_interval(months => %s)) AS recent_penalty,
    bool_or(
      penalty_date >= CURRENT_DATE - make_interval(months => %s)
      AND (coalesce(fine_amount, 0) >= %s OR penalty_type = 'Payment Denial')
    ) AS recent_high_value
  FROM penalty_enforcement
  GROUP BY provider_id
),
complaints AS (
  SELECT DISTINCT provider_id
  FROM inspection_event
  WHERE lower(survey_type) LIKE '%%complaint%%'
    AND survey_date >= CURRENT_DATE - make_interval(months => %s)
),
chow AS (
  SELECT DISTINCT provider_id FROM ownership_change_event
),
state_enf AS (
  SELECT DISTINCT provider_id
  FROM facility_history_event
  WHERE event_family = 'state'
    AND publication_eligible
    AND importance IN ('HIGH', 'MEDIUM')
    AND event_date >= CURRENT_DATE - make_interval(months => %s)
),
roles AS (
  SELECT m.organization_id, array_agg(DISTINCT role ORDER BY role) AS relationship_roles
  FROM ownership_portfolio_member m
  CROSS JOIN LATERAL unnest(m.relationship_roles) AS role
  WHERE m.membership_status = 'current'
    AND m.derivation_version = %s
  GROUP BY m.organization_id
),
current_facilities AS (
  SELECT
    m.organization_id,
    m.provider_id,
    fs.provider_name,
    fs.city,
    fs.state_code,
    fs.overall_rating,
    fs.staffing_rating,
    fs.health_inspection_rating,
    fs.quality_measure_rating,
    staff.rn_hprd,
    staff.total_nurse_hprd,
    coalesce(pe.had_penalty, false) AS had_penalty,
    pe.penalty_amount,
    coalesce(pe.recent_penalty, false) AS recent_cms_penalty,
    coalesce(pe.recent_high_value, false) AS recent_high_value,
    (c.provider_id IS NOT NULL) AS recent_complaint,
    (ow.provider_id IS NOT NULL) AS had_ownership_change,
    (se.provider_id IS NOT NULL) AS recent_state
  FROM ownership_portfolio_member m
  JOIN latest_snapshot fs ON fs.provider_id = m.provider_id
  LEFT JOIN staffing staff ON staff.provider_id = m.provider_id
  LEFT JOIN penalties pe ON pe.provider_id = m.provider_id
  LEFT JOIN complaints c ON c.provider_id = m.provider_id
  LEFT JOIN chow ow ON ow.provider_id = m.provider_id
  LEFT JOIN state_enf se ON se.provider_id = m.provider_id
  WHERE m.membership_status = 'current'
    AND m.derivation_version = %s
),
counts AS (
  SELECT
    organization_id,
    count(*) FILTER (WHERE membership_status = 'current') AS current_facility_count,
    count(*) FILTER (WHERE membership_status = 'historical') AS historical_facility_count,
    count(*) FILTER (WHERE membership_status = 'uncertain') AS uncertain_facility_count
  FROM ownership_portfolio_member
  WHERE derivation_version = %s
  GROUP BY organization_id
),
metrics AS (
  SELECT
    organization_id,
    count(*)::int AS metric_facility_count,
    count(DISTINCT state_code)::int AS state_count,
    coalesce(array_agg(DISTINCT state_code ORDER BY state_code), ARRAY[]::text[]) AS states,
    count(*) FILTER (WHERE overall_rating BETWEEN 1 AND 5)::int AS overall_sample,
    count(*) FILTER (WHERE staffing_rating BETWEEN 1 AND 5)::int AS staffing_sample,
    count(*) FILTER (WHERE health_inspection_rating BETWEEN 1 AND 5)::int AS health_sample,
    count(*) FILTER (WHERE quality_measure_rating BETWEEN 1 AND 5)::int AS quality_sample,
    count(*) FILTER (WHERE rn_hprd IS NOT NULL)::int AS rn_sample,
    count(*) FILTER (WHERE total_nurse_hprd IS NOT NULL)::int AS total_nurse_sample,
    round(avg(overall_rating) FILTER (WHERE overall_rating BETWEEN 1 AND 5)::numeric, 1) AS overall_average,
    round(avg(staffing_rating) FILTER (WHERE staffing_rating BETWEEN 1 AND 5)::numeric, 1) AS staffing_average,
    round(avg(health_inspection_rating) FILTER (WHERE health_inspection_rating BETWEEN 1 AND 5)::numeric, 1) AS health_average,
    round(avg(quality_measure_rating) FILTER (WHERE quality_measure_rating BETWEEN 1 AND 5)::numeric, 1) AS quality_average,
    round(avg(rn_hprd) FILTER (WHERE rn_hprd IS NOT NULL)::numeric, 2) AS rn_average,
    round(avg(total_nurse_hprd) FILTER (WHERE total_nurse_hprd IS NOT NULL)::numeric, 2) AS total_nurse_average,
    count(*) FILTER (WHERE overall_rating = 1)::int AS dist_1,
    count(*) FILTER (WHERE overall_rating = 2)::int AS dist_2,
    count(*) FILTER (WHERE overall_rating = 3)::int AS dist_3,
    count(*) FILTER (WHERE overall_rating = 4)::int AS dist_4,
    count(*) FILTER (WHERE overall_rating = 5)::int AS dist_5,
    count(*) FILTER (WHERE had_penalty)::int AS facilities_with_penalty,
    sum(penalty_amount) FILTER (WHERE penalty_amount > 0) AS total_fine_amount,
    count(*) FILTER (WHERE had_ownership_change)::int AS facilities_with_ownership_change,
    count(*) FILTER (WHERE recent_state)::int AS facilities_with_recent_state,
    count(*) FILTER (WHERE recent_cms_penalty)::int AS facilities_with_recent_cms_penalty,
    count(*) FILTER (WHERE recent_high_value)::int AS facilities_with_recent_high_value,
    count(*) FILTER (WHERE recent_complaint)::int AS facilities_with_recent_complaint
  FROM current_facilities
  GROUP BY organization_id
),
prepared AS (
  SELECT
    c.organization_id,
    coalesce(n.display_name, 'Unnamed organization') AS display_name,
    c.current_facility_count::int,
    c.historical_facility_count::int,
    c.uncertain_facility_count::int,
    coalesce(m.state_count, 0) AS state_count,
    coalesce(m.states, ARRAY[]::text[]) AS states,
    coalesce(r.relationship_roles, ARRAY[]::text[]) AS relationship_roles,
    CASE
      WHEN n.display_name ~* '^[A-Za-z]+([''-][A-Za-z]+)*, [A-Za-z]+( [A-Za-z])?$' THEN 'person_like'
      WHEN btrim(regexp_replace(
             regexp_replace(lower(n.display_name), '[.,&]', ' ', 'g'),
             '\\m(llc|l l c|inc|incorporated|corp|corporation|ltd|limited|the)\\M',
             '',
             'g'
           )) IN (
             '', 'care', 'health', 'healthcare', 'health care', 'holdings', 'management',
             'medical', 'nursing', 'nursing home', 'properties', 'property', 'realty',
             'senior care', 'senior living', 'services'
           ) THEN 'generic'
      WHEN length(regexp_replace(coalesce(n.display_name, ''), '[^A-Za-z]', '', 'g')) < 4 THEN 'generic'
      ELSE 'clear'
    END AS risk
  FROM counts c
  LEFT JOIN names n ON n.organization_id = c.organization_id
  LEFT JOIN metrics m ON m.organization_id = c.organization_id
  LEFT JOIN roles r ON r.organization_id = c.organization_id
),
final AS (
  SELECT
    p.organization_id,
    p.display_name,
    p.current_facility_count,
    p.historical_facility_count,
    p.uncertain_facility_count,
    p.state_count,
    p.states,
    p.relationship_roles,
    CASE WHEN p.risk IN ('generic', 'person_like') THEN 'REVIEW_REQUIRED' ELSE 'VERIFIED' END AS resolution_state,
    (
      p.risk = 'clear'
      AND p.current_facility_count >= %s
    ) AS publication_eligible,
    (
      p.risk = 'clear'
      AND p.current_facility_count >= %s
    ) AS indexable,
    jsonb_build_object(
      'facilityCount', p.current_facility_count,
      'stateCount', p.state_count,
      'states', to_jsonb(p.states),
      'relationshipRoles', to_jsonb(p.relationship_roles),
      'overallAverage', CASE WHEN coalesce(m.overall_sample, 0) >= %s THEN m.overall_average ELSE NULL END,
      'overallSampleSize', coalesce(m.overall_sample, 0),
      'overallDistribution', jsonb_build_object(
        '1', coalesce(m.dist_1, 0), '2', coalesce(m.dist_2, 0), '3', coalesce(m.dist_3, 0),
        '4', coalesce(m.dist_4, 0), '5', coalesce(m.dist_5, 0)
      ),
      'staffingAverage', CASE WHEN coalesce(m.staffing_sample, 0) >= %s THEN m.staffing_average ELSE NULL END,
      'staffingSampleSize', coalesce(m.staffing_sample, 0),
      'healthInspectionAverage', CASE WHEN coalesce(m.health_sample, 0) >= %s THEN m.health_average ELSE NULL END,
      'healthInspectionSampleSize', coalesce(m.health_sample, 0),
      'qualityMeasureAverage', CASE WHEN coalesce(m.quality_sample, 0) >= %s THEN m.quality_average ELSE NULL END,
      'qualityMeasureSampleSize', coalesce(m.quality_sample, 0),
      'averageRnHprd', CASE WHEN coalesce(m.rn_sample, 0) >= %s THEN m.rn_average ELSE NULL END,
      'rnSampleSize', coalesce(m.rn_sample, 0),
      'averageTotalNurseHprd', CASE WHEN coalesce(m.total_nurse_sample, 0) >= %s THEN m.total_nurse_average ELSE NULL END,
      'totalNurseSampleSize', coalesce(m.total_nurse_sample, 0),
      'facilitiesWithPenalty', coalesce(m.facilities_with_penalty, 0),
      'totalFineAmount', m.total_fine_amount,
      'facilitiesWithOwnershipChange', coalesce(m.facilities_with_ownership_change, 0),
      'facilitiesWithRecentStateEnforcement', coalesce(m.facilities_with_recent_state, 0),
      'facilitiesWithRecentCmsPenalty', coalesce(m.facilities_with_recent_cms_penalty, 0),
      'facilitiesWithRecentHighValueEnforcement', coalesce(m.facilities_with_recent_high_value, 0),
      'facilitiesWithRecentComplaintInspection', coalesce(m.facilities_with_recent_complaint, 0),
      'historicalFacilityCount', p.historical_facility_count
    ) AS snapshot,
    (SELECT array_agg(release_id) FROM latest) AS derived_from_release_ids
  FROM prepared p
  LEFT JOIN metrics m ON m.organization_id = p.organization_id
)
INSERT INTO ownership_portfolio (
  organization_id, display_name, current_facility_count, historical_facility_count,
  uncertain_facility_count, state_count, states, relationship_roles, resolution_state,
  publication_eligible, indexable, snapshot, snapshot_fingerprint, derived_from_release_ids,
  derivation_version
)
SELECT
  organization_id,
  display_name,
  current_facility_count,
  historical_facility_count,
  uncertain_facility_count,
  state_count,
  states,
  relationship_roles,
  resolution_state,
  publication_eligible,
  indexable,
  snapshot,
  md5(%s || '|' || organization_id::text || '|' || snapshot::text || '|' || current_facility_count::text || '|' || historical_facility_count::text || '|' || resolution_state),
  coalesce(derived_from_release_ids, ARRAY[]::uuid[]),
  %s
FROM final
ON CONFLICT (organization_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  current_facility_count = EXCLUDED.current_facility_count,
  historical_facility_count = EXCLUDED.historical_facility_count,
  uncertain_facility_count = EXCLUDED.uncertain_facility_count,
  state_count = EXCLUDED.state_count,
  states = EXCLUDED.states,
  relationship_roles = EXCLUDED.relationship_roles,
  resolution_state = EXCLUDED.resolution_state,
  publication_eligible = EXCLUDED.publication_eligible,
  indexable = EXCLUDED.indexable,
  snapshot = EXCLUDED.snapshot,
  snapshot_fingerprint = EXCLUDED.snapshot_fingerprint,
  derived_from_release_ids = EXCLUDED.derived_from_release_ids,
  derivation_version = EXCLUDED.derivation_version,
  derived_at = now()
WHERE ownership_portfolio.snapshot_fingerprint IS DISTINCT FROM EXCLUDED.snapshot_fingerprint
RETURNING (xmax = 0) AS inserted
"""

DELETE_STALE_PORTFOLIOS_SQL = """
DELETE FROM ownership_portfolio p
WHERE p.derivation_version = %s
  AND NOT EXISTS (
    SELECT 1 FROM ownership_portfolio_member m
    WHERE m.organization_id = p.organization_id
  )
"""

SAFETY_SQL = """
SELECT
  (SELECT count(*) FROM facility_snapshot WHERE observed_at IS NOT NULL) AS snapshot_rows,
  (SELECT count(DISTINCT provider_id) FROM provider_identifier
    WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL) AS canonical_facilities,
  (SELECT count(DISTINCT identifier_value) FROM provider_identifier
    WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL) AS unique_ccns
"""

REPORT_SQL = """
SELECT jsonb_build_object(
  'verified_organizations',
    (SELECT count(*) FROM ownership_portfolio WHERE resolution_state = 'VERIFIED'),
  'review_required_organizations',
    (SELECT count(*) FROM ownership_portfolio WHERE resolution_state = 'REVIEW_REQUIRED'),
  'orgs_with_2_plus_current',
    (SELECT count(*) FROM ownership_portfolio WHERE current_facility_count >= 2),
  'orgs_with_3_plus_current',
    (SELECT count(*) FROM ownership_portfolio WHERE current_facility_count >= 3),
  'publication_eligible',
    (SELECT count(*) FROM ownership_portfolio WHERE publication_eligible),
  'indexable',
    (SELECT count(*) FROM ownership_portfolio WHERE indexable),
  'internal_or_noindex',
    (SELECT count(*) FROM ownership_portfolio WHERE NOT indexable),
  'facilities_with_published_org',
    (SELECT count(DISTINCT m.provider_id)
     FROM ownership_portfolio_member m
     JOIN ownership_portfolio p ON p.organization_id = m.organization_id
     WHERE p.publication_eligible AND m.membership_status = 'current'),
  'facilities_with_chain',
    (SELECT count(DISTINCT provider_id) FROM cms_chain_provider WHERE provider_id IS NOT NULL),
  'average_current_per_published',
    (SELECT round(avg(current_facility_count)::numeric, 1)
     FROM ownership_portfolio WHERE publication_eligible),
  'median_current_per_published',
    (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY current_facility_count)
     FROM ownership_portfolio WHERE publication_eligible)
)
"""


def _count_upsert(rows: list[tuple[Any, ...]]) -> tuple[int, int]:
    inserted = sum(1 for row in rows if row[0])
    updated = len(rows) - inserted
    return inserted, updated


def derive_ownership_portfolios(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        member_result = connection.execute(
            UPSERT_MEMBERS_SQL, (DERIVATION_VERSION, DERIVATION_VERSION)
        )
        members_inserted, members_updated = _count_upsert(member_result.fetchall())
        stale_members = connection.execute(DELETE_STALE_MEMBERS_SQL, (DERIVATION_VERSION,)).rowcount
        portfolio_result = connection.execute(
            UPSERT_PORTFOLIOS_SQL,
            (
                RECENT_MONTHS,
                RECENT_MONTHS,
                HIGH_VALUE_FINE_USD,
                RECENT_MONTHS,
                RECENT_MONTHS,
                DERIVATION_VERSION,
                DERIVATION_VERSION,
                DERIVATION_VERSION,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                PORTFOLIO_MIN_FACILITIES,
                DERIVATION_VERSION,
                DERIVATION_VERSION,
            ),
        )
        portfolios_inserted, portfolios_updated = _count_upsert(portfolio_result.fetchall())
        stale_portfolios = connection.execute(
            DELETE_STALE_PORTFOLIOS_SQL, (DERIVATION_VERSION,)
        ).rowcount
        safety = connection.execute(SAFETY_SQL).fetchone()
        report = connection.execute(REPORT_SQL).fetchone()
        connection.commit()
    return {
        "derivation_version": DERIVATION_VERSION,
        "members_inserted": members_inserted,
        "members_updated": members_updated,
        "members_deleted": stale_members if stale_members and stale_members > 0 else 0,
        "portfolios_inserted": portfolios_inserted,
        "portfolios_updated": portfolios_updated,
        "portfolios_deleted": stale_portfolios if stale_portfolios and stale_portfolios > 0 else 0,
        "canonical_facilities": safety[1] if safety else None,
        "unique_ccns": safety[2] if safety else None,
        "coverage": report[0] if report else {},
        "idempotent": True,
        "external_requests": 0,
    }


def derive_ownership_portfolios_json(database_url: str) -> str:
    return json.dumps(derive_ownership_portfolios(database_url), indent=2, sort_keys=True) + "\n"
