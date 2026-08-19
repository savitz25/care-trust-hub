BEGIN;

CREATE TABLE assisted_living_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  regulator_code text NOT NULL,
  source_facility_id text NOT NULL,
  license_id text,
  official_name text NOT NULL,
  official_street text,
  official_city text,
  official_state text,
  official_zip text,
  official_phone text,
  official_type text NOT NULL,
  consumer_category text NOT NULL,
  license_status text,
  license_status_reported boolean NOT NULL,
  source_directory_context text NOT NULL,
  licensed_capacity integer,
  memory_designation text NOT NULL,
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
  discovery_eligible boolean NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_locator text NOT NULL,
  source_fingerprint text NOT NULL,
  adapter_version text NOT NULL,
  record_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, regulator_code, source_facility_id),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(source_facility_id) <> ''),
  CHECK (btrim(official_name) <> ''),
  CHECK (licensed_capacity IS NULL OR licensed_capacity >= 0),
  CHECK (discovery_eligible = false OR publication_state IN (
    'PUBLISHABLE_CURRENT', 'PUBLISHABLE_WITH_STATUS'
  )),
  CHECK (discovery_eligible = false OR identity_state = 'VERIFIED')
);

CREATE TABLE assisted_living_organization_party (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES assisted_living_provider(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN (
    'licensee', 'operator', 'management_company', 'administrator', 'owner', 'parent_organization'
  )),
  name text NOT NULL,
  source_field text NOT NULL,
  UNIQUE (provider_id, role, name),
  CHECK (btrim(name) <> ''),
  CHECK (btrim(source_field) <> '')
);

CREATE INDEX assisted_living_provider_discovery_idx
  ON assisted_living_provider (state_code, publication_state, consumer_category)
  WHERE discovery_eligible;
CREATE INDEX assisted_living_provider_state_source_idx
  ON assisted_living_provider (state_code, source_facility_id);
CREATE INDEX assisted_living_provider_license_idx
  ON assisted_living_provider (state_code, license_id)
  WHERE license_id IS NOT NULL;
CREATE INDEX assisted_living_provider_identity_idx
  ON assisted_living_provider (identity_state, publication_state);
CREATE INDEX assisted_living_party_provider_role_idx
  ON assisted_living_organization_party (provider_id, role);

COMMIT;
