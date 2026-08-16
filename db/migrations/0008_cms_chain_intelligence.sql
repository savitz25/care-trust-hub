BEGIN;
CREATE TABLE cms_chain (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cms_chain_id text NOT NULL UNIQUE CHECK (btrim(cms_chain_id) <> ''),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_chain_performance_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES cms_chain(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL REFERENCES raw_source_object(id),
  ingest_run_id uuid NOT NULL REFERENCES ingest_run(id),
  release_month date NOT NULL,
  chain_name text NOT NULL,
  published_facility_count integer NOT NULL CHECK (published_facility_count >= 0),
  published_state_count integer NOT NULL CHECK (published_state_count >= 0),
  metrics jsonb NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL,
  transformation_version text NOT NULL,
  UNIQUE(chain_id, source_release_id)
);
CREATE TABLE cms_chain_provider (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chain_id uuid NOT NULL REFERENCES cms_chain(id),
  provider_id uuid REFERENCES provider(id),
  provider_identifier text NOT NULL,
  enrollment_id text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL REFERENCES raw_source_object(id),
  ingest_run_id uuid NOT NULL REFERENCES ingest_run(id),
  chain_name text NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL,
  transformation_version text NOT NULL,
  UNIQUE(source_release_id,enrollment_id)
);
CREATE TABLE cms_chain_organization (
  chain_id uuid NOT NULL REFERENCES cms_chain(id),
  organization_id uuid NOT NULL REFERENCES organization(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_record_locator text NOT NULL,
  relationship_role text NOT NULL,
  PRIMARY KEY(chain_id,organization_id,source_release_id)
);
CREATE INDEX cms_chain_snapshot_current_idx ON cms_chain_performance_snapshot(chain_id,release_month DESC);
CREATE INDEX cms_chain_provider_provider_idx ON cms_chain_provider(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX cms_chain_provider_chain_idx ON cms_chain_provider(chain_id);
CREATE INDEX cms_chain_org_org_idx ON cms_chain_organization(organization_id);
COMMIT;
