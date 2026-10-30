CREATE TABLE source_dataset (
  id uuid PRIMARY KEY,
  dataset_key text NOT NULL,
  source_organization text NOT NULL,
  display_name text NOT NULL,
  official_url text
);

CREATE TABLE source_release (
  id uuid PRIMARY KEY,
  source_dataset_id uuid NOT NULL REFERENCES source_dataset(id),
  release_key text NOT NULL,
  source_published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  source_modified_at timestamptz NOT NULL,
  source_release_date date NOT NULL
);

CREATE TABLE ingest_run (
  id uuid PRIMARY KEY,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  status text NOT NULL,
  completed_at timestamptz NOT NULL,
  transformation_version text NOT NULL
);

CREATE TABLE facility_snapshot (
  provider_id uuid NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  ingest_run_id uuid NOT NULL REFERENCES ingest_run(id),
  provider_name text NOT NULL,
  legal_business_name text,
  address text,
  city text,
  state_code text NOT NULL,
  zip_code text,
  county_name text,
  telephone text,
  ownership_type text,
  certified_beds integer,
  participation_type text,
  participates_medicare boolean,
  participates_medicaid boolean,
  overall_rating smallint,
  health_inspection_rating smallint,
  staffing_rating smallint,
  quality_measure_rating smallint,
  source_latitude double precision,
  source_longitude double precision,
  source_record_locator text NOT NULL,
  transformation_version text NOT NULL,
  attributes jsonb NOT NULL
);

CREATE TABLE provider_identifier (
  provider_id uuid NOT NULL,
  issuer text NOT NULL,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  valid_from date,
  valid_to date
);

CREATE TABLE facility_claim (
  id uuid PRIMARY KEY,
  provider_id uuid NOT NULL,
  claim_type text NOT NULL,
  claim_value jsonb NOT NULL,
  resolution_state text NOT NULL,
  publication_eligible boolean NOT NULL,
  resolved_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  effective_to date
);

CREATE VIEW published_facility_claim AS
SELECT c.*
FROM facility_claim c
WHERE c.resolution_state = 'VERIFIED'
  AND c.claim_type IN ('google_official_website', 'google_public_phone', 'google_public_name')
  AND c.effective_to IS NULL
  AND c.claim_value IS NOT NULL
  AND c.claim_value <> 'null'::jsonb
  AND jsonb_typeof(c.claim_value) = 'string'
  AND btrim(c.claim_value #>> '{}') <> '';

INSERT INTO source_dataset (id, dataset_key, source_organization, display_name, official_url)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'nursing-home-provider-information',
  'Synthetic CI Fixture',
  'Synthetic Facility Data',
  'https://example.invalid/fixture'
);

INSERT INTO source_release (
  id, source_dataset_id, release_key, retrieved_at, source_modified_at, source_release_date
)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'synthetic-ci-release', now(), now(), current_date
);

INSERT INTO ingest_run (id, source_release_id, status, completed_at, transformation_version)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000002',
  'succeeded', now(), 'synthetic-ci'
);

INSERT INTO facility_snapshot (
  provider_id, source_release_id, ingest_run_id, provider_name, city, state_code,
  source_record_locator, transformation_version, attributes
)
VALUES (
  '00000000-0000-4000-8000-000000000005',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000004',
  'Synthetic CI Facility', 'Example City', 'NY', 'synthetic-row-1', 'synthetic-ci', '{}'::jsonb
);

INSERT INTO provider_identifier (provider_id, issuer, identifier_type, identifier_value, valid_from)
VALUES (
  '00000000-0000-4000-8000-000000000005', 'CMS', 'CCN', '010001', NULL
);
