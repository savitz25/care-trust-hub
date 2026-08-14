BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE evidence_origin AS ENUM ('official', 'facility_reported', 'derived');

CREATE TABLE source_dataset (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_key text NOT NULL UNIQUE,
  source_organization text NOT NULL,
  display_name text NOT NULL,
  official_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(dataset_key) <> ''),
  CHECK (btrim(source_organization) <> ''),
  CHECK (btrim(display_name) <> '')
);

CREATE TABLE source_release (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dataset_id uuid NOT NULL REFERENCES source_dataset(id),
  release_key text NOT NULL,
  source_published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_dataset_id, release_key),
  CHECK (btrim(release_key) <> '')
);

CREATE TABLE provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(provider_type) <> '')
);

CREATE TABLE provider_identifier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  issuer text NOT NULL,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  valid_from date,
  valid_to date,
  UNIQUE NULLS NOT DISTINCT (issuer, identifier_type, identifier_value, valid_from),
  CHECK (btrim(issuer) <> ''),
  CHECK (btrim(identifier_type) <> ''),
  CHECK (btrim(identifier_value) <> ''),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE facility_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  effective_at timestamptz,
  observed_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  attributes jsonb NOT NULL,
  transformation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, source_release_id, transformation_version),
  CHECK (jsonb_typeof(attributes) = 'object'),
  CHECK (btrim(transformation_version) <> '')
);

CREATE TABLE evidence_assertion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  source_release_id uuid REFERENCES source_release(id),
  origin evidence_origin NOT NULL,
  claim_type text NOT NULL,
  claim_value jsonb NOT NULL,
  source_record_locator text,
  observed_at timestamptz,
  transformation_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(claim_type) <> ''),
  CHECK (btrim(transformation_version) <> ''),
  CHECK (
    origin <> 'official'
    OR (
      source_release_id IS NOT NULL
      AND source_record_locator IS NOT NULL
      AND btrim(source_record_locator) <> ''
    )
  )
);

CREATE INDEX provider_identifier_provider_id_idx ON provider_identifier(provider_id);
CREATE INDEX facility_snapshot_provider_id_idx ON facility_snapshot(provider_id);
CREATE INDEX facility_snapshot_source_release_id_idx ON facility_snapshot(source_release_id);
CREATE INDEX evidence_assertion_provider_id_idx ON evidence_assertion(provider_id);
CREATE INDEX evidence_assertion_source_release_id_idx ON evidence_assertion(source_release_id);

COMMIT;
