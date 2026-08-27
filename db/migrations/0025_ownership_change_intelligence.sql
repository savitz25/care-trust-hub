BEGIN;

-- SEN-NAT-007: classify existing SNF CHOW rows as first-class events.
-- Additive. Does not rewrite CCN identity, quality, ZIP coverage, or UNKNOWN edges.

ALTER TABLE ownership_change_event
  ADD COLUMN IF NOT EXISTS event_natural_key text,
  ADD COLUMN IF NOT EXISTS normalized_event_type text,
  ADD COLUMN IF NOT EXISTS event_status text,
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS source_dataset_key text,
  ADD COLUMN IF NOT EXISTS source_agency text,
  ADD COLUMN IF NOT EXISTS source_dataset_id text,
  ADD COLUMN IF NOT EXISTS buyer_pac_id text,
  ADD COLUMN IF NOT EXISTS seller_pac_id text,
  ADD COLUMN IF NOT EXISTS buyer_enrollment_id text,
  ADD COLUMN IF NOT EXISTS seller_enrollment_id text,
  ADD COLUMN IF NOT EXISTS source_observed_at timestamptz,
  ADD COLUMN IF NOT EXISTS first_seen_source_release_id uuid REFERENCES source_release(id),
  ADD COLUMN IF NOT EXISTS last_seen_source_release_id uuid REFERENCES source_release(id),
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS transformation_version_event text;

ALTER TABLE ownership_change_event
  DROP CONSTRAINT IF EXISTS ownership_change_event_type_check;
ALTER TABLE ownership_change_event
  ADD CONSTRAINT ownership_change_event_type_check CHECK (
    normalized_event_type IS NULL OR normalized_event_type IN (
      'CHANGE_OF_OWNERSHIP', 'ACQUISITION_MERGER', 'CONSOLIDATION', 'OTHER', 'UNKNOWN'
    )
  );
ALTER TABLE ownership_change_event
  DROP CONSTRAINT IF EXISTS ownership_change_event_status_check;
ALTER TABLE ownership_change_event
  ADD CONSTRAINT ownership_change_event_status_check CHECK (
    event_status IS NULL OR event_status IN ('CONFIRMED_EFFECTIVE')
  );
ALTER TABLE ownership_change_event
  DROP CONSTRAINT IF EXISTS ownership_change_event_confidence_check;
ALTER TABLE ownership_change_event
  ADD CONSTRAINT ownership_change_event_confidence_check CHECK (
    confidence IS NULL OR confidence IN (
      'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS ownership_change_event_natural_key_uidx
  ON ownership_change_event (event_natural_key)
  WHERE event_natural_key IS NOT NULL;

CREATE TABLE ownership_change_event_party (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES ownership_change_event(id),
  party_id uuid REFERENCES ownership_party(id),
  organization_id uuid REFERENCES organization(id),
  party_kind text CHECK (party_kind IS NULL OR party_kind IN ('organization', 'individual')),
  participant_role text NOT NULL CHECK (participant_role IN (
    'BUYER', 'SELLER', 'PRIOR_OWNER', 'NEW_OWNER', 'EVENT_PARTICIPANT', 'OTHER'
  )),
  source_party_key text NOT NULL,
  raw_name text,
  ownership_percentage numeric(7,4),
  raw_role_text text,
  confidence text NOT NULL CHECK (confidence IN (
    'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'
  )),
  source_record_locator text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  transformation_version text NOT NULL,
  UNIQUE (event_id, participant_role, source_party_key),
  CHECK (btrim(source_party_key) <> ''),
  CHECK (btrim(source_record_locator) <> '')
);

CREATE INDEX ownership_change_event_party_event_idx
  ON ownership_change_event_party (event_id, participant_role);
CREATE INDEX ownership_change_event_party_org_idx
  ON ownership_change_event_party (organization_id)
  WHERE organization_id IS NOT NULL;

CREATE TABLE ownership_change_relationship_link (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES ownership_change_event(id),
  provider_organization_edge_id uuid NOT NULL REFERENCES provider_organization_edge(id),
  link_role text NOT NULL CHECK (link_role IN (
    'PRE_EVENT_OWNER',
    'POST_EVENT_OWNER',
    'EVENT_PARTICIPANT',
    'HISTORICAL_OWNER_UNLINKED_TO_EVENT',
    'CURRENT_OWNER_UNLINKED_TO_EVENT',
    'UNKNOWN'
  )),
  confidence text NOT NULL CHECK (confidence IN (
    'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'
  )),
  transformation_version text NOT NULL,
  UNIQUE (event_id, provider_organization_edge_id)
);

CREATE INDEX ownership_change_rel_link_event_idx
  ON ownership_change_relationship_link (event_id, link_role);
CREATE INDEX ownership_change_rel_link_edge_idx
  ON ownership_change_relationship_link (provider_organization_edge_id);

CREATE OR REPLACE VIEW provider_ownership_timeline AS
SELECT
  e.provider_id,
  'OWNERSHIP_CHANGE_EVENT'::text AS evidence_type,
  e.effective_date AS evidence_date,
  'event_effective_date'::text AS date_basis,
  e.normalized_event_type AS subtype,
  e.change_type_text AS raw_label,
  e.confidence,
  e.source_dataset_key,
  e.source_release_id,
  e.id AS evidence_id
FROM ownership_change_event e
WHERE e.provider_id IS NOT NULL
UNION ALL
SELECT
  edge.provider_id,
  CASE edge.relationship_class
    WHEN 'OWNERSHIP' THEN 'OWNERSHIP_OBSERVATION'
    WHEN 'OPERATOR' THEN 'OPERATOR_OBSERVATION'
    WHEN 'MANAGEMENT' THEN 'MANAGEMENT_OBSERVATION'
    ELSE 'OWNERSHIP_OBSERVATION'
  END,
  COALESCE(edge.effective_from, edge.observed_at::date),
  CASE
    WHEN edge.effective_from IS NOT NULL THEN 'association_date'
    ELSE 'source_observed_date'
  END,
  edge.relationship_type,
  edge.raw_role_text,
  edge.confidence,
  edge.source_dataset_key,
  edge.source_release_id,
  edge.id
FROM provider_organization_edge edge
WHERE edge.provider_id IS NOT NULL
  AND edge.relationship_class IN ('OWNERSHIP', 'OPERATOR', 'MANAGEMENT', 'ENROLLMENT');

COMMENT ON TABLE ownership_change_event_party IS
  'SNF CHOW buyer/seller legal entities and enrollment-linked owner-info parties. PAC is identity, not parent company.';
COMMENT ON TABLE ownership_change_relationship_link IS
  'Links CHOW events to graph edges only when enrollment IDs match. Does not convert UNKNOWN into divestiture.';
COMMENT ON VIEW provider_ownership_timeline IS
  'Internal research timeline. Observations and events remain distinct evidence types.';
COMMENT ON COLUMN ownership_change_event.event_status IS
  'SNF CHOW publishes completed effective events only. PENDING/ANNOUNCED are not sourced.';
COMMENT ON COLUMN ownership_change_event.effective_date IS
  'CMS CHOW EFFECTIVE DATE. Not created_at and not source publication date.';

COMMIT;
