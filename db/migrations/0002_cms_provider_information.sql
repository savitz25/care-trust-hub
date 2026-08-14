BEGIN;

ALTER TABLE source_release
  ADD COLUMN official_source_url text,
  ADD COLUMN source_release_date date,
  ADD CONSTRAINT source_release_official_url_https
    CHECK (official_source_url IS NULL OR official_source_url ~ '^https://');

CREATE TABLE raw_object (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  content_type text NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_release_id, storage_key),
  CHECK (btrim(storage_key) <> ''),
  CHECK (btrim(original_filename) <> ''),
  CHECK (btrim(content_type) <> '')
);

CREATE TABLE ingest_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  transformation_version text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  started_at timestamptz NOT NULL,
  completed_at timestamptz,
  rows_read bigint NOT NULL DEFAULT 0 CHECK (rows_read >= 0),
  valid_rows bigint NOT NULL DEFAULT 0 CHECK (valid_rows >= 0),
  rejected_rows bigint NOT NULL DEFAULT 0 CHECK (rejected_rows >= 0),
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(transformation_version) <> ''),
  CHECK (completed_at IS NULL OR completed_at >= started_at),
  CHECK (valid_rows + rejected_rows <= rows_read)
);

ALTER TABLE facility_snapshot
  ADD COLUMN ingest_run_id uuid REFERENCES ingest_run(id),
  ADD COLUMN source_record_locator text,
  ADD COLUMN raw_record jsonb,
  ADD CONSTRAINT facility_snapshot_source_record_locator_present
    CHECK (source_record_locator IS NULL OR btrim(source_record_locator) <> ''),
  ADD CONSTRAINT facility_snapshot_raw_record_object
    CHECK (raw_record IS NULL OR jsonb_typeof(raw_record) = 'object');

CREATE INDEX raw_object_source_release_id_idx ON raw_object(source_release_id);
CREATE INDEX ingest_run_source_release_id_idx ON ingest_run(source_release_id);
CREATE INDEX facility_snapshot_ingest_run_id_idx ON facility_snapshot(ingest_run_id);
CREATE INDEX facility_snapshot_source_record_locator_idx
  ON facility_snapshot(source_release_id, source_record_locator);

COMMIT;
