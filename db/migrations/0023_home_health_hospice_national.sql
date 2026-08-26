BEGIN;

-- SEN-NAT-003: typed Home Health and Hospice national spines.
-- Additive. Does not rewrite nursing-home CCNs, snapshots, or evidence.

ALTER TABLE provider
  ADD CONSTRAINT provider_type_known CHECK (provider_type IN (
    'nursing_home', 'home_health', 'hospice', 'assisted_living'
  ));

CREATE TABLE home_health_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  cms_ccn text NOT NULL CHECK (cms_ccn ~ '^[A-Z0-9]{6}$'),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  provider_name text NOT NULL,
  address text,
  city text,
  state_code text NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  zip_code text,
  telephone text,
  ownership_type text,
  certification_date date,
  quality_of_patient_care_star smallint CHECK (
    quality_of_patient_care_star IS NULL OR quality_of_patient_care_star BETWEEN 1 AND 5
  ),
  quality_of_patient_care_star_footnote text,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, cms_ccn),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (btrim(provider_name) <> '')
);

CREATE TABLE hospice_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  cms_ccn text NOT NULL CHECK (cms_ccn ~ '^[A-Z0-9]{6}$'),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  provider_name text NOT NULL,
  address_line_1 text,
  address_line_2 text,
  city text,
  state_code text NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  zip_code text,
  county_name text,
  telephone text,
  cms_region text,
  ownership_type text,
  certification_date date,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, cms_ccn),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (btrim(provider_name) <> '')
);

CREATE TABLE cms_agency_quality_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  cms_ccn text NOT NULL CHECK (cms_ccn ~ '^[A-Z0-9]{6}$'),
  provider_type text NOT NULL CHECK (provider_type IN ('home_health', 'hospice')),
  measure_family text NOT NULL CHECK (measure_family IN (
    'hh_quality', 'hh_hhcahps', 'hospice_quality', 'hospice_cahps'
  )),
  measure_code text NOT NULL,
  official_name text NOT NULL,
  reporting_period text,
  score numeric,
  score_text text,
  star_rating smallint CHECK (star_rating IS NULL OR star_rating BETWEEN 1 AND 5),
  availability text NOT NULL CHECK (availability IN (
    'REPORTED', 'SUPPRESSED', 'NOT_AVAILABLE', 'INSUFFICIENT_DATA'
  )),
  footnote text,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE NULLS NOT DISTINCT (
    source_release_id, cms_ccn, measure_family, measure_code, reporting_period
  ),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (btrim(official_name) <> '')
);

CREATE TABLE cms_agency_service_offering (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  cms_ccn text NOT NULL CHECK (cms_ccn ~ '^[A-Z0-9]{6}$'),
  provider_type text NOT NULL CHECK (provider_type IN ('home_health', 'hospice')),
  service_code text NOT NULL,
  official_field text NOT NULL,
  offered boolean,
  raw_value text,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_record_locator text NOT NULL,
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, cms_ccn, service_code)
);

CREATE TABLE cms_agency_service_zip (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  cms_ccn text NOT NULL CHECK (cms_ccn ~ '^[A-Z0-9]{6}$'),
  provider_type text NOT NULL CHECK (provider_type IN ('home_health', 'hospice')),
  state_code text CHECK (state_code IS NULL OR state_code ~ '^[A-Z]{2}$'),
  zip_code text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_record_locator text NOT NULL,
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, cms_ccn, zip_code),
  CHECK (btrim(zip_code) <> '')
);

CREATE INDEX home_health_snapshot_state_idx ON home_health_snapshot(state_code);
CREATE INDEX hospice_snapshot_state_idx ON hospice_snapshot(state_code);
CREATE INDEX cms_agency_quality_ccn_idx ON cms_agency_quality_observation(cms_ccn, measure_family);
CREATE INDEX cms_agency_service_zip_zip_idx ON cms_agency_service_zip(zip_code, provider_type);

COMMENT ON TABLE home_health_snapshot IS
  'CMS Home Health Care Agencies office/location snapshot. Not a nursing-home facility row.';
COMMENT ON TABLE hospice_snapshot IS
  'CMS Hospice general-information office/location snapshot. Not a nursing-home facility row.';
COMMENT ON TABLE cms_agency_service_zip IS
  'CMS-published ZIP coverage evidence. An office county is not the service area.';
COMMENT ON COLUMN cms_agency_quality_observation.measure_family IS
  'hh_quality and hospice_quality are QRP measures; hh_hhcahps and hospice_cahps are surveys.';

INSERT INTO cms_refresh_source_policy (
  dataset_key, cms_identifier, refresh_cadence, check_frequency,
  freshness_sla_days, min_row_count, max_drop_ratio, depends_on,
  pause_dependents_on_failure
) VALUES
  ('home-health-care-agencies', '6jpm-sxkc', 'QUARTERLY', 'WEEKLY',
   120, 8000, 0.3, '{}', true),
  ('home-health-patient-survey-hhcahps', 'ccn4-8vby', 'QUARTERLY', 'WEEKLY',
   120, 5000, 0.4, '{home-health-care-agencies}', false),
  ('home-health-zip-codes', 'm5eg-upu5', 'QUARTERLY', 'WEEKLY',
   120, 50000, 0.5, '{home-health-care-agencies}', false),
  ('home-health-agency-enrollments', '15f64ab4-3172-4a27-b589-ebd67a6d28aa',
   'MONTHLY', 'WEEKLY', 45, 8000, 0.3, '{home-health-care-agencies}', true),
  ('home-health-agency-all-owners', 'fc009b2d-7846-44b1-b4a1-692f0c143879',
   'MONTHLY', 'WEEKLY', 45, 20000, 0.4, '{home-health-agency-enrollments}', false),
  ('hospice-general-information', 'yc9t-dgbk', 'QUARTERLY', 'WEEKLY',
   120, 4000, 0.3, '{}', true),
  ('hospice-provider-data', '252m-zfp9', 'QUARTERLY', 'WEEKLY',
   120, 100000, 0.4, '{hospice-general-information}', false),
  ('hospice-provider-cahps', 'gxki-hrr8', 'QUARTERLY', 'WEEKLY',
   120, 20000, 0.4, '{hospice-general-information}', false),
  ('hospice-zip-data', '95rg-2usp', 'QUARTERLY', 'WEEKLY',
   120, 20000, 0.5, '{hospice-general-information}', false),
  ('hospice-enrollments', '25704213-e833-4b8b-9dbc-58dd17149209',
   'MONTHLY', 'WEEKLY', 45, 4000, 0.3, '{hospice-general-information}', true),
  ('hospice-all-owners', 'e983965e-1603-4cb8-82b5-c40090e380d1',
   'MONTHLY', 'WEEKLY', 45, 10000, 0.4, '{hospice-enrollments}', false);

COMMIT;
