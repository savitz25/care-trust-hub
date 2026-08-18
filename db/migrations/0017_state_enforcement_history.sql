BEGIN;

ALTER TABLE facility_history_event
  ADD COLUMN IF NOT EXISTS regulator text,
  ADD COLUMN IF NOT EXISTS state_code text,
  ADD COLUMN IF NOT EXISTS state_license_id text,
  ADD COLUMN IF NOT EXISTS federal_relationship text,
  ADD COLUMN IF NOT EXISTS source_label text;

UPDATE facility_history_event
SET source_label = 'CMS',
    federal_relationship = 'FEDERAL_ONLY'
WHERE source_label IS NULL
  AND event_family <> 'state';

CREATE INDEX IF NOT EXISTS facility_history_state_idx
  ON facility_history_event(state_code, event_type, event_date DESC)
  WHERE event_family = 'state';

COMMENT ON COLUMN facility_history_event.source_label IS
  '017 consumer source family: CMS or official state regulator.';
COMMENT ON COLUMN facility_history_event.federal_relationship IS
  '017 STATE_ONLY / FEDERAL_ONLY / STATE_AND_CMS_CORROBORATED / POSSIBLE_DUPLICATE / UNKNOWN_RELATIONSHIP.';

COMMIT;
