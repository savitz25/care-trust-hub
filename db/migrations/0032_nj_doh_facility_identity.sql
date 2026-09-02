BEGIN;

-- NJ-SEN-001: New Jersey NJDOH long-term-care facility identity spine.
-- Additive. Does not publish /new-jersey, sitemaps, or public_eligible rows.
-- Does not rewrite CMS provider identity or Florida state_licensed_provider.

CREATE TABLE state_source_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_key text NOT NULL,
  agency text NOT NULL,
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_as_of date,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer NOT NULL CHECK (row_count >= 0),
  schema_fingerprint text NOT NULL,
  jurisdiction char(2) NOT NULL,
  baseline_only boolean NOT NULL DEFAULT true,
  original_filename text NOT NULL,
  adapter_version text NOT NULL,
  worksheet_names text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_key, content_sha256),
  CHECK (btrim(dataset_key) <> ''),
  CHECK (btrim(agency) <> ''),
  CHECK (btrim(schema_fingerprint) <> '')
);

CREATE TABLE state_facility_type_map (
  adapter_version text NOT NULL,
  raw_type text NOT NULL,
  canonical_type text NOT NULL,
  cms_nursing_eligible boolean NOT NULL,
  notes text NOT NULL,
  PRIMARY KEY (adapter_version, raw_type),
  CHECK (btrim(raw_type) <> ''),
  CHECK (btrim(canonical_type) <> '')
);

CREATE TABLE state_facility_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  regulator_code text NOT NULL,
  source_facility_id text NOT NULL,
  license_number text NOT NULL,
  official_name text NOT NULL,
  alpha_name text,
  official_facility_type_raw text NOT NULL,
  official_facility_type_canonical text NOT NULL,
  license_expires_on date,
  licensed_beds_slots integer CHECK (licensed_beds_slots IS NULL OR licensed_beds_slots >= 0),
  street text,
  city text,
  county text,
  state text,
  zip_code text,
  phone text,
  email text,
  owner_entity_type_raw text,
  cms_ccn text CHECK (cms_ccn IS NULL OR cms_ccn ~ '^[A-Z0-9]{6}$'),
  cms_link_method text,
  cms_link_confidence text CHECK (
    cms_link_confidence IS NULL OR cms_link_confidence IN (
      'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED'
    )
  ),
  cms_provider_id uuid REFERENCES provider(id),
  identity_state text NOT NULL CHECK (identity_state IN (
    'VERIFIED', 'PROBABLE', 'REVIEW_REQUIRED', 'REJECTED', 'UNRESOLVED'
  )),
  publication_state text NOT NULL CHECK (publication_state IN (
    'PUBLISHABLE_CURRENT',
    'PUBLISHABLE_WITH_STATUS',
    'HISTORICAL_ONLY',
    'NOT_CURRENTLY_PUBLISHABLE',
    'REVIEW_REQUIRED'
  )),
  public_eligible boolean NOT NULL DEFAULT false,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  source_record_identifier text NOT NULL,
  record_fingerprint text NOT NULL,
  source_observed_on date,
  retrieved_at timestamptz NOT NULL,
  adapter_version text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, regulator_code, source_facility_id),
  UNIQUE (state_code, regulator_code, license_number),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(source_facility_id) <> ''),
  CHECK (btrim(license_number) <> ''),
  CHECK (btrim(official_name) <> ''),
  CHECK (jsonb_typeof(raw) = 'object'),
  CHECK (cms_provider_id IS NULL OR cms_ccn IS NOT NULL),
  CHECK (cms_link_confidence IS NULL OR cms_link_confidence IN (
    'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED'
  ))
);

CREATE TABLE state_facility_party (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES state_facility_identity(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'licensed_owner', 'administrator', 'officer', 'other'
  )),
  name text NOT NULL,
  source_field text NOT NULL,
  address_text text,
  as_of date,
  match_method text NOT NULL DEFAULT 'source_explicit',
  UNIQUE (facility_id, role, name, source_field),
  CHECK (btrim(name) <> ''),
  CHECK (btrim(source_field) <> '')
);

CREATE TABLE state_facility_type_review (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid REFERENCES state_source_snapshot(id),
  source_facility_id text,
  raw_type text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(raw_type) <> ''),
  CHECK (btrim(reason) <> '')
);

CREATE TABLE state_facility_match_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES state_facility_identity(id) ON DELETE CASCADE,
  match_bucket text NOT NULL CHECK (match_bucket IN (
    'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED', 'UNSAFE_REJECTED'
  )),
  match_method text NOT NULL,
  cms_ccn text,
  cms_provider_id uuid REFERENCES provider(id),
  reason text NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(match_method) <> ''),
  CHECK (btrim(reason) <> '')
);
CREATE UNIQUE INDEX state_facility_match_natural_idx
  ON state_facility_match_ledger (
    facility_id, match_bucket, match_method, COALESCE(cms_ccn, '')
  );

CREATE INDEX state_facility_identity_type_idx
  ON state_facility_identity (state_code, official_facility_type_canonical);
CREATE INDEX state_facility_identity_cms_idx
  ON state_facility_identity (cms_ccn)
  WHERE cms_ccn IS NOT NULL;
CREATE INDEX state_facility_party_role_idx
  ON state_facility_party (facility_id, role);
CREATE INDEX state_facility_match_bucket_idx
  ON state_facility_match_ledger (match_bucket);

COMMENT ON TABLE state_source_snapshot IS
  'Reusable state-source provenance. baseline_only=true means no historical alert generation on first observation.';
COMMENT ON TABLE state_facility_identity IS
  'Reusable state licensed-facility identities. Optional cms_provider_id overlays CMS; it does not create CMS providers. NJ-SEN-001 ingest writes public_eligible=false.';
COMMENT ON TABLE state_facility_party IS
  'Explicit source roles only. Licensed owner is not an administrator. Administrator is not an owner.';
COMMENT ON TABLE state_facility_type_map IS
  'Versioned raw regulator facility-type mapping. Unknown raw values must not be inserted here.';
COMMENT ON COLUMN state_facility_identity.official_facility_type_canonical IS
  'Internal class. RESIDENTIAL DEMENTIA CARE HOME is an official NJDOH type, not an inferred memory-care license.';

COMMIT;
