-- NJ-SEN-004 read-only reconciliation. Does not publish rows.

SELECT dataset_key, row_count, baseline_only, content_sha256, retrieved_at
FROM state_source_snapshot
WHERE dataset_key IN (
  'nj-doh-all-ltc',
  'nj-doh-all-acute',
  'nj-doh-penalty-letters',
  'nj-doh-nh-staffing',
  'nj-medicaid-al-rate-schedule',
  'nj-pace-coverage'
)
ORDER BY retrieved_at DESC;

SELECT dataset_key, official_facility_type_canonical, COUNT(*)
FROM state_facility_identity
WHERE state_code = 'NJ'
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT COUNT(*) AS accidentally_public_identities
FROM state_facility_identity
WHERE public_eligible = true;

SELECT coverage_type, COUNT(*)
FROM state_facility_service_area
GROUP BY 1;

SELECT match_bucket, COUNT(*)
FROM state_facility_match_ledger
GROUP BY 1;

SELECT corpus_scope, COUNT(*)
FROM state_facility_document
GROUP BY 1;

SELECT coverage_state, source_family
FROM state_source_coverage
WHERE state_code = 'NJ'
ORDER BY source_family;

SELECT COUNT(*) AS ccrc_providers
FROM state_regulated_organization
WHERE program_code = 'NJ_CCRC';

SELECT COUNT(*) AS nj_public_routes_must_be_zero
FROM state_facility_identity
WHERE public_eligible = true
   OR publication_state = 'PUBLISHABLE_CURRENT';
