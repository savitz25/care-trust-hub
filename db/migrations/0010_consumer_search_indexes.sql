BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX facility_snapshot_provider_name_trgm_idx ON facility_snapshot USING gin(provider_name gin_trgm_ops);
CREATE INDEX facility_snapshot_city_trgm_idx ON facility_snapshot USING gin(city gin_trgm_ops) WHERE city IS NOT NULL;
COMMIT;
