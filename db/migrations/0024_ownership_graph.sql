BEGIN;

-- SEN-NAT-004: classified, time-aware projection of existing CMS/PECOS ownership.
-- Additive. Does not rewrite provider_ownership_relationship or CCNs.

CREATE TABLE organization_name_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id),
  name_text text NOT NULL,
  name_kind text NOT NULL CHECK (name_kind IN ('legal', 'dba', 'observed')),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_record_locator text NOT NULL,
  observed_at timestamptz,
  transformation_version text NOT NULL,
  UNIQUE (organization_id, name_text, name_kind, source_release_id),
  CHECK (btrim(name_text) <> '')
);

CREATE TABLE provider_organization_edge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  provider_type text,
  ownership_party_id uuid NOT NULL REFERENCES ownership_party(id),
  organization_id uuid REFERENCES organization(id),
  party_kind text NOT NULL CHECK (party_kind IN ('organization', 'individual')),
  relationship_type text NOT NULL CHECK (relationship_type IN (
    'OWNED_BY', 'OPERATED_BY', 'MANAGED_BY', 'ENROLLED_UNDER', 'AFFILIATED_WITH'
  )),
  relationship_class text NOT NULL CHECK (relationship_class IN (
    'OWNERSHIP', 'OPERATOR', 'MANAGEMENT', 'ENROLLMENT', 'OFFICER',
    'AUTHORIZED_OFFICIAL', 'AFFILIATION', 'OTHER'
  )),
  normalized_role text NOT NULL,
  raw_role_text text NOT NULL,
  raw_role_code text,
  ownership_percentage numeric(7,4),
  temporal_status text NOT NULL CHECK (temporal_status IN ('CURRENT', 'HISTORICAL', 'UNKNOWN')),
  confidence text NOT NULL CHECK (confidence IN (
    'CONFIRMED', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'UNRESOLVED'
  )),
  effective_from date,
  effective_to date,
  observed_at timestamptz,
  ingested_at timestamptz,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_dataset_key text NOT NULL,
  source_record_locator text NOT NULL,
  provider_ownership_relationship_id uuid NOT NULL UNIQUE
    REFERENCES provider_ownership_relationship(id),
  transformation_version text NOT NULL,
  CHECK (btrim(raw_role_text) <> ''),
  CHECK (btrim(source_dataset_key) <> ''),
  CHECK (party_kind = 'individual' OR organization_id IS NOT NULL)
);

CREATE INDEX provider_organization_edge_provider_idx
  ON provider_organization_edge (provider_id, relationship_type, temporal_status)
  WHERE provider_id IS NOT NULL;
CREATE INDEX provider_organization_edge_org_idx
  ON provider_organization_edge (organization_id, relationship_type)
  WHERE organization_id IS NOT NULL;
CREATE INDEX provider_organization_edge_class_idx
  ON provider_organization_edge (relationship_class, temporal_status);
CREATE INDEX organization_name_org_idx ON organization_name_observation (organization_id);

COMMENT ON TABLE provider_organization_edge IS
  'Classified projection of CMS/PECOS provider-party rows. PAC is PECOS organization identity, not parent company.';
COMMENT ON COLUMN provider_organization_edge.temporal_status IS
  'CURRENT = in latest succeeded snapshot of that dataset. UNKNOWN = older snapshot, not proven divestiture. HISTORICAL = explicit change/end evidence.';

COMMIT;
