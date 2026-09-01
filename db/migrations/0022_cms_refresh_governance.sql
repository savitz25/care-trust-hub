BEGIN;

-- SEN-NAT-005: parent refresh runs, per-source runs, source policy, lock companion,
-- and a per-source freshness view. Additive. Does not rewrite CMS evidence.

CREATE TABLE cms_refresh_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mode text NOT NULL CHECK (mode IN ('check', 'refresh', 'dry_run')),
  status text NOT NULL CHECK (status IN (
    'RUNNING', 'HEALTHY', 'DEGRADED', 'STALE', 'FAILED'
  )),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  trigger text NOT NULL DEFAULT 'manual',
  writes_enabled boolean NOT NULL DEFAULT false,
  artifact jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE cms_source_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refresh_run_id uuid NOT NULL REFERENCES cms_refresh_run(id),
  dataset_key text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'DISCOVERED',
    'NO_CHANGE',
    'FETCHED',
    'VALIDATED',
    'INGESTING',
    'DATA_LOADED_DERIVE_FAILED',
    'COMPLETE',
    'FAILED',
    'QUARANTINED',
    'ALREADY_RUNNING',
    'SKIPPED_DEPENDENCY'
  )),
  failure_class text CHECK (failure_class IS NULL OR failure_class IN (
    'TRANSIENT', 'VALIDATION', 'CAPACITY', 'LOCK', 'DEPENDENCY', 'UNKNOWN'
  )),
  source_modified_at timestamptz,
  retrieved_at timestamptz,
  checksum text CHECK (checksum IS NULL OR checksum ~ '^[0-9a-f]{64}$'),
  source_release_id uuid REFERENCES source_release(id),
  previous_release_id uuid REFERENCES source_release(id),
  record_count bigint,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  error text,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cms_refresh_run_started_idx ON cms_refresh_run(started_at DESC);
CREATE INDEX cms_source_run_refresh_idx ON cms_source_run(refresh_run_id, dataset_key);
CREATE INDEX cms_source_run_dataset_idx ON cms_source_run(dataset_key, started_at DESC);
CREATE UNIQUE INDEX cms_source_run_active_lock
  ON cms_source_run(dataset_key)
  WHERE status IN ('FETCHED', 'VALIDATED', 'INGESTING');

CREATE TABLE cms_refresh_source_policy (
  dataset_key text PRIMARY KEY,
  cms_identifier text NOT NULL,
  refresh_cadence text NOT NULL,
  check_frequency text NOT NULL,
  freshness_sla_days integer NOT NULL CHECK (freshness_sla_days > 0),
  min_row_count bigint NOT NULL CHECK (min_row_count >= 0),
  max_drop_ratio numeric NOT NULL CHECK (max_drop_ratio > 0 AND max_drop_ratio < 1),
  depends_on text[] NOT NULL DEFAULT '{}'::text[],
  pause_dependents_on_failure boolean NOT NULL DEFAULT false
);

INSERT INTO cms_refresh_source_policy (
  dataset_key, cms_identifier, refresh_cadence, check_frequency,
  freshness_sla_days, min_row_count, max_drop_ratio, depends_on,
  pause_dependents_on_failure
) VALUES
  ('nursing-home-provider-information', '4pq5-n9py', 'MONTHLY', 'DAILY',
   45, 10000, 0.25, '{}', true),
  ('nursing-home-inspection-dates', 'svdt-c123', 'MONTHLY', 'DAILY',
   45, 50000, 0.4, '{}', true),
  ('nursing-home-health-deficiencies', 'r5ix-sfxw', 'MONTHLY', 'DAILY',
   45, 100000, 0.4, '{nursing-home-inspection-dates}', false),
  ('nursing-home-fire-safety-deficiencies', 'ifjz-ge4w', 'MONTHLY', 'DAILY',
   45, 20000, 0.5, '{nursing-home-inspection-dates}', false),
  ('nursing-home-penalties', 'g6vv-u9sr', 'MONTHLY', 'DAILY',
   45, 1000, 0.5, '{}', false),
  ('payroll-based-journal-daily-nurse-staffing', '7e0d53ba-8f02-4c66-98a5-14a1c997c50d',
   'QUARTERLY', 'WEEKLY', 120, 500000, 0.4, '{}', false),
  ('nursing-home-ownership', 'y2hd-n93e', 'MONTHLY', 'DAILY',
   45, 50000, 0.4, '{}', false),
  ('skilled-nursing-facility-all-owners', 'afe44b85-cc6d-40d7-b5df-00ae8910d1d2',
   'MONTHLY', 'DAILY', 45, 50000, 0.4, '{}', false),
  ('skilled-nursing-facility-enrollments', '5f2c306f-3b1c-42cd-b037-187b2ce22126',
   'MONTHLY', 'DAILY', 45, 10000, 0.25, '{}', true),
  ('skilled-nursing-facility-change-of-ownership', 'f557a6ed-95b3-4a22-8433-4175db2dec1c',
   'QUARTERLY', 'WEEKLY', 120, 1000, 0.5, '{}', true),
  ('skilled-nursing-facility-change-of-ownership-owner-information',
   'a4358712-e910-4eaf-8f24-5e90ba3cf8d0', 'QUARTERLY', 'WEEKLY', 120, 10000, 0.5,
   '{skilled-nursing-facility-change-of-ownership}', false),
  ('nursing-home-chain-performance-measures', '97ecfad1-d3f1-4d42-b774-d74661d830bc',
   'MONTHLY', 'DAILY', 45, 100, 0.5, '{}', false),
  ('nursing-home-mds-quality-measures', 'djen-97ju', 'MONTHLY', 'DAILY',
   45, 50000, 0.4, '{}', false);

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
  ) AS last_healthy_status
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
WHERE p.dataset_key IS NOT NULL;

COMMENT ON TABLE cms_refresh_run IS
  'SEN-NAT-005 parent CMS refresh cycle. Failed child runs remain auditable.';
COMMENT ON TABLE cms_source_run IS
  'SEN-NAT-005 per-source refresh attempt. Later COMPLETE supersedes earlier FAILED.';
COMMENT ON TABLE cms_refresh_source_policy IS
  'Per-source cadence, SLA, and fail-closed thresholds. Not a global last-updated clock.';
COMMENT ON VIEW cms_source_freshness IS
  'Per-source freshness. Not a global last-updated timestamp.';
COMMENT ON INDEX cms_source_run_active_lock IS
  'Prevents overlapping FETCHED/VALIDATED/INGESTING runs for the same dataset_key.';

COMMIT;
