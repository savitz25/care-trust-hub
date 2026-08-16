BEGIN;

CREATE TABLE location_reference (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type text NOT NULL CHECK (location_type IN ('CENSUS_ZCTA')),
  location_code text NOT NULL CHECK (location_code ~ '^[0-9]{5}$'),
  latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  location geography(Point, 4326) NOT NULL,
  source_organization text NOT NULL,
  source_name text NOT NULL,
  source_version text NOT NULL,
  source_url text NOT NULL,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  retrieved_at timestamptz NOT NULL,
  methodology_note text NOT NULL,
  UNIQUE (location_type, location_code, source_version)
);

CREATE INDEX location_reference_code_current_idx
  ON location_reference(location_type, location_code, source_version DESC);
CREATE INDEX location_reference_location_gix ON location_reference USING gist(location);

COMMIT;
