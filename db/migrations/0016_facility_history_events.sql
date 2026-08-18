BEGIN;

CREATE TABLE facility_history_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  event_type text NOT NULL,
  event_family text NOT NULL CHECK (
    event_family IN ('rating', 'staffing', 'inspection', 'enforcement', 'ownership', 'state')
  ),
  event_date date NOT NULL,
  date_precision text NOT NULL CHECK (date_precision IN ('day', 'month', 'quarter', 'release')),
  date_basis text NOT NULL CHECK (date_basis IN ('occurred', 'reported_in_release')),
  importance text NOT NULL CHECK (importance IN ('HIGH', 'MEDIUM', 'LOW')),
  title text NOT NULL,
  summary text NOT NULL,
  previous_value text,
  new_value text,
  evidence_href text NOT NULL,
  source_dataset_key text NOT NULL,
  source_release_id uuid REFERENCES source_release(id),
  source_record_locator text,
  source_event_key text NOT NULL,
  fingerprint text NOT NULL,
  derivation_version text NOT NULL,
  publication_eligible boolean NOT NULL DEFAULT true,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fingerprint),
  CHECK (btrim(event_type) <> ''),
  CHECK (btrim(title) <> ''),
  CHECK (btrim(summary) <> ''),
  CHECK (btrim(fingerprint) <> ''),
  CHECK (btrim(derivation_version) <> ''),
  CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX facility_history_provider_date_idx
  ON facility_history_event(provider_id, event_date DESC, importance);
CREATE INDEX facility_history_provider_family_idx
  ON facility_history_event(provider_id, event_family, event_date DESC);

CREATE OR REPLACE VIEW published_facility_history_event AS
SELECT e.*
FROM facility_history_event e
WHERE e.publication_eligible = true;

COMMENT ON TABLE facility_history_event IS
  '016 derived national facility-history events. Not a ranking or score input.';
COMMENT ON VIEW published_facility_history_event IS
  '016 consumer-readable facility-history events. Not a ranking input.';

COMMIT;
