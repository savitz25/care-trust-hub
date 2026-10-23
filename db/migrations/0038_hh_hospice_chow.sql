BEGIN;

-- Additive HH/Hospice CHOW storage. Not applied by this change.
-- Existing SNF rows stay CONFIRMED_EFFECTIVE with public_eligible false.

ALTER TABLE ownership_change_event
  ADD COLUMN IF NOT EXISTS public_eligible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS not_seen boolean NOT NULL DEFAULT false;

ALTER TABLE ownership_change_event
  DROP CONSTRAINT IF EXISTS ownership_change_event_status_check;
ALTER TABLE ownership_change_event
  ADD CONSTRAINT ownership_change_event_status_check CHECK (
    event_status IS NULL OR event_status IN (
      'CONFIRMED_EFFECTIVE', 'VERIFIED', 'REVIEW_REQUIRED'
    )
  );

ALTER TABLE ownership_change_event
  DROP CONSTRAINT IF EXISTS ownership_change_event_confidence_check;
ALTER TABLE ownership_change_event
  ADD CONSTRAINT ownership_change_event_confidence_check CHECK (
    confidence IS NULL OR confidence IN (
      'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED', 'EXACT', 'STRONG'
    )
  );

ALTER TABLE ownership_change_event
  DROP CONSTRAINT IF EXISTS ownership_change_event_public_gate;
ALTER TABLE ownership_change_event
  ADD CONSTRAINT ownership_change_event_public_gate CHECK (
    public_eligible = false
    OR (
      event_status = 'VERIFIED'
      AND confidence = 'EXACT'
      AND not_seen = false
    )
  );

CREATE TABLE IF NOT EXISTS hh_hospice_chow_owner_association (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_key text NOT NULL,
  owner_natural_key text NOT NULL,
  enrollment_id text NOT NULL,
  associate_id text NOT NULL,
  party_kind text,
  party_name text NOT NULL,
  role_code text,
  role_text text,
  association_date date,
  ownership_percentage text,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  public_eligible boolean NOT NULL DEFAULT false,
  not_seen boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_natural_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (public_eligible = false),
  CHECK (dataset_key IN ('home-health-chow-owners', 'hospice-chow-owners')),
  CHECK (btrim(owner_natural_key) <> ''),
  CHECK (btrim(enrollment_id) <> ''),
  CHECK (btrim(associate_id) <> ''),
  CHECK (btrim(source_record_locator) <> '')
);

COMMENT ON TABLE hh_hospice_chow_owner_association IS
  'HH/Hospice CHOW owner associations. Not ownership-change events and not public.';
COMMENT ON COLUMN ownership_change_event.public_eligible IS
  'True only for a verified exact match that is still present in the upstream file.';
COMMENT ON COLUMN ownership_change_event.not_seen IS
  'True when a previously loaded HH/Hospice CHOW key is absent from the current file.';

INSERT INTO source_dataset (dataset_key, source_organization, display_name, official_url)
VALUES
  (
    'home-health-chow',
    'Centers for Medicare & Medicaid Services (CMS)',
    'Home Health Change of Ownership',
    'https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/home-health-agency-enrollments'
  ),
  (
    'hospice-chow',
    'Centers for Medicare & Medicaid Services (CMS)',
    'Hospice Change of Ownership',
    'https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/hospice-enrollments'
  ),
  (
    'home-health-chow-owners',
    'Centers for Medicare & Medicaid Services (CMS)',
    'Home Health Change of Ownership Owners',
    'https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/home-health-agency-enrollments'
  ),
  (
    'hospice-chow-owners',
    'Centers for Medicare & Medicaid Services (CMS)',
    'Hospice Change of Ownership Owners',
    'https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/hospice-enrollments'
  )
ON CONFLICT (dataset_key) DO NOTHING;

-- min_row_count is 1 because the loader fail-closed gates are the real check.
-- A guessed CMS minimum of 1000 would reject the smaller hospice file.
INSERT INTO cms_refresh_source_policy (
  dataset_key, cms_identifier, refresh_cadence, check_frequency,
  freshness_sla_days, min_row_count, max_drop_ratio, depends_on,
  pause_dependents_on_failure
) VALUES
  ('home-health-chow', '15f64ab4-3172-4a27-b589-ebd67a6d28aa', 'QUARTERLY', 'WEEKLY',
   120, 1, 0.5, '{}', true),
  ('hospice-chow', '25704213-e833-4b8b-9dbc-58dd17149209', 'QUARTERLY', 'WEEKLY',
   120, 1, 0.5, '{}', true),
  ('home-health-chow-owners', '15f64ab4-3172-4a27-b589-ebd67a6d28aa', 'QUARTERLY', 'WEEKLY',
   120, 1, 0.5, '{home-health-chow}', false),
  ('hospice-chow-owners', '25704213-e833-4b8b-9dbc-58dd17149209', 'QUARTERLY', 'WEEKLY',
   120, 1, 0.5, '{hospice-chow}', false)
ON CONFLICT (dataset_key) DO NOTHING;

COMMIT;
