BEGIN;

-- FL-SEN-002: empty Florida multi-class state-license identity tables.
-- Additive. Does not ingest providers, inspections, or enforcement rows.
-- Does not rewrite CMS provider identity or CA/NY/TX assisted_living_provider.
-- Memory Care is not a provider class.

CREATE TABLE state_licensed_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL CHECK (state_code = 'FL'),
  regulator_code text NOT NULL CHECK (regulator_code = 'FL_AHCA'),
  provider_class text NOT NULL CHECK (provider_class IN (
    'FL_ALF',
    'FL_AFCH',
    'FL_HOME_HEALTH_LICENSE',
    'FL_HOSPICE_LICENSE',
    'FL_HOMEMAKER_COMPANION',
    'FL_NURSE_REGISTRY',
    'FL_ADULT_DAY_CARE',
    'FL_NH_LICENSE'
  )),
  ahca_file_number text NOT NULL,
  license_number text,
  healthfinder_lid text,
  official_name text NOT NULL,
  license_status_raw text,
  license_status_normalized text CHECK (
    license_status_normalized IS NULL OR license_status_normalized IN (
      'CURRENT', 'CLOSED_IN_LOCATOR', 'PENDING', 'UNKNOWN'
    )
  ),
  license_effective_on date,
  license_expires_on date,
  licensed_capacity integer CHECK (licensed_capacity IS NULL OR licensed_capacity >= 0),
  cms_ccn text CHECK (cms_ccn IS NULL OR cms_ccn ~ '^[A-Z0-9]{6}$'),
  cms_link_confidence text CHECK (
    cms_link_confidence IS NULL OR cms_link_confidence IN (
      'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'
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
  source_as_of timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_locator text NOT NULL,
  source_fingerprint text NOT NULL,
  adapter_version text NOT NULL,
  record_fingerprint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, regulator_code, provider_class, ahca_file_number),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(ahca_file_number) <> ''),
  CHECK (btrim(official_name) <> ''),
  CHECK (btrim(source_locator) <> ''),
  CHECK (btrim(source_fingerprint) <> ''),
  CHECK (btrim(adapter_version) <> ''),
  CHECK (btrim(record_fingerprint) <> ''),
  CHECK (cms_provider_id IS NULL OR cms_ccn IS NOT NULL),
  CHECK (cms_link_confidence IS NULL OR cms_ccn IS NOT NULL),
  CHECK (cms_link_confidence <> 'CONFIRMED' OR cms_provider_id IS NOT NULL)
);

CREATE TABLE state_license_credential (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES state_licensed_provider(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN (
    'STANDARD', 'ECC', 'LNS', 'LMH', 'LICENSE_NUMBER', 'OTHER'
  )),
  credential_code text,
  raw_label text NOT NULL,
  status_raw text,
  effective_on date,
  expires_on date,
  source_field text NOT NULL,
  UNIQUE (provider_id, credential_type, raw_label),
  CHECK (btrim(raw_label) <> ''),
  CHECK (btrim(source_field) <> '')
);

CREATE TABLE state_provider_contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES state_licensed_provider(id) ON DELETE CASCADE,
  contact_kind text NOT NULL CHECK (contact_kind IN (
    'street_address',
    'mailing_address',
    'phone',
    'email',
    'website',
    'administrator',
    'financial_officer',
    'owner_licensee',
    'controlling_interest',
    'management_company',
    'other_named_party'
  )),
  value_text text NOT NULL,
  title text,
  source_field text NOT NULL,
  source_locator text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  UNIQUE (provider_id, contact_kind, value_text, source_field),
  CHECK (btrim(value_text) <> ''),
  CHECK (btrim(source_field) <> ''),
  CHECK (btrim(source_locator) <> '')
);

CREATE TABLE state_service_geography (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES state_licensed_provider(id) ON DELETE CASCADE,
  geography_kind text NOT NULL CHECK (geography_kind IN (
    'facility_county',
    'office_county',
    'mailing_county',
    'served_county',
    'con_area',
    'ahca_field_office'
  )),
  value_text text NOT NULL,
  source_field text NOT NULL,
  UNIQUE (provider_id, geography_kind, value_text),
  CHECK (btrim(value_text) <> ''),
  CHECK (btrim(source_field) <> '')
);

CREATE TABLE state_regulatory_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES state_licensed_provider(id) ON DELETE CASCADE,
  ahca_file_number text NOT NULL,
  event_family text NOT NULL CHECK (event_family IN (
    'inspection',
    'deficiency',
    'complaint',
    'legal_action',
    'fine',
    'emergency_action',
    'final_order'
  )),
  event_type text NOT NULL,
  event_date date,
  case_number text,
  inspection_track_id text,
  disposition_raw text,
  is_final boolean,
  source_locator text NOT NULL,
  source_as_of timestamptz NOT NULL,
  retrieved_at timestamptz NOT NULL,
  source_fingerprint text NOT NULL,
  adapter_version text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(ahca_file_number) <> ''),
  CHECK (btrim(event_type) <> ''),
  CHECK (btrim(source_locator) <> ''),
  CHECK (jsonb_typeof(payload) = 'object')
);

CREATE UNIQUE INDEX state_regulatory_event_natural_key_idx
  ON state_regulatory_event (
    provider_id,
    event_family,
    event_type,
    COALESCE(case_number, ''),
    COALESCE(inspection_track_id, ''),
    COALESCE(event_date, DATE '1970-01-01'),
    source_fingerprint
  );
CREATE INDEX state_licensed_provider_class_idx
  ON state_licensed_provider (provider_class, publication_state);
CREATE INDEX state_licensed_provider_file_idx
  ON state_licensed_provider (ahca_file_number);
CREATE INDEX state_licensed_provider_ccn_idx
  ON state_licensed_provider (cms_ccn)
  WHERE cms_ccn IS NOT NULL;
CREATE INDEX state_licensed_provider_cms_provider_idx
  ON state_licensed_provider (cms_provider_id)
  WHERE cms_provider_id IS NOT NULL;
CREATE INDEX state_license_credential_provider_idx
  ON state_license_credential (provider_id, credential_type);
CREATE INDEX state_provider_contact_provider_idx
  ON state_provider_contact (provider_id, contact_kind);
CREATE INDEX state_service_geography_provider_idx
  ON state_service_geography (provider_id, geography_kind);
CREATE INDEX state_regulatory_event_provider_idx
  ON state_regulatory_event (provider_id, event_family, event_date DESC);
CREATE INDEX state_regulatory_event_file_idx
  ON state_regulatory_event (ahca_file_number);

COMMENT ON TABLE state_licensed_provider IS
  'FL-SEN-002 Florida AHCA licensed identities. Empty until FL-SEN-003. CMS CCN remains canonical for Medicare classes. AHCA file number is canonical for Florida-only classes. Not a ranking table.';
COMMENT ON COLUMN state_licensed_provider.ahca_file_number IS
  'Canonical Florida locator identity. License number and HealthFinder LID are not the entity key.';
COMMENT ON COLUMN state_licensed_provider.healthfinder_lid IS
  'HealthFinder locator only. Not canonical identity.';
COMMENT ON COLUMN state_licensed_provider.source_as_of IS
  'Official source as-of. Must not be replaced by retrieved_at.';
COMMENT ON COLUMN state_licensed_provider.cms_provider_id IS
  'Optional overlay onto public.provider. NULL is valid for Florida-only identities.';
COMMENT ON TABLE state_license_credential IS
  'One-to-many credentials such as ALF Standard/ECC/LNS/LMH. Not provider classes. Not Memory Care.';
COMMENT ON TABLE state_provider_contact IS
  'Multiple official contacts. Do not collapse to one primary contact.';
COMMENT ON TABLE state_service_geography IS
  'Distinct geography kinds. Office county is not served county. Field office is not consumer geography.';
COMMENT ON TABLE state_regulatory_event IS
  'Future inspection/enforcement attachment point. No score. Empty in FL-SEN-002.';

COMMIT;
