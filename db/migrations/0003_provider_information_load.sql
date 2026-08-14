BEGIN;

ALTER TABLE source_release
  ADD COLUMN source_period text,
  ADD COLUMN source_modified_at timestamptz,
  ADD CONSTRAINT source_release_source_period_present
    CHECK (source_period IS NULL OR btrim(source_period) <> '');

ALTER TABLE raw_object
  ADD CONSTRAINT raw_object_id_release_unique UNIQUE (id, source_release_id);

ALTER TABLE ingest_run
  ADD CONSTRAINT ingest_run_id_release_unique UNIQUE (id, source_release_id),
  ADD CONSTRAINT ingest_run_release_transformation_unique
    UNIQUE (source_release_id, transformation_version);

ALTER TABLE facility_snapshot
  ALTER COLUMN ingest_run_id SET NOT NULL,
  ALTER COLUMN source_record_locator SET NOT NULL,
  ALTER COLUMN raw_record SET NOT NULL,
  ADD COLUMN raw_object_id uuid NOT NULL,
  ADD COLUMN provider_name text NOT NULL,
  ADD COLUMN legal_business_name text,
  ADD COLUMN address text,
  ADD COLUMN city text,
  ADD COLUMN state_code text NOT NULL,
  ADD COLUMN zip_code text,
  ADD COLUMN county_name text,
  ADD COLUMN telephone text,
  ADD COLUMN ownership_type text,
  ADD COLUMN certified_beds integer,
  ADD COLUMN participation_type text,
  ADD COLUMN participates_medicare boolean,
  ADD COLUMN participates_medicaid boolean,
  ADD COLUMN overall_rating smallint,
  ADD COLUMN health_inspection_rating smallint,
  ADD COLUMN staffing_rating smallint,
  ADD COLUMN quality_measure_rating smallint,
  ADD COLUMN source_latitude double precision,
  ADD COLUMN source_longitude double precision,
  ADD COLUMN location geography(Point, 4326),
  ADD CONSTRAINT facility_snapshot_raw_object_release_fk
    FOREIGN KEY (raw_object_id, source_release_id)
    REFERENCES raw_object(id, source_release_id),
  ADD CONSTRAINT facility_snapshot_ingest_run_release_fk
    FOREIGN KEY (ingest_run_id, source_release_id)
    REFERENCES ingest_run(id, source_release_id),
  ADD CONSTRAINT facility_snapshot_provider_name_present CHECK (btrim(provider_name) <> ''),
  ADD CONSTRAINT facility_snapshot_state_code_shape CHECK (state_code ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT facility_snapshot_certified_beds_nonnegative
    CHECK (certified_beds IS NULL OR certified_beds >= 0),
  ADD CONSTRAINT facility_snapshot_ratings_valid CHECK (
    (overall_rating IS NULL OR overall_rating BETWEEN 1 AND 5)
    AND (health_inspection_rating IS NULL OR health_inspection_rating BETWEEN 1 AND 5)
    AND (staffing_rating IS NULL OR staffing_rating BETWEEN 1 AND 5)
    AND (quality_measure_rating IS NULL OR quality_measure_rating BETWEEN 1 AND 5)
  ),
  ADD CONSTRAINT facility_snapshot_coordinate_pair CHECK (
    (source_latitude IS NULL AND source_longitude IS NULL AND location IS NULL)
    OR (
      source_latitude BETWEEN -90 AND 90
      AND source_longitude BETWEEN -180 AND 180
      AND location IS NOT NULL
    )
  );

CREATE INDEX facility_snapshot_state_code_idx ON facility_snapshot(state_code);
CREATE INDEX facility_snapshot_location_gix ON facility_snapshot USING gist(location);

COMMIT;
