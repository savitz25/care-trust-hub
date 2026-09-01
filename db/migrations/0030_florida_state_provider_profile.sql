BEGIN;

-- FL-SEN-006: internal bounded Florida provider profile projections.
-- Additive. Does not publish providers, alter CMS identity, or dual-write ALF.

CREATE TABLE state_provider_profile (
  provider_id uuid PRIMARY KEY REFERENCES state_licensed_provider(id) ON DELETE CASCADE,
  contract_version text NOT NULL CHECK (contract_version = 'fl-sen-provider-v1'),
  profile_kind text NOT NULL CHECK (profile_kind IN (
    'assisted-living',
    'adult-family-care',
    'home-health',
    'hospice',
    'nursing-home'
  )),
  ahca_file_number text NOT NULL,
  slug text NOT NULL,
  future_path text NOT NULL,
  payload jsonb NOT NULL,
  publication_state text NOT NULL CHECK (publication_state = 'internal_only'),
  computed_at timestamptz NOT NULL,
  source_fingerprint text NOT NULL,
  UNIQUE (profile_kind, ahca_file_number),
  UNIQUE (future_path),
  CHECK (btrim(ahca_file_number) <> ''),
  CHECK (btrim(slug) <> ''),
  CHECK (btrim(future_path) <> ''),
  CHECK (btrim(source_fingerprint) <> ''),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (payload ? 'identity'),
  CHECK (payload ? 'regulatory'),
  CHECK ((payload -> 'score') IS NULL),
  CHECK ((payload -> 'rank') IS NULL)
);

CREATE INDEX state_provider_profile_kind_slug_idx
  ON state_provider_profile (profile_kind, slug);
CREATE INDEX state_provider_profile_fingerprint_idx
  ON state_provider_profile (source_fingerprint);

COMMENT ON TABLE state_provider_profile IS
  'FL-SEN-006 internal Florida P0 profile projections. Not public. Not a CMS provider table. publication_state is internal_only until a later publication gate.';
COMMENT ON COLUMN state_provider_profile.slug IS
  'Name slug only. Durable identity is (profile_kind, ahca_file_number).';
COMMENT ON COLUMN state_provider_profile.future_path IS
  'Reserved path /florida/{kind}/{file}/{slug}. Not crawlable in this task.';

COMMIT;
