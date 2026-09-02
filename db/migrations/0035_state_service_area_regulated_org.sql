BEGIN;

-- NJ-SEN-004: reusable service-area, regulated-organization, certificate,
-- disclosure, coverage, and class-safe identity extensions.
-- Additive. Does not publish /new-jersey. public_eligible defaults false.
-- Does not create nj_acute_facilities / nj_home_health / nj_hospice / nj_ccrc.

ALTER TABLE state_facility_identity
  ADD COLUMN IF NOT EXISTS dataset_key text,
  ADD COLUMN IF NOT EXISTS latitude numeric,
  ADD COLUMN IF NOT EXISTS longitude numeric,
  ADD COLUMN IF NOT EXISTS mailing_street text,
  ADD COLUMN IF NOT EXISTS license_status_raw text,
  ADD COLUMN IF NOT EXISTS first_seen_on date,
  ADD COLUMN IF NOT EXISTS last_seen_on date;

UPDATE state_facility_identity AS ident
SET dataset_key = snap.dataset_key
FROM state_source_snapshot AS snap
WHERE ident.source_snapshot_id = snap.id
  AND ident.dataset_key IS NULL;

UPDATE state_facility_identity
SET dataset_key = 'unknown'
WHERE dataset_key IS NULL;

ALTER TABLE state_facility_identity
  ALTER COLUMN dataset_key SET NOT NULL;

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'state_facility_identity'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) LIKE '%source_facility_id%'
      AND pg_get_constraintdef(con.oid) NOT LIKE '%dataset_key%'
  LOOP
    EXECUTE format('ALTER TABLE state_facility_identity DROP CONSTRAINT %I', rec.conname);
  END LOOP;
  FOR rec IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'state_facility_identity'
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) LIKE '%license_number%'
      AND pg_get_constraintdef(con.oid) NOT LIKE '%dataset_key%'
      AND pg_get_constraintdef(con.oid) NOT LIKE '%cms_ccn%'
  LOOP
    EXECUTE format('ALTER TABLE state_facility_identity DROP CONSTRAINT %I', rec.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS state_facility_identity_dataset_facid_uidx
  ON state_facility_identity (state_code, regulator_code, dataset_key, source_facility_id);
CREATE UNIQUE INDEX IF NOT EXISTS state_facility_identity_dataset_license_uidx
  ON state_facility_identity (state_code, regulator_code, dataset_key, license_number);

ALTER TABLE state_facility_type_map
  ADD COLUMN IF NOT EXISTS senior_relevant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cms_crosswalk_class text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS public_profile_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS state_intelligence_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'MAPPED';

ALTER TABLE state_facility_type_map
  DROP CONSTRAINT IF EXISTS state_facility_type_map_cms_crosswalk_class_check;
ALTER TABLE state_facility_type_map
  ADD CONSTRAINT state_facility_type_map_cms_crosswalk_class_check
  CHECK (cms_crosswalk_class IN ('none', 'nursing_home', 'home_health', 'hospice'));

ALTER TABLE state_facility_type_map
  DROP CONSTRAINT IF EXISTS state_facility_type_map_review_status_check;
ALTER TABLE state_facility_type_map
  ADD CONSTRAINT state_facility_type_map_review_status_check
  CHECK (review_status IN ('MAPPED', 'QUARANTINED', 'REVIEW_REQUIRED'));

UPDATE state_facility_type_map
SET
  senior_relevant = true,
  cms_crosswalk_class = CASE WHEN cms_nursing_eligible THEN 'nursing_home' ELSE 'none' END,
  public_profile_eligible = false,
  state_intelligence_eligible = true,
  review_status = 'MAPPED'
WHERE adapter_version = 'nj-doh-ltc-v1';

ALTER TABLE state_facility_document
  DROP CONSTRAINT IF EXISTS state_facility_document_document_kind_check;
ALTER TABLE state_facility_document
  ADD CONSTRAINT state_facility_document_document_kind_check
  CHECK (document_kind IN (
    'penalty_letter',
    'enforcement_order',
    'inspection_index',
    'inspection_sod',
    'inspection_poc',
    'disclosure_statement',
    'audited_financial',
    'certificate_of_authority',
    'continuing_care_contract',
    'other'
  ));

ALTER TABLE state_facility_document
  DROP CONSTRAINT IF EXISTS state_facility_document_corpus_scope_check;
ALTER TABLE state_facility_document
  ADD CONSTRAINT state_facility_document_corpus_scope_check
  CHECK (
    corpus_scope IS NULL OR corpus_scope IN (
      'NJ_LTC_FACILITY_MATCHED',
      'LIKELY_NJ_LTC_REVIEW_REQUIRED',
      'NJ_ACUTE_OR_OTHER_HEALTH_FACILITY',
      'NJ_ACUTE_HOME_HEALTH_MATCHED',
      'NJ_ACUTE_HOSPICE_PROGRAM_MATCHED',
      'NJ_ACUTE_HOSPICE_BRANCH_MATCHED',
      'NJ_ACUTE_HOSPICE_INPATIENT_MATCHED',
      'NJ_ACUTE_OTHER_MATCHED',
      'NON_FACILITY_OR_AGENCY_DOCUMENT',
      'UNRESOLVED_SCOPE',
      'SOURCE_DOCUMENT_UNAVAILABLE'
    )
  );

CREATE TABLE state_facility_service_area (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES state_facility_identity(id) ON DELETE CASCADE,
  coverage_type text NOT NULL CHECK (coverage_type IN (
    'PHYSICAL_LOCATION',
    'FULL_COUNTY_SERVICE',
    'PARTIAL_COUNTY_SERVICE',
    'SPECIFIC_ZIP_SERVICE',
    'STATEWIDE_SERVICE',
    'SERVICE_AREA_UNKNOWN'
  )),
  county text,
  zip_code text,
  source_page text,
  source_as_of date,
  retrieved_at timestamptz NOT NULL,
  record_fingerprint text NOT NULL,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(record_fingerprint) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);
CREATE UNIQUE INDEX state_facility_service_area_natural_idx
  ON state_facility_service_area (
    facility_id, coverage_type, COALESCE(county, ''), COALESCE(zip_code, '')
  );

CREATE TABLE state_regulated_organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  regulator_code text NOT NULL,
  program_code text NOT NULL,
  legal_name text NOT NULL,
  registration_id text,
  current_status text,
  source_snapshot_id uuid REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(legal_name) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_regulated_community (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES state_regulated_organization(id) ON DELETE CASCADE,
  external_key text NOT NULL UNIQUE,
  community_name text NOT NULL,
  street text,
  city text,
  county text,
  zip_code text,
  source_snapshot_id uuid REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(community_name) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_regulatory_certificate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES state_regulated_organization(id) ON DELETE CASCADE,
  community_id uuid REFERENCES state_regulated_community(id) ON DELETE SET NULL,
  external_key text NOT NULL UNIQUE,
  certificate_type text NOT NULL,
  certificate_number text,
  effective_on date,
  expires_on date,
  status_raw text,
  source_snapshot_id uuid REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(certificate_type) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_disclosure_filing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES state_regulated_organization(id) ON DELETE CASCADE,
  community_id uuid REFERENCES state_regulated_community(id) ON DELETE SET NULL,
  document_id uuid REFERENCES state_facility_document(id) ON DELETE SET NULL,
  filing_year integer,
  filing_type text NOT NULL,
  document_date date,
  audited_period_end date,
  extraction_status text NOT NULL DEFAULT 'not_acquired',
  public_availability text NOT NULL DEFAULT 'not_acquired',
  source_snapshot_id uuid REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(filing_type) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_organization_facility_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES state_regulated_organization(id) ON DELETE CASCADE,
  community_id uuid REFERENCES state_regulated_community(id) ON DELETE SET NULL,
  facility_id uuid REFERENCES state_facility_identity(id) ON DELETE SET NULL,
  relationship_type text NOT NULL,
  match_bucket text NOT NULL CHECK (match_bucket IN (
    'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED', 'UNSAFE_REJECTED'
  )),
  match_method text NOT NULL,
  reason text NOT NULL,
  adapter_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(relationship_type) <> ''),
  CHECK (btrim(match_method) <> '')
);
CREATE UNIQUE INDEX state_organization_facility_link_natural_idx
  ON state_organization_facility_link (
    organization_id,
    COALESCE(community_id::text, ''),
    COALESCE(facility_id::text, ''),
    relationship_type,
    match_method
  );

CREATE TABLE state_source_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_code char(2) NOT NULL,
  source_family text NOT NULL,
  coverage_state text NOT NULL CHECK (coverage_state IN (
    'ACQUIRED_COMPLETE',
    'ACQUIRED_CURRENT_SNAPSHOT',
    'ACQUIRED_PARTIAL_HISTORY',
    'PARTIAL_SOURCE_COVERAGE',
    'SOURCE_NOT_ACQUIRED',
    'SOURCE_ACCESS_BLOCKED',
    'SOURCE_AVAILABLE_BY_REQUEST',
    'SOURCE_UNVERIFIED'
  )),
  dataset_key text,
  notes text NOT NULL,
  source_snapshot_id uuid REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  retrieved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, source_family),
  CHECK (btrim(source_family) <> ''),
  CHECK (btrim(notes) <> '')
);

CREATE INDEX state_facility_identity_dataset_idx
  ON state_facility_identity (state_code, dataset_key, official_facility_type_canonical);
CREATE INDEX state_facility_service_area_county_idx
  ON state_facility_service_area (county, coverage_type);
CREATE INDEX state_regulated_organization_program_idx
  ON state_regulated_organization (state_code, program_code);

COMMENT ON TABLE state_facility_service_area IS
  'Office location versus published service area. PHYSICAL_LOCATION is not inferred coverage.';
COMMENT ON TABLE state_regulated_organization IS
  'Generic regulated organizations such as CCRC providers. Not PACE and not an NJDOH facility type.';
COMMENT ON TABLE state_regulated_community IS
  'CCRC campus/community. Does not merge separately licensed NJDOH facilities.';
COMMENT ON TABLE state_regulatory_certificate IS
  'Certificate of Authority or equivalent. Not a quality score.';
COMMENT ON TABLE state_disclosure_filing IS
  'Filed disclosure metadata. Reuses state_facility_document for PDF bytes. Not a financial-strength score.';
COMMENT ON TABLE state_organization_facility_link IS
  'Campus-to-license relationships. Evidence is never copied across licenses.';
COMMENT ON TABLE state_source_coverage IS
  'Absence is not non-acquisition. Zero observations are forbidden for unacquired families.';
COMMENT ON COLUMN state_facility_identity.dataset_key IS
  'Separates All_LTC from All_Acute identities. Same name/address does not overwrite the other spine.';
COMMENT ON COLUMN state_facility_type_map.public_profile_eligible IS
  'Defaults false. A later gated decision may flip a class; ingest must not.';

COMMIT;
