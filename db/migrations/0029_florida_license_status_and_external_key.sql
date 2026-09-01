BEGIN;

-- FL-SEN-002 follow-on: tighten normalized license status to observed AHCA values only.
-- Empty tables. Does not ingest evidence.

ALTER TABLE state_licensed_provider
  DROP CONSTRAINT state_licensed_provider_license_status_normalized_check;

ALTER TABLE state_licensed_provider
  ADD CONSTRAINT state_licensed_provider_license_status_normalized_check
  CHECK (
    license_status_normalized IS NULL
    OR license_status_normalized IN ('CURRENT', 'CLOSED_IN_LOCATOR')
  );

ALTER TABLE state_licensed_provider
  ADD CONSTRAINT state_licensed_provider_external_key_format_check
  CHECK (
    external_key = ('FL|AHCA|' || provider_class || '|' || ahca_file_number)
  );

COMMENT ON COLUMN state_licensed_provider.license_status_normalized IS
  'Only CURRENT or CLOSED_IN_LOCATOR until additional raw AHCA values are observed. Never replaces license_status_raw.';
COMMENT ON COLUMN state_licensed_provider.external_key IS
  'Deterministic FL|AHCA|{provider_class}|{ahca_file_number}. Not a second identity grain.';

COMMIT;
