-- NJ-SEN-003 read-only reconciliation. Does not publish rows.

SELECT dataset_key, row_count, baseline_only, content_sha256, retrieved_at
FROM state_source_snapshot
WHERE dataset_key IN (
  'nj-doh-nh-staffing',
  'nj-medicaid-al-rate-schedule',
  'nj-pace-coverage'
)
ORDER BY retrieved_at DESC;

SELECT period_year, period_quarter, COUNT(*)
FROM state_facility_metric_observation
WHERE metric_family = 'nursing_home_staffing_ratio'
GROUP BY 1, 2
ORDER BY 1, 2;

SELECT COUNT(*) AS accidentally_public_metrics
FROM state_facility_metric_observation
WHERE public_eligible = true;

SELECT COUNT(*) AS invented_default_participation
FROM state_program_participation
WHERE is_default_unlisted_rate = true;

SELECT program_code, current_status, COUNT(*)
FROM state_program_organization
GROUP BY 1, 2;

SELECT coverage_type, operating_status, COUNT(*)
FROM state_program_service_area
GROUP BY 1, 2;
