BEGIN;

-- Additive freshness view. Not applied by this change.
-- Column order of the previous view is preserved. catalog_modified_at is appended.
-- CURRENT is withheld when a discovered catalog date is newer than the loaded release.
-- The 2026-10-19 floor is an observed CMS catalog modified date for the two SNF CHOW
-- datasets. A later cms_source_run.source_modified_at supersedes it.

CREATE OR REPLACE VIEW cms_source_freshness AS
SELECT
  d.dataset_key,
  d.display_name,
  d.official_url,
  p.cms_identifier,
  p.refresh_cadence,
  p.check_frequency,
  p.freshness_sla_days,
  sr.release_key AS current_release,
  sr.source_modified_at,
  sr.source_period,
  sr.retrieved_at,
  ir.completed_at AS last_success_at,
  ir.status AS last_ingest_status,
  CASE
    WHEN sr.source_modified_at IS NULL THEN 'UNKNOWN'
    WHEN upstream.catalog_modified_at IS NOT NULL
      AND upstream.catalog_modified_at::date > sr.source_modified_at::date
      AND sr.source_modified_at >= now() - make_interval(days => p.freshness_sla_days)
      THEN 'AGING'
    WHEN sr.source_modified_at >= now() - make_interval(days => p.freshness_sla_days)
      THEN 'CURRENT'
    WHEN sr.source_modified_at >= now() - make_interval(days => p.freshness_sla_days * 2)
      THEN 'AGING'
    ELSE 'STALE'
  END AS freshness_band,
  CASE
    WHEN sr.source_modified_at IS NULL THEN NULL
    ELSE round(extract(epoch FROM (now() - sr.source_modified_at)) / 86400.0, 1)
  END AS age_days,
  (
    SELECT csr.status
    FROM cms_source_run csr
    WHERE csr.dataset_key = d.dataset_key
    ORDER BY csr.started_at DESC
    LIMIT 1
  ) AS last_source_run_status,
  (
    SELECT csr.completed_at
    FROM cms_source_run csr
    WHERE csr.dataset_key = d.dataset_key AND csr.status = 'FAILED'
    ORDER BY csr.started_at DESC
    LIMIT 1
  ) AS last_failure_at,
  (
    SELECT csr.status
    FROM cms_source_run csr
    WHERE csr.dataset_key = d.dataset_key AND csr.status IN ('COMPLETE', 'NO_CHANGE')
    ORDER BY csr.started_at DESC
    LIMIT 1
  ) AS last_healthy_status,
  upstream.catalog_modified_at
FROM source_dataset d
LEFT JOIN cms_refresh_source_policy p ON p.dataset_key = d.dataset_key
LEFT JOIN LATERAL (
  SELECT r.*
  FROM source_release r
  JOIN ingest_run irun ON irun.source_release_id = r.id AND irun.status = 'succeeded'
  WHERE r.source_dataset_id = d.id
  ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
  LIMIT 1
) sr ON true
LEFT JOIN LATERAL (
  SELECT irun.status, irun.completed_at
  FROM ingest_run irun
  WHERE irun.source_release_id = sr.id AND irun.status = 'succeeded'
  ORDER BY irun.completed_at DESC
  LIMIT 1
) ir ON true
LEFT JOIN LATERAL (
  SELECT GREATEST(
    CASE d.dataset_key
      WHEN 'skilled-nursing-facility-change-of-ownership' THEN timestamptz '2026-10-19 00:00:00+00'
      WHEN 'skilled-nursing-facility-change-of-ownership-owner-information' THEN timestamptz '2026-10-19 00:00:00+00'
      ELSE NULL
    END,
    (
      SELECT max(csr.source_modified_at)
      FROM cms_source_run csr
      WHERE csr.dataset_key = d.dataset_key
        AND csr.source_modified_at IS NOT NULL
    )
  ) AS catalog_modified_at
) upstream ON true
WHERE p.dataset_key IS NOT NULL;

COMMENT ON VIEW cms_source_freshness IS
  'Per-source freshness. CURRENT is withheld when the catalog release is newer than the loaded release.';

COMMIT;
