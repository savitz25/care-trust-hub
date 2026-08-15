BEGIN;

ALTER TABLE source_release
  ADD COLUMN source_version_identifier text,
  ADD CONSTRAINT source_release_version_identifier_present
    CHECK (source_version_identifier IS NULL OR btrim(source_version_identifier) <> '');

CREATE TABLE pbj_staffing_day (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  daily_key text NOT NULL CHECK (daily_key ~ '^[0-9a-f]{64}$'),
  source_quarter text NOT NULL CHECK (source_quarter ~ '^20[0-9]{2}Q[1-4]$'),
  work_date date NOT NULL,
  resident_census integer CHECK (resident_census IS NULL OR resident_census >= 0),
  hrs_rndon numeric(10,2),
  hrs_rndon_emp numeric(10,2),
  hrs_rndon_ctr numeric(10,2),
  hrs_rnadmin numeric(10,2),
  hrs_rnadmin_emp numeric(10,2),
  hrs_rnadmin_ctr numeric(10,2),
  hrs_rn numeric(10,2),
  hrs_rn_emp numeric(10,2),
  hrs_rn_ctr numeric(10,2),
  hrs_lpnadmin numeric(10,2),
  hrs_lpnadmin_emp numeric(10,2),
  hrs_lpnadmin_ctr numeric(10,2),
  hrs_lpn numeric(10,2),
  hrs_lpn_emp numeric(10,2),
  hrs_lpn_ctr numeric(10,2),
  hrs_cna numeric(10,2),
  hrs_cna_emp numeric(10,2),
  hrs_cna_ctr numeric(10,2),
  hrs_natrn numeric(10,2),
  hrs_natrn_emp numeric(10,2),
  hrs_natrn_ctr numeric(10,2),
  hrs_medaide numeric(10,2),
  hrs_medaide_emp numeric(10,2),
  hrs_medaide_ctr numeric(10,2),
  source_record_locator text NOT NULL CHECK (btrim(source_record_locator) <> ''),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL CHECK (btrim(transformation_version) <> ''),
  UNIQUE (source_release_id, ccn, work_date),
  UNIQUE (source_release_id, daily_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (
    hrs_rndon >= 0 AND hrs_rndon_emp >= 0 AND hrs_rndon_ctr >= 0
    AND hrs_rnadmin >= 0 AND hrs_rnadmin_emp >= 0 AND hrs_rnadmin_ctr >= 0
    AND hrs_rn >= 0 AND hrs_rn_emp >= 0 AND hrs_rn_ctr >= 0
    AND hrs_lpnadmin >= 0 AND hrs_lpnadmin_emp >= 0 AND hrs_lpnadmin_ctr >= 0
    AND hrs_lpn >= 0 AND hrs_lpn_emp >= 0 AND hrs_lpn_ctr >= 0
    AND hrs_cna >= 0 AND hrs_cna_emp >= 0 AND hrs_cna_ctr >= 0
    AND hrs_natrn >= 0 AND hrs_natrn_emp >= 0 AND hrs_natrn_ctr >= 0
    AND hrs_medaide >= 0 AND hrs_medaide_emp >= 0 AND hrs_medaide_ctr >= 0
  )
);

CREATE TABLE pbj_staffing_quarter_summary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  source_quarter text NOT NULL CHECK (source_quarter ~ '^20[0-9]{2}Q[1-4]$'),
  coverage_start date NOT NULL,
  coverage_end date NOT NULL,
  days_represented integer NOT NULL CHECK (days_represented > 0),
  positive_census_days integer NOT NULL CHECK (positive_census_days >= 0),
  zero_census_days integer NOT NULL CHECK (zero_census_days >= 0),
  missing_census_days integer NOT NULL CHECK (missing_census_days >= 0),
  census_sum bigint NOT NULL CHECK (census_sum >= 0),
  total_nurse_hours numeric(14,2),
  rn_hours numeric(14,2),
  lpn_hours numeric(14,2),
  cna_hours numeric(14,2),
  employee_nurse_hours numeric(14,2),
  contract_nurse_hours numeric(14,2),
  total_nurse_hprd numeric(12,6),
  rn_hprd numeric(12,6),
  lpn_hprd numeric(12,6),
  cna_hprd numeric(12,6),
  weekday_total_nurse_hprd numeric(12,6),
  weekend_total_nurse_hprd numeric(12,6),
  weekday_rn_hprd numeric(12,6),
  weekend_rn_hprd numeric(12,6),
  contract_nurse_share numeric(12,8),
  zero_reported_rn_days integer NOT NULL CHECK (zero_reported_rn_days >= 0),
  formula_version text NOT NULL CHECK (btrim(formula_version) <> ''),
  source_record_locator text NOT NULL CHECK (btrim(source_record_locator) <> ''),
  transformation_version text NOT NULL CHECK (btrim(transformation_version) <> ''),
  UNIQUE (source_release_id, ccn),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (coverage_end >= coverage_start),
  CHECK (positive_census_days + zero_census_days + missing_census_days = days_represented),
  CHECK (contract_nurse_share IS NULL OR contract_nurse_share BETWEEN 0 AND 1)
);

CREATE UNLOGGED TABLE pbj_staffing_load_stage (
  load_key text NOT NULL,
  ordinal bigint NOT NULL CHECK (ordinal > 0),
  ccn text NOT NULL,
  locator text NOT NULL,
  normalized jsonb NOT NULL CHECK (jsonb_typeof(normalized) = 'object'),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  PRIMARY KEY (load_key, ordinal)
);

CREATE INDEX pbj_staffing_day_provider_date_idx
  ON pbj_staffing_day(provider_id, work_date DESC) WHERE provider_id IS NOT NULL;
CREATE INDEX pbj_staffing_day_ccn_quarter_date_idx
  ON pbj_staffing_day(ccn, source_quarter, work_date);
CREATE INDEX pbj_staffing_summary_provider_quarter_idx
  ON pbj_staffing_quarter_summary(provider_id, source_quarter DESC)
  WHERE provider_id IS NOT NULL;
CREATE INDEX pbj_staffing_summary_ccn_quarter_idx
  ON pbj_staffing_quarter_summary(ccn, source_quarter DESC);
CREATE INDEX pbj_staffing_load_stage_key_ccn_idx
  ON pbj_staffing_load_stage(load_key, ccn);

COMMIT;
