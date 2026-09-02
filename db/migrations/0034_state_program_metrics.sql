BEGIN;

-- NJ-SEN-003: reusable state facility metrics, program participation, and
-- community-program organizations/locations/service areas.
-- Additive. Does not publish /new-jersey. Does not copy CMS PBJ rows.
-- PACE centers are not nursing-home providers. Medicaid rates are not prices.

CREATE TABLE state_facility_metric_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  regulator_code text NOT NULL,
  dataset_key text NOT NULL,
  metric_family text NOT NULL,
  metric_key text NOT NULL,
  period_year integer NOT NULL,
  period_quarter text,
  shift text,
  staff_category text,
  raw_value text,
  numeric_value numeric,
  unit text,
  missing_code text,
  is_statewide_comparator boolean NOT NULL DEFAULT false,
  source_facility_id text,
  source_facility_name text NOT NULL,
  census_raw text,
  facility_id uuid REFERENCES state_facility_identity(id),
  match_bucket text CHECK (
    match_bucket IS NULL OR match_bucket IN (
      'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED', 'UNSAFE_REJECTED'
    )
  ),
  match_method text,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  record_fingerprint text NOT NULL,
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(metric_family) <> ''),
  CHECK (btrim(metric_key) <> ''),
  CHECK (btrim(source_facility_name) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_program_participation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  program_code text NOT NULL,
  fiscal_year text NOT NULL,
  effective_on date,
  provider_name text NOT NULL,
  subtype text,
  medicaid_provider_id text,
  daily_rate numeric,
  rate_raw text,
  rate_unit text NOT NULL DEFAULT 'per_diem',
  participation_evidence text NOT NULL,
  is_default_unlisted_rate boolean NOT NULL DEFAULT false,
  facility_id uuid REFERENCES state_facility_identity(id),
  match_bucket text CHECK (
    match_bucket IS NULL OR match_bucket IN (
      'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED', 'UNSAFE_REJECTED'
    )
  ),
  match_method text,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  record_fingerprint text NOT NULL,
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(program_code) <> ''),
  CHECK (btrim(provider_name) <> ''),
  CHECK (is_default_unlisted_rate = false),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_program_organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  program_code text NOT NULL,
  official_name text NOT NULL,
  cms_organization_id text,
  current_status text NOT NULL,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(official_name) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_program_location (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES state_program_organization(id) ON DELETE CASCADE,
  external_key text NOT NULL UNIQUE,
  center_name text NOT NULL,
  city text,
  county text,
  zip_code text,
  street text,
  current_status text NOT NULL,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(center_name) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_program_service_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES state_program_organization(id) ON DELETE CASCADE,
  location_id uuid REFERENCES state_program_location(id) ON DELETE SET NULL,
  coverage_type text NOT NULL CHECK (coverage_type IN (
    'FULL_COUNTY', 'PARTIAL_COUNTY_ZIPS', 'SPECIFIC_ZIP', 'AWARDED_FUTURE', 'UNVERIFIED'
  )),
  county text,
  zip_code text,
  operating_status text NOT NULL,
  as_of date,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  record_fingerprint text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX state_program_service_area_natural_idx
  ON state_program_service_area (
    organization_id, coverage_type, COALESCE(county, ''), COALESCE(zip_code, ''), operating_status
  );

CREATE TABLE state_program_status_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES state_program_organization(id) ON DELETE CASCADE,
  location_id uuid REFERENCES state_program_location(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN (
    'AWARDED', 'IN_DEVELOPMENT', 'CMS_APPROVED', 'STATE_LICENSED',
    'OPERATING', 'SUSPENDED', 'CLOSED', 'STATUS_UNVERIFIED'
  )),
  event_date date,
  event_identity text NOT NULL,
  source_locator text NOT NULL,
  baseline_only boolean NOT NULL DEFAULT true,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  UNIQUE (event_identity),
  CHECK (btrim(event_identity) <> '')
);

CREATE INDEX state_facility_metric_period_idx
  ON state_facility_metric_observation (state_code, metric_family, period_year, period_quarter);
CREATE INDEX state_program_participation_year_idx
  ON state_program_participation (program_code, fiscal_year);
CREATE INDEX state_program_service_area_county_idx
  ON state_program_service_area (county, coverage_type);

COMMENT ON TABLE state_facility_metric_observation IS
  'Reusable state facility metrics such as NJDOH nursing-home staffing ratios. Not CMS PBJ. Not a ranking.';
COMMENT ON TABLE state_program_participation IS
  'Listed program participation/rate evidence. Unlisted facilities are not inferred non-participating. Rates are not consumer prices.';
COMMENT ON TABLE state_program_organization IS
  'Community programs such as PACE organizations. Not a nursing-home or assisted-living license.';
COMMENT ON TABLE state_program_location IS
  'Physical program centers. Address does not define service area.';
COMMENT ON TABLE state_program_service_area IS
  'Full-county versus ZIP-level coverage. Awarded-future is not operating.';
COMMENT ON TABLE state_program_status_event IS
  'Dated program status observations. First snapshot is baseline-only.';
COMMENT ON COLUMN state_facility_metric_observation.unit IS
  'Preserve source orientation. NJDOH staffing is residents per one staff member (1RN:#Res).';
COMMENT ON COLUMN state_program_participation.is_default_unlisted_rate IS
  'Must remain false. Default unlisted rates never create participation rows.';

COMMIT;
