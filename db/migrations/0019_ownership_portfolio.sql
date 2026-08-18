BEGIN;

CREATE TABLE ownership_portfolio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL UNIQUE REFERENCES organization(id),
  display_name text NOT NULL,
  current_facility_count integer NOT NULL CHECK (current_facility_count >= 0),
  historical_facility_count integer NOT NULL CHECK (historical_facility_count >= 0),
  uncertain_facility_count integer NOT NULL CHECK (uncertain_facility_count >= 0),
  state_count integer NOT NULL CHECK (state_count >= 0),
  states text[] NOT NULL,
  relationship_roles text[] NOT NULL,
  resolution_state text NOT NULL CHECK (resolution_state IN (
    'VERIFIED', 'PROBABLE', 'REVIEW_REQUIRED', 'REJECTED', 'UNRESOLVED'
  )),
  publication_eligible boolean NOT NULL,
  indexable boolean NOT NULL,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  snapshot_fingerprint text NOT NULL,
  derived_from_release_ids uuid[] NOT NULL,
  derived_at timestamptz NOT NULL DEFAULT now(),
  derivation_version text NOT NULL,
  schema_version integer NOT NULL DEFAULT 1,
  CHECK (btrim(display_name) <> ''),
  CHECK (btrim(snapshot_fingerprint) <> ''),
  CHECK (btrim(derivation_version) <> ''),
  CHECK (publication_eligible = false OR resolution_state = 'VERIFIED'),
  CHECK (indexable = false OR publication_eligible = true)
);

CREATE TABLE ownership_portfolio_member (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id),
  provider_id uuid NOT NULL REFERENCES provider(id),
  membership_status text NOT NULL CHECK (membership_status IN (
    'current', 'historical', 'uncertain'
  )),
  relationship_roles text[] NOT NULL,
  association_date date,
  first_seen_release_id uuid REFERENCES source_release(id),
  last_seen_release_id uuid REFERENCES source_release(id),
  fingerprint text NOT NULL UNIQUE,
  derivation_version text NOT NULL,
  derived_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, provider_id),
  CHECK (btrim(fingerprint) <> ''),
  CHECK (btrim(derivation_version) <> '')
);

CREATE INDEX ownership_portfolio_publish_idx
  ON ownership_portfolio (publication_eligible, indexable, current_facility_count DESC)
  WHERE publication_eligible;
CREATE INDEX ownership_portfolio_resolution_idx
  ON ownership_portfolio (resolution_state, current_facility_count DESC);
CREATE INDEX ownership_portfolio_member_org_status_idx
  ON ownership_portfolio_member (organization_id, membership_status);
CREATE INDEX ownership_portfolio_member_provider_idx
  ON ownership_portfolio_member (provider_id);
CREATE INDEX ownership_portfolio_member_current_idx
  ON ownership_portfolio_member (organization_id, provider_id)
  WHERE membership_status = 'current';

COMMIT;
