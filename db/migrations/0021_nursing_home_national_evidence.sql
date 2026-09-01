BEGIN;

-- SEN-NAT-002: first-class NH designations, enrollment NPI relationships,
-- MDS quality-measure observations, directory status, and fire-safety citations.
-- Additive. Does not rewrite CCNs or delete existing evidence.

CREATE TABLE cms_facility_designation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  designation_kind text NOT NULL CHECK (designation_kind IN ('special_focus', 'abuse_icon')),
  official_status text NOT NULL,
  raw_official_value text NOT NULL,
  source_dataset_key text NOT NULL,
  source_field text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  reporting_period text,
  observed_at timestamptz,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT false,
  source_record_locator text NOT NULL,
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, ccn, designation_kind),
  CHECK (btrim(official_status) <> ''),
  CHECK (btrim(source_field) <> ''),
  CHECK (
    (designation_kind = 'special_focus' AND official_status IN (
      'SFF', 'SFF_CANDIDATE', 'NOT_SFF', 'NOT_OBSERVED'
    ))
    OR
    (designation_kind = 'abuse_icon' AND official_status IN (
      'DESIGNATED', 'NOT_DESIGNATED', 'NOT_OBSERVED'
    ))
  )
);

CREATE INDEX cms_facility_designation_provider_idx
  ON cms_facility_designation(provider_id, designation_kind)
  WHERE provider_id IS NOT NULL;
CREATE INDEX cms_facility_designation_current_idx
  ON cms_facility_designation(designation_kind, official_status)
  WHERE is_current;

CREATE TABLE provider_npi_relationship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  npi text NOT NULL CHECK (npi ~ '^[0-9]{10}$'),
  relationship_type text NOT NULL,
  confidence text NOT NULL CHECK (confidence IN (
    'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'
  )),
  enrollment_id text,
  organization_pac_id text,
  multiple_npi_flag boolean,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_record_locator text NOT NULL,
  transformation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (source_release_id, ccn, npi, enrollment_id),
  CHECK (relationship_type = 'medicare_enrollment_organization_npi'),
  CHECK (btrim(source_record_locator) <> '')
);

CREATE INDEX provider_npi_ccn_idx ON provider_npi_relationship(ccn);
CREATE INDEX provider_npi_npi_idx ON provider_npi_relationship(npi);
CREATE INDEX provider_npi_provider_idx
  ON provider_npi_relationship(provider_id)
  WHERE provider_id IS NOT NULL;

CREATE TABLE quality_measure_definition (
  measure_code text PRIMARY KEY,
  official_name text NOT NULL,
  stay_type text,
  used_in_five_star_rating boolean,
  source_dataset_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(measure_code) <> ''),
  CHECK (btrim(official_name) <> ''),
  CHECK (stay_type IS NULL OR stay_type IN ('Long Stay', 'Short Stay'))
);

CREATE TABLE facility_quality_measure_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  measure_code text NOT NULL REFERENCES quality_measure_definition(measure_code),
  period_component text NOT NULL CHECK (period_component IN (
    'Q1', 'Q2', 'Q3', 'Q4', 'FOUR_QUARTER_AVERAGE'
  )),
  measure_period text,
  score numeric,
  score_text text,
  suppressed boolean NOT NULL DEFAULT false,
  footnote text,
  used_in_five_star_rating boolean,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, ccn, measure_code, period_component),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id)
);

CREATE INDEX facility_qm_provider_idx
  ON facility_quality_measure_observation(provider_id, measure_code)
  WHERE provider_id IS NOT NULL;
CREATE INDEX facility_qm_ccn_idx
  ON facility_quality_measure_observation(ccn, measure_code);

CREATE TABLE provider_directory_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  directory_status text NOT NULL CHECK (directory_status IN (
    'CURRENT_ACTIVE',
    'ABSENT_FROM_CURRENT_DIRECTORY',
    'TERMINATED_CONFIRMED',
    'HISTORICAL',
    'STATUS_UNKNOWN'
  )),
  pi_source_release_id uuid NOT NULL REFERENCES source_release(id),
  observed_at timestamptz NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  notes text NOT NULL,
  transformation_version text NOT NULL,
  UNIQUE (ccn, pi_source_release_id)
);

CREATE INDEX provider_directory_status_current_idx
  ON provider_directory_status(directory_status);

CREATE TABLE fire_safety_citation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  inspection_event_id uuid REFERENCES inspection_event(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  finding_key text NOT NULL,
  ccn text NOT NULL CHECK (ccn ~ '^[A-Z0-9]{6}$'),
  survey_date date NOT NULL,
  survey_type text,
  inspection_cycle integer NOT NULL CHECK (inspection_cycle >= 0),
  deficiency_prefix text NOT NULL,
  deficiency_tag text NOT NULL,
  tag_version text,
  deficiency_category text,
  official_description text,
  scope_severity_code text NOT NULL CHECK (scope_severity_code ~ '^[A-L]$'),
  deficiency_corrected text,
  correction_date date,
  standard_deficiency boolean,
  complaint_deficiency boolean,
  processing_date date,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, finding_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id)
);

CREATE INDEX fire_safety_citation_provider_idx
  ON fire_safety_citation(provider_id, survey_date DESC)
  WHERE provider_id IS NOT NULL;
CREATE INDEX fire_safety_citation_ccn_idx ON fire_safety_citation(ccn, survey_date DESC);

CREATE OR REPLACE VIEW published_cms_facility_designation AS
SELECT *
FROM cms_facility_designation
WHERE is_current
  AND official_status <> 'NOT_OBSERVED';

CREATE OR REPLACE VIEW published_provider_npi_relationship AS
SELECT *
FROM provider_npi_relationship
WHERE confidence = 'CONFIRMED';

CREATE OR REPLACE VIEW published_facility_quality_measure AS
SELECT *
FROM facility_quality_measure_observation
WHERE period_component = 'FOUR_QUARTER_AVERAGE';

COMMENT ON TABLE cms_facility_designation IS
  'SEN-NAT-002 CMS Special Focus and abuse-icon observations. Candidate is not SFF.';
COMMENT ON TABLE provider_npi_relationship IS
  'SEN-NAT-002 Medicare enrollment organization NPI associated with a CCN. Not a facility canonical key.';
COMMENT ON TABLE facility_quality_measure_observation IS
  'SEN-NAT-002 MDS quality-measure observations. Not CMS star ratings.';
COMMENT ON TABLE provider_directory_status IS
  'SEN-NAT-002 PI directory membership. Absent from current PI is not confirmed termination.';
COMMENT ON TABLE fire_safety_citation IS
  'SEN-NAT-002 fire-safety citations. Distinct from health deficiencies.';

COMMIT;
