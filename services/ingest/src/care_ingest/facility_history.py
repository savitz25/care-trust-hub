"""Idempotent national derivation of facility-history events."""

# SQL event inserts are kept as readable set-based statements.
# ruff: noqa: E501

from __future__ import annotations

import json
from typing import Any

import psycopg

DERIVATION_VERSION = "facility-history-v1"

INSPECTION_SQL = """
INSERT INTO facility_history_event (
  provider_id, event_type, event_family, event_date, date_precision, date_basis,
  importance, title, summary, previous_value, new_value, evidence_href,
  source_dataset_key, source_release_id, source_record_locator, source_event_key,
  fingerprint, derivation_version, publication_eligible, payload
)
SELECT
  i.provider_id,
  'INSPECTION_COMPLETED',
  'inspection',
  i.survey_date,
  'day',
  'occurred',
  CASE WHEN agg.highest_code ~ '[G-L]' THEN 'HIGH' ELSE 'MEDIUM' END,
  CASE
    WHEN lower(i.survey_type) LIKE '%%fire%%' AND lower(i.survey_type) LIKE '%%complaint%%'
      THEN 'Fire-safety complaint inspection recorded'
    WHEN lower(i.survey_type) LIKE '%%complaint%%' THEN 'Complaint inspection recorded'
    WHEN lower(i.survey_type) LIKE '%%infection%%' THEN 'Infection-control inspection recorded'
    ELSE 'Health inspection completed'
  END,
  CASE
    WHEN agg.deficiency_count = 0
      THEN 'No linked health-deficiency findings were recorded for this survey.'
    WHEN agg.higher_severity_count > 0
      THEN agg.deficiency_count::text || ' deficiencies were recorded. That includes '
        || agg.higher_severity_count::text || ' higher-severity '
        || CASE WHEN agg.higher_severity_count = 1 THEN 'deficiency.' ELSE 'deficiencies.' END
    ELSE agg.deficiency_count::text || CASE WHEN agg.deficiency_count = 1
      THEN ' deficiency was recorded.' ELSE ' deficiencies were recorded.' END
  END,
  NULL,
  NULL,
  '#inspections',
  'nursing-home-inspection-dates',
  i.source_release_id,
  i.source_record_locator,
  'inspection:' || i.id::text,
  %s || '|INSPECTION_COMPLETED|' || i.id::text,
  %s,
  true,
  jsonb_build_object(
    'surveyType', i.survey_type,
    'deficiencyCount', agg.deficiency_count,
    'higherSeverityCount', agg.higher_severity_count
  )
FROM inspection_event i
JOIN (
  SELECT ie.id,
    count(df.id) AS deficiency_count,
    count(df.id) FILTER (WHERE df.scope_severity_code ~ '[G-L]') AS higher_severity_count,
    max(df.scope_severity_code) FILTER (WHERE df.scope_severity_code ~ '[G-L]') AS highest_code
  FROM inspection_event ie
  LEFT JOIN deficiency_finding df ON df.inspection_event_id = ie.id
  GROUP BY ie.id
) agg ON agg.id = i.id
WHERE (
  lower(i.survey_type) LIKE '%%health%%'
  OR lower(i.survey_type) LIKE '%%complaint%%'
  OR lower(i.survey_type) LIKE '%%infection%%'
)
AND lower(i.survey_type) <> 'fire safety standard'
ON CONFLICT (fingerprint) DO NOTHING
"""

PENALTY_SQL = """
INSERT INTO facility_history_event (
  provider_id, event_type, event_family, event_date, date_precision, date_basis,
  importance, title, summary, previous_value, new_value, evidence_href,
  source_dataset_key, source_release_id, source_record_locator, source_event_key,
  fingerprint, derivation_version, publication_eligible, payload
)
SELECT
  p.provider_id,
  'PENALTY_RECORDED',
  'enforcement',
  p.penalty_date,
  'day',
  'occurred',
  CASE
    WHEN p.penalty_type = 'Payment Denial' THEN 'HIGH'
    WHEN coalesce(p.fine_amount, 0) >= 10000 THEN 'HIGH'
    ELSE 'MEDIUM'
  END,
  CASE WHEN p.penalty_type = 'Fine'
    THEN 'Civil monetary penalty recorded'
    ELSE 'Medicare payment denial recorded'
  END,
  CASE
    WHEN p.penalty_type = 'Fine'
      THEN 'CMS recorded a ' || to_char(p.fine_amount, 'FM"$"999,999,999,990') || ' civil monetary penalty.'
    WHEN p.payment_denial_days IS NULL
      THEN 'CMS recorded a Medicare payment-denial action.'
    ELSE 'CMS recorded a Medicare payment denial lasting ' || p.payment_denial_days::text
      || CASE WHEN p.payment_denial_days = 1 THEN ' day.' ELSE ' days.' END
  END,
  NULL,
  CASE WHEN p.penalty_type = 'Fine' THEN p.fine_amount::text ELSE p.payment_denial_days::text END,
  '#penalties',
  'nursing-home-penalties',
  p.source_release_id,
  p.source_record_locator,
  'penalty:' || p.id::text,
  %s || '|PENALTY_RECORDED|' || p.id::text,
  %s,
  true,
  jsonb_build_object('penaltyType', p.penalty_type)
FROM penalty_enforcement p
ON CONFLICT (fingerprint) DO NOTHING
"""

OWNERSHIP_SQL = """
INSERT INTO facility_history_event (
  provider_id, event_type, event_family, event_date, date_precision, date_basis,
  importance, title, summary, previous_value, new_value, evidence_href,
  source_dataset_key, source_release_id, source_record_locator, source_event_key,
  fingerprint, derivation_version, publication_eligible, payload
)
SELECT
  grouped.provider_id,
  'OWNERSHIP_CHANGED',
  'ownership',
  grouped.effective_date,
  'day',
  'occurred',
  'HIGH',
  'Ownership change recorded',
  CASE
    WHEN grouped.buyer_name ~* '(llc|inc|corp|ltd|lp|llp|hospital|health|county|city|district|authority|services|care|center|homes|rehab|nursing)'
      AND grouped.buyer_name !~ '@'
      THEN 'An ownership change was recorded. New organization: ' || grouped.buyer_name || '.'
    ELSE 'CMS recorded a change of ownership.'
  END,
  grouped.seller_name,
  grouped.buyer_name,
  '#ownership',
  'skilled-nursing-facility-enrollments',
  grouped.source_release_id,
  grouped.source_record_locator,
  'ownership:' || grouped.provider_id::text || ':' || grouped.effective_date::text || ':' || grouped.change_type_text,
  %s || '|OWNERSHIP_CHANGED|' || grouped.provider_id::text || '|' || grouped.effective_date::text || '|' || grouped.change_type_text,
  %s,
  true,
  jsonb_build_object('changeType', grouped.change_type_text)
FROM (
  SELECT DISTINCT ON (e.provider_id, e.effective_date, e.change_type_text)
    e.provider_id, e.effective_date, e.change_type_text, e.source_release_id,
    e.source_record_locator,
    nullif(e.raw_record->>'ORGANIZATION NAME - BUYER', '') AS buyer_name,
    nullif(e.raw_record->>'ORGANIZATION NAME - SELLER', '') AS seller_name
  FROM ownership_change_event e
  WHERE e.provider_id IS NOT NULL
  ORDER BY e.provider_id, e.effective_date, e.change_type_text, e.id
) grouped
ON CONFLICT (fingerprint) DO NOTHING
"""

STAFFING_SQL = """
INSERT INTO facility_history_event (
  provider_id, event_type, event_family, event_date, date_precision, date_basis,
  importance, title, summary, previous_value, new_value, evidence_href,
  source_dataset_key, source_release_id, source_record_locator, source_event_key,
  fingerprint, derivation_version, publication_eligible, payload
)
SELECT
  newer.provider_id,
  pair.event_type,
  'staffing',
  newer.coverage_end,
  'quarter',
  'reported_in_release',
  'MEDIUM',
  pair.title,
  pair.summary,
  pair.previous_value,
  pair.new_value,
  '#staffing',
  'pbj-daily-nurse-staffing',
  newer.source_release_id,
  newer.source_record_locator,
  pair.source_event_key,
  %s || '|' || pair.event_type || '|' || newer.provider_id::text || '|' || older.source_quarter || '|' || newer.source_quarter,
  %s,
  true,
  jsonb_build_object('fromQuarter', older.source_quarter, 'toQuarter', newer.source_quarter)
FROM pbj_staffing_quarter_summary newer
JOIN pbj_staffing_quarter_summary older
  ON older.provider_id = newer.provider_id
 AND older.source_quarter = CASE
      WHEN right(newer.source_quarter, 1) = '1' THEN (left(newer.source_quarter, 4)::int - 1)::text || 'Q4'
      ELSE left(newer.source_quarter, 4) || 'Q' || (right(newer.source_quarter, 1)::int - 1)::text
    END
CROSS JOIN LATERAL (
  SELECT * FROM (VALUES
    (
      'STAFFING_RN_CHANGED',
      older.rn_hprd,
      newer.rn_hprd,
      'RN staffing ' || CASE WHEN newer.rn_hprd > older.rn_hprd THEN 'increased' ELSE 'decreased' END,
      'RN staffing ' || CASE WHEN newer.rn_hprd > older.rn_hprd THEN 'increased' ELSE 'decreased' END
        || ' from ' || to_char(older.rn_hprd, 'FM990.00') || ' to ' || to_char(newer.rn_hprd, 'FM990.00')
        || ' hours per resident day between ' || older.source_quarter || ' and ' || newer.source_quarter
        || '. Staffing ' || CASE WHEN newer.rn_hprd > older.rn_hprd THEN 'improved' ELSE 'declined' END
        || ' across those reported periods.',
      to_char(older.rn_hprd, 'FM990.00'),
      to_char(newer.rn_hprd, 'FM990.00'),
      'staffing:rn:' || older.source_quarter || ':' || newer.source_quarter
    ),
    (
      'STAFFING_TOTAL_CHANGED',
      older.total_nurse_hprd,
      newer.total_nurse_hprd,
      'Total nurse staffing ' || CASE WHEN newer.total_nurse_hprd > older.total_nurse_hprd THEN 'increased' ELSE 'decreased' END,
      'Total nurse staffing ' || CASE WHEN newer.total_nurse_hprd > older.total_nurse_hprd THEN 'increased' ELSE 'decreased' END
        || ' from ' || to_char(older.total_nurse_hprd, 'FM990.00') || ' to ' || to_char(newer.total_nurse_hprd, 'FM990.00')
        || ' hours per resident day between ' || older.source_quarter || ' and ' || newer.source_quarter
        || '. Staffing ' || CASE WHEN newer.total_nurse_hprd > older.total_nurse_hprd THEN 'improved' ELSE 'declined' END
        || ' across those reported periods.',
      to_char(older.total_nurse_hprd, 'FM990.00'),
      to_char(newer.total_nurse_hprd, 'FM990.00'),
      'staffing:total:' || older.source_quarter || ':' || newer.source_quarter
    )
  ) AS measures(event_type, previous_hprd, next_hprd, title, summary, previous_value, new_value, source_event_key)
) pair
WHERE newer.provider_id IS NOT NULL
  AND pair.previous_hprd IS NOT NULL
  AND pair.next_hprd IS NOT NULL
  AND pair.previous_hprd <> pair.next_hprd
  AND (
    abs(pair.next_hprd - pair.previous_hprd) >= 0.2
    OR (
      pair.previous_hprd <> 0
      AND abs(pair.next_hprd - pair.previous_hprd) >= 0.1
      AND abs(pair.next_hprd - pair.previous_hprd) / abs(pair.previous_hprd) >= 0.1
    )
  )
ON CONFLICT (fingerprint) DO NOTHING
"""

RATING_SQL = """
INSERT INTO facility_history_event (
  provider_id, event_type, event_family, event_date, date_precision, date_basis,
  importance, title, summary, previous_value, new_value, evidence_href,
  source_dataset_key, source_release_id, source_record_locator, source_event_key,
  fingerprint, derivation_version, publication_eligible, payload
)
SELECT
  newer.provider_id,
  pair.event_type,
  'rating',
  coalesce(nsr.source_release_date, nsr.source_modified_at::date, newer.retrieved_at::date),
  'release',
  'reported_in_release',
  CASE WHEN pair.next_rating < pair.prev_rating AND (pair.prev_rating - pair.next_rating) >= 2
    THEN 'HIGH' ELSE 'MEDIUM' END,
  pair.title,
  pair.title || ' from ' || pair.prev_rating::text || '★ to ' || pair.next_rating::text
    || '★. The rating ' || CASE WHEN pair.next_rating > pair.prev_rating THEN 'increased.' ELSE 'declined.' END,
  pair.prev_rating::text,
  pair.next_rating::text,
  '#overview',
  'nursing-home-provider-information',
  newer.source_release_id,
  newer.source_record_locator,
  pair.source_event_key,
  %s || '|' || pair.event_type || '|' || newer.provider_id::text || '|' || older.source_release_id::text || '|' || newer.source_release_id::text,
  %s,
  true,
  jsonb_build_object('fromRelease', osr.release_key, 'toRelease', nsr.release_key)
FROM facility_snapshot newer
JOIN facility_snapshot older
  ON older.provider_id = newer.provider_id
 AND older.source_release_id <> newer.source_release_id
JOIN source_release nsr ON nsr.id = newer.source_release_id
JOIN source_release osr ON osr.id = older.source_release_id
JOIN LATERAL (
  SELECT * FROM (VALUES
    ('OVERALL_RATING_CHANGED', older.overall_rating, newer.overall_rating, 'Overall CMS rating changed', 'rating:overall'),
    ('HEALTH_INSPECTION_RATING_CHANGED', older.health_inspection_rating, newer.health_inspection_rating, 'Health inspection rating changed', 'rating:health'),
    ('STAFFING_RATING_CHANGED', older.staffing_rating, newer.staffing_rating, 'Staffing rating changed', 'rating:staffing'),
    ('QUALITY_MEASURE_RATING_CHANGED', older.quality_measure_rating, newer.quality_measure_rating, 'Quality-measure rating changed', 'rating:quality')
  ) AS ratings(event_type, prev_rating, next_rating, title, source_event_key)
) pair ON true
WHERE older.created_at < newer.created_at
  AND NOT EXISTS (
    SELECT 1 FROM facility_snapshot mid
    WHERE mid.provider_id = newer.provider_id
      AND mid.created_at > older.created_at
      AND mid.created_at < newer.created_at
  )
  AND pair.prev_rating BETWEEN 1 AND 5
  AND pair.next_rating BETWEEN 1 AND 5
  AND pair.prev_rating <> pair.next_rating
ON CONFLICT (fingerprint) DO NOTHING
"""


def derive_facility_history(database_url: str) -> dict[str, Any]:
    with psycopg.connect(database_url) as connection:
        inserted = {}
        for name, sql in (
            ("inspection", INSPECTION_SQL),
            ("enforcement", PENALTY_SQL),
            ("ownership", OWNERSHIP_SQL),
            ("staffing", STAFFING_SQL),
            ("rating", RATING_SQL),
        ):
            result = connection.execute(sql, (DERIVATION_VERSION, DERIVATION_VERSION))
            inserted[name] = (
                result.rowcount if result.rowcount is not None and result.rowcount >= 0 else 0
            )
        counts = {
            row[0]: row[1]
            for row in connection.execute(
                """
                SELECT event_family, count(*)
                FROM facility_history_event
                WHERE derivation_version = %s
                GROUP BY 1
                """,
                (DERIVATION_VERSION,),
            )
        }
        facilities = connection.execute(
            """
            SELECT count(DISTINCT provider_id)
            FROM facility_history_event
            WHERE derivation_version = %s
            """,
            (DERIVATION_VERSION,),
        ).fetchone()
        cms = connection.execute(
            """
            SELECT count(*) FROM (
              SELECT DISTINCT identifier_value
              FROM provider_identifier
              WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL
            ) t
            """
        ).fetchone()
        google = connection.execute(
            """
            SELECT count(*) FROM facility_claim
            WHERE claim_type LIKE 'google_%%' AND effective_to IS NULL
            """
        ).fetchone()
        state = connection.execute(
            """
            SELECT count(*) FROM facility_claim
            WHERE claim_type LIKE 'STATE_%%' AND effective_to IS NULL
            """
        ).fetchone()
        connection.commit()
    return {
        "derivation_version": DERIVATION_VERSION,
        "inserted": inserted,
        "event_counts": counts,
        "facilities_with_history": facilities[0] if facilities else 0,
        "cms_unique_ccns": cms[0] if cms else 0,
        "google_claims": google[0] if google else 0,
        "state_claims": state[0] if state else 0,
        "idempotent": True,
    }


def derive_facility_history_json(database_url: str) -> str:
    return json.dumps(derive_facility_history(database_url), indent=2, sort_keys=True) + "\n"
