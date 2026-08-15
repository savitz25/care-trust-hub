BEGIN;

CREATE TABLE organization (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_identifier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organization(id),
  issuer text NOT NULL,
  identifier_type text NOT NULL,
  identifier_value text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  source_record_locator text NOT NULL,
  valid_from date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, identifier_type, identifier_value),
  CHECK (btrim(issuer) <> '' AND btrim(identifier_type) <> '' AND btrim(identifier_value) <> ''),
  CHECK (btrim(source_record_locator) <> ''),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

CREATE TABLE ownership_party (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_kind text NOT NULL CHECK (party_kind IN ('organization', 'individual')),
  organization_id uuid REFERENCES organization(id),
  source_identity_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(source_identity_key) <> '' AND btrim(display_name) <> ''),
  CHECK ((party_kind = 'organization' AND organization_id IS NOT NULL)
    OR (party_kind = 'individual' AND organization_id IS NULL)),
  UNIQUE NULLS NOT DISTINCT (party_kind, organization_id, source_identity_key)
);

CREATE TABLE provider_ownership_relationship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  provider_identifier text NOT NULL,
  ownership_party_id uuid NOT NULL REFERENCES ownership_party(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  relationship_key text NOT NULL,
  relationship_role_code text,
  relationship_role_text text NOT NULL,
  association_date date,
  ownership_percentage numeric(7,4) CHECK (ownership_percentage BETWEEN 0 AND 100),
  classifications jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(classifications)='object'),
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record)='object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, relationship_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (btrim(provider_identifier) <> '' AND btrim(relationship_role_text) <> ''),
  CHECK (btrim(source_record_locator) <> '' AND btrim(transformation_version) <> '')
);

CREATE TABLE organization_relationship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_organization_id uuid NOT NULL REFERENCES organization(id),
  object_organization_id uuid NOT NULL REFERENCES organization(id),
  relationship_type text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  relationship_key text NOT NULL,
  association_date date,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record)='object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, relationship_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (subject_organization_id <> object_organization_id),
  CHECK (btrim(relationship_type) <> '' AND btrim(source_record_locator) <> '')
);

CREATE TABLE ownership_change_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  provider_identifier text NOT NULL,
  buyer_organization_id uuid REFERENCES organization(id),
  seller_organization_id uuid REFERENCES organization(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  event_key text NOT NULL,
  change_type_code text NOT NULL,
  change_type_text text NOT NULL,
  effective_date date NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record)='object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, event_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (btrim(provider_identifier) <> '' AND btrim(change_type_text) <> ''),
  CHECK (btrim(source_record_locator) <> '' AND btrim(transformation_version) <> '')
);

CREATE TABLE ownership_source_notice (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  provider_identifier text NOT NULL,
  notice_text text NOT NULL,
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  notice_key text NOT NULL,
  source_record_locator text NOT NULL,
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record)='object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, notice_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK (btrim(provider_identifier) <> '' AND btrim(notice_text) <> ''),
  CHECK (btrim(source_record_locator) <> '' AND btrim(transformation_version) <> '')
);

CREATE INDEX organization_identifier_org_idx ON organization_identifier(organization_id);
CREATE INDEX ownership_party_org_idx ON ownership_party(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX provider_ownership_provider_idx ON provider_ownership_relationship(provider_id, association_date DESC)
  WHERE provider_id IS NOT NULL;
CREATE INDEX provider_ownership_party_idx ON provider_ownership_relationship(ownership_party_id);
CREATE INDEX provider_ownership_identifier_idx ON provider_ownership_relationship(provider_identifier);
CREATE INDEX organization_relationship_subject_idx ON organization_relationship(subject_organization_id);
CREATE INDEX organization_relationship_object_idx ON organization_relationship(object_organization_id);
CREATE INDEX ownership_change_provider_date_idx ON ownership_change_event(provider_id, effective_date DESC)
  WHERE provider_id IS NOT NULL;
CREATE INDEX ownership_change_identifier_date_idx ON ownership_change_event(provider_identifier, effective_date DESC);
CREATE INDEX ownership_source_notice_provider_idx ON ownership_source_notice(provider_id)
  WHERE provider_id IS NOT NULL;

COMMIT;
