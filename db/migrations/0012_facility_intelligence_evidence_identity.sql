BEGIN;

CREATE TYPE facility_source_authority AS ENUM (
  'federal_healthcare',
  'state_healthcare_regulator',
  'government_legal',
  'official_organization',
  'commercial_corroboration',
  'consumer_reputation'
);

CREATE TYPE facility_resolution_state AS ENUM (
  'VERIFIED', 'PROBABLE', 'REVIEW_REQUIRED', 'REJECTED', 'UNRESOLVED'
);

CREATE TYPE facility_review_status AS ENUM ('open', 'in_review', 'decided', 'deferred');

CREATE TABLE facility_intelligence_run (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (btrim(source_type) <> ''),
  adapter_version text NOT NULL CHECK (btrim(adapter_version) <> ''),
  resolver_version text NOT NULL CHECK (btrim(resolver_version) <> ''),
  run_mode text NOT NULL CHECK (run_mode IN ('dry_run', 'pilot', 'bounded_backfill')),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'running', 'succeeded', 'failed', 'cancelled', 'budget_exhausted')),
  requested_facility_count integer NOT NULL DEFAULT 0 CHECK (requested_facility_count >= 0),
  maximum_requests integer NOT NULL DEFAULT 0 CHECK (maximum_requests >= 0),
  used_requests integer NOT NULL DEFAULT 0 CHECK (used_requests BETWEEN 0 AND maximum_requests),
  cache_hits integer NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
  successes integer NOT NULL DEFAULT 0 CHECK (successes >= 0),
  failures integer NOT NULL DEFAULT 0 CHECK (failures >= 0),
  unresolved integer NOT NULL DEFAULT 0 CHECK (unresolved >= 0),
  review_required integer NOT NULL DEFAULT 0 CHECK (review_required >= 0),
  requested_facility_fingerprint text NOT NULL CHECK (requested_facility_fingerprint ~ '^[0-9a-f]{64}$'),
  release_fingerprint text CHECK (release_fingerprint IS NULL OR release_fingerprint ~ '^[0-9a-f]{64}$'),
  resume_cursor text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (completed_at IS NULL OR started_at IS NOT NULL),
  CHECK (run_mode <> 'dry_run' OR maximum_requests = 0)
);

CREATE TABLE facility_intelligence_run_provider (
  run_id uuid NOT NULL REFERENCES facility_intelligence_run(id),
  provider_id uuid NOT NULL REFERENCES provider(id),
  cms_ccn text NOT NULL CHECK (cms_ccn ~ '^[A-Z0-9]{6}$'),
  ordinal integer NOT NULL CHECK (ordinal > 0),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'unresolved', 'review_required')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error_code text,
  completed_at timestamptz,
  PRIMARY KEY (run_id, provider_id),
  UNIQUE (run_id, ordinal)
);

CREATE TABLE facility_source_observation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  canonical_ccn text CHECK (canonical_ccn IS NULL OR canonical_ccn ~ '^[A-Z0-9]{6}$'),
  source_type text NOT NULL CHECK (btrim(source_type) <> ''),
  source_authority facility_source_authority NOT NULL,
  source_identifier text NOT NULL CHECK (btrim(source_identifier) <> ''),
  source_record_identifier text NOT NULL CHECK (btrim(source_record_identifier) <> ''),
  observation_type text NOT NULL CHECK (btrim(observation_type) <> ''),
  observed_value jsonb NOT NULL CHECK (jsonb_typeof(observed_value) IN ('object', 'array', 'string', 'number', 'boolean', 'null')),
  normalized_value text,
  observed_name text,
  observed_address text,
  observed_phone text,
  observed_url text CHECK (observed_url IS NULL OR observed_url ~ '^https://'),
  observed_location geography(Point, 4326),
  observed_at timestamptz,
  source_published_at timestamptz,
  retrieved_at timestamptz NOT NULL,
  source_url text CHECK (source_url IS NULL OR source_url ~ '^https://'),
  source_release_id uuid REFERENCES source_release(id),
  release_identifier text NOT NULL CHECK (btrim(release_identifier) <> ''),
  raw_object_id uuid REFERENCES raw_object(id),
  ingest_run_id uuid REFERENCES ingest_run(id),
  intelligence_run_id uuid REFERENCES facility_intelligence_run(id),
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(provenance) = 'object'),
  evidence_fingerprint text NOT NULL CHECK (evidence_fingerprint ~ '^[0-9a-f]{64}$'),
  adapter_version text NOT NULL CHECK (btrim(adapter_version) <> ''),
  status text NOT NULL DEFAULT 'observed'
    CHECK (status IN ('observed', 'superseded', 'withdrawn', 'invalidated')),
  supersedes_observation_id uuid REFERENCES facility_source_observation(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, source_identifier, source_record_identifier, observation_type,
    release_identifier, evidence_fingerprint),
  CHECK (provider_id IS NOT NULL OR canonical_ccn IS NULL),
  CHECK (supersedes_observation_id IS NULL OR supersedes_observation_id <> id)
);

CREATE TABLE facility_external_identifier (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid REFERENCES provider(id),
  organization_id uuid REFERENCES organization(id),
  chain_id uuid REFERENCES cms_chain(id),
  namespace text NOT NULL CHECK (btrim(namespace) <> ''),
  identifier_type text NOT NULL CHECK (btrim(identifier_type) <> ''),
  identifier_value text NOT NULL CHECK (btrim(identifier_value) <> ''),
  normalized_value text NOT NULL CHECK (btrim(normalized_value) <> ''),
  source_observation_id uuid NOT NULL REFERENCES facility_source_observation(id),
  verification_state facility_resolution_state NOT NULL,
  valid_from date,
  valid_to date,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (namespace, identifier_type, normalized_value, valid_from),
  CHECK (num_nonnulls(provider_id, organization_id, chain_id) = 1),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from),
  CHECK ((verification_state = 'VERIFIED' AND verified_at IS NOT NULL)
    OR verification_state <> 'VERIFIED')
);

CREATE TABLE facility_claim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  claim_type text NOT NULL CHECK (btrim(claim_type) <> ''),
  claim_value jsonb NOT NULL,
  normalized_value text,
  resolved_organization_id uuid REFERENCES organization(id),
  external_identifier_id uuid REFERENCES facility_external_identifier(id),
  resolution_state facility_resolution_state NOT NULL,
  confidence numeric(7,6) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  resolution_method text NOT NULL CHECK (btrim(resolution_method) <> ''),
  resolution_reason text NOT NULL CHECK (btrim(resolution_reason) <> ''),
  matching_features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(matching_features) = 'array'),
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conflicts) = 'array'),
  threshold_version text NOT NULL CHECK (btrim(threshold_version) <> ''),
  effective_from date,
  effective_to date,
  resolved_at timestamptz NOT NULL,
  resolver_reference text NOT NULL CHECK (btrim(resolver_reference) <> ''),
  review_state facility_review_status NOT NULL DEFAULT 'open',
  publication_eligible boolean NOT NULL DEFAULT false,
  supersedes_claim_id uuid REFERENCES facility_claim(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CHECK (supersedes_claim_id IS NULL OR supersedes_claim_id <> id),
  CHECK (publication_eligible = false OR resolution_state = 'VERIFIED')
);

CREATE TABLE facility_claim_observation (
  claim_id uuid NOT NULL REFERENCES facility_claim(id),
  observation_id uuid NOT NULL REFERENCES facility_source_observation(id),
  evidence_role text NOT NULL CHECK (evidence_role IN ('supporting', 'conflicting')),
  PRIMARY KEY (claim_id, observation_id, evidence_role)
);

CREATE TABLE facility_identity_candidate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  canonical_ccn text NOT NULL CHECK (canonical_ccn ~ '^[A-Z0-9]{6}$'),
  source_type text NOT NULL CHECK (btrim(source_type) <> ''),
  external_identifier_namespace text NOT NULL,
  external_identifier_value text NOT NULL,
  candidate_name text,
  candidate_address text,
  candidate_phone text,
  candidate_website text CHECK (candidate_website IS NULL OR candidate_website ~ '^https://'),
  candidate_location geography(Point, 4326),
  business_status text,
  matching_features jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(matching_features) = 'array'),
  conflicts jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conflicts) = 'array'),
  confidence numeric(7,6) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  resolution_state facility_resolution_state NOT NULL DEFAULT 'UNRESOLVED',
  threshold_version text NOT NULL,
  source_observation_id uuid NOT NULL REFERENCES facility_source_observation(id),
  discovered_at timestamptz NOT NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, source_type, external_identifier_namespace, external_identifier_value,
    source_observation_id)
);

CREATE TABLE facility_external_request_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  operation text NOT NULL,
  cache_key text NOT NULL CHECK (btrim(cache_key) <> ''),
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  response_fingerprint text NOT NULL CHECK (response_fingerprint ~ '^[0-9a-f]{64}$'),
  response_payload jsonb NOT NULL,
  field_mask text NOT NULL CHECK (btrim(field_mask) <> '' AND field_mask NOT LIKE '%*%'),
  retrieved_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  adapter_version text NOT NULL,
  intelligence_run_id uuid REFERENCES facility_intelligence_run(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_type, operation, cache_key, field_mask, adapter_version),
  CHECK (expires_at > retrieved_at)
);

CREATE TABLE facility_review_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  claim_id uuid REFERENCES facility_claim(id),
  candidate_id uuid REFERENCES facility_identity_candidate(id),
  review_type text NOT NULL CHECK (review_type IN (
    'multiple_candidates', 'address_conflict', 'phone_conflict', 'website_conflict',
    'facility_rename', 'closure_conflict', 'ownership_mismatch', 'chain_ambiguity',
    'authority_conflict', 'state_cms_disagreement'
  )),
  status facility_review_status NOT NULL DEFAULT 'open',
  priority smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  evidence_summary jsonb NOT NULL CHECK (jsonb_typeof(evidence_summary) = 'object'),
  assigned_reviewer_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  CHECK (claim_id IS NOT NULL OR candidate_id IS NOT NULL),
  CHECK ((status = 'decided' AND decided_at IS NOT NULL) OR status <> 'decided')
);

CREATE TABLE facility_review_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_item_id uuid NOT NULL REFERENCES facility_review_item(id),
  action text NOT NULL CHECK (action IN ('verify', 'reject', 'leave_unresolved', 'mark_probable', 'defer', 'note')),
  previous_state facility_resolution_state,
  new_state facility_resolution_state,
  actor_kind text NOT NULL CHECK (actor_kind IN ('reviewer', 'system')),
  actor_reference text NOT NULL CHECK (btrim(actor_reference) <> ''),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  rule_version text NOT NULL CHECK (btrim(rule_version) <> ''),
  supporting_observation_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action = 'note' OR new_state IS NOT NULL)
);

CREATE TABLE facility_resolution_audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  claim_id uuid REFERENCES facility_claim(id),
  candidate_id uuid REFERENCES facility_identity_candidate(id),
  previous_state facility_resolution_state,
  new_state facility_resolution_state NOT NULL,
  resolver_kind text NOT NULL CHECK (resolver_kind IN ('system', 'reviewer')),
  resolver_reference text NOT NULL,
  resolution_method text NOT NULL,
  reason text NOT NULL,
  rule_version text NOT NULL,
  supporting_observation_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (claim_id IS NOT NULL OR candidate_id IS NOT NULL)
);

CREATE FUNCTION facility_intelligence_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;

CREATE TRIGGER facility_observation_append_only BEFORE UPDATE OR DELETE ON facility_source_observation
  FOR EACH ROW EXECUTE FUNCTION facility_intelligence_append_only();
CREATE TRIGGER facility_claim_append_only BEFORE UPDATE OR DELETE ON facility_claim
  FOR EACH ROW EXECUTE FUNCTION facility_intelligence_append_only();
CREATE TRIGGER facility_review_action_append_only BEFORE UPDATE OR DELETE ON facility_review_action
  FOR EACH ROW EXECUTE FUNCTION facility_intelligence_append_only();
CREATE TRIGGER facility_resolution_audit_append_only BEFORE UPDATE OR DELETE ON facility_resolution_audit_event
  FOR EACH ROW EXECUTE FUNCTION facility_intelligence_append_only();

CREATE INDEX facility_observation_provider_type_idx
  ON facility_source_observation(provider_id, observation_type, observed_at DESC NULLS LAST);
CREATE INDEX facility_observation_source_record_idx
  ON facility_source_observation(source_type, source_identifier, source_record_identifier);
CREATE INDEX facility_observation_fingerprint_idx ON facility_source_observation(evidence_fingerprint);
CREATE INDEX facility_observation_location_gix ON facility_source_observation USING gist(observed_location);
CREATE INDEX facility_external_identifier_provider_idx
  ON facility_external_identifier(provider_id, namespace, identifier_type) WHERE provider_id IS NOT NULL;
CREATE INDEX facility_claim_history_idx
  ON facility_claim(provider_id, claim_type, resolved_at DESC);
CREATE INDEX facility_claim_public_idx
  ON facility_claim(provider_id, claim_type) WHERE publication_eligible;
CREATE INDEX facility_candidate_review_idx
  ON facility_identity_candidate(resolution_state, provider_id, discovered_at);
CREATE INDEX facility_candidate_location_gix ON facility_identity_candidate USING gist(candidate_location);
CREATE INDEX facility_cache_fresh_idx
  ON facility_external_request_cache(source_type, operation, cache_key, expires_at DESC);
CREATE INDEX facility_review_queue_idx ON facility_review_item(status, priority, created_at);
CREATE INDEX facility_resolution_audit_provider_idx
  ON facility_resolution_audit_event(provider_id, created_at DESC);

-- Deterministic CMS-only backfill: one immutable identity observation per existing snapshot.
INSERT INTO facility_source_observation (
  provider_id, canonical_ccn, source_type, source_authority, source_identifier,
  source_record_identifier, observation_type, observed_value, normalized_value,
  observed_name, observed_address, observed_phone, observed_location, observed_at,
  source_published_at, retrieved_at, source_url, source_release_id, release_identifier,
  raw_object_id, ingest_run_id, provenance, evidence_fingerprint, adapter_version
)
SELECT fs.provider_id, pi.identifier_value, 'cms_provider_information', 'federal_healthcare',
  sd.dataset_key, fs.source_record_locator, 'facility_identity',
  jsonb_build_object('name', fs.provider_name, 'address', fs.address, 'city', fs.city,
    'state', fs.state_code, 'zip', fs.zip_code, 'phone', fs.telephone),
  lower(regexp_replace(fs.provider_name, '[^a-zA-Z0-9]+', ' ', 'g')),
  fs.provider_name, concat_ws(', ', fs.address, fs.city, fs.state_code, fs.zip_code),
  fs.telephone, fs.location, fs.observed_at, sr.source_published_at, fs.retrieved_at,
  sd.official_url, fs.source_release_id, sr.release_key, fs.raw_object_id, fs.ingest_run_id,
  jsonb_build_object('transformation_version', fs.transformation_version,
    'source_record_locator', fs.source_record_locator),
  encode(digest(concat_ws('|', fs.id::text, fs.source_release_id::text,
    fs.transformation_version, fs.source_record_locator), 'sha256'), 'hex'),
  'cms-facility-identity-backfill-v1'
FROM facility_snapshot fs
JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
  AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN' AND pi.valid_from IS NULL
JOIN source_release sr ON sr.id = fs.source_release_id
JOIN source_dataset sd ON sd.id = sr.source_dataset_id
ON CONFLICT DO NOTHING;

INSERT INTO facility_external_identifier (
  provider_id, namespace, identifier_type, identifier_value, normalized_value,
  source_observation_id, verification_state, valid_from, valid_to, verified_at
)
SELECT pi.provider_id, 'CMS', 'CCN', pi.identifier_value, pi.identifier_value, o.id,
  'VERIFIED', pi.valid_from, pi.valid_to, now()
FROM provider_identifier pi
JOIN LATERAL (
  SELECT id FROM facility_source_observation
  WHERE provider_id = pi.provider_id AND source_type = 'cms_provider_information'
  ORDER BY observed_at DESC NULLS LAST, created_at DESC LIMIT 1
) o ON true
WHERE pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
ON CONFLICT DO NOTHING;

INSERT INTO facility_claim (
  provider_id, claim_type, claim_value, normalized_value, resolution_state, confidence,
  resolution_method, resolution_reason, matching_features, threshold_version,
  resolved_at, resolver_reference, review_state, publication_eligible
)
SELECT o.provider_id, 'canonical_public_name', to_jsonb(o.observed_name), o.normalized_value,
  'VERIFIED', 1, 'authoritative_identifier_backfill',
  'CMS facility identity is linked through the canonical CMS CCN',
  jsonb_build_array(jsonb_build_object('feature', 'cms_ccn', 'outcome', 'match')),
  'cms-facility-identity-v1', now(), 'system:cms-facility-identity-backfill-v1', 'decided', true
FROM facility_source_observation o
WHERE o.source_type = 'cms_provider_information' AND o.observation_type = 'facility_identity'
  AND o.observed_name IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO facility_claim_observation (claim_id, observation_id, evidence_role)
SELECT c.id, o.id, 'supporting'
FROM facility_claim c JOIN facility_source_observation o
  ON o.provider_id = c.provider_id AND o.normalized_value = c.normalized_value
WHERE c.resolver_reference = 'system:cms-facility-identity-backfill-v1'
  AND o.source_type = 'cms_provider_information'
ON CONFLICT DO NOTHING;

-- Source spreadsheets can drop a leading zero from numeric CMS CCNs. Resolve only exact,
-- unique issuer-scoped matches; preserve every source row and its original identifier.
UPDATE provider_ownership_relationship r
SET provider_id = pi.provider_id
FROM source_release sr, source_dataset sd, provider_identifier pi
WHERE r.provider_id IS NULL
  AND r.source_release_id = sr.id AND sr.source_dataset_id = sd.id
  AND sd.dataset_key = 'skilled-nursing-facility-enrollments'
  AND r.provider_identifier ~ '^[0-9]{5}$'
  AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
  AND pi.identifier_value = lpad(r.provider_identifier, 6, '0');

UPDATE cms_chain_provider cp
SET provider_id = pi.provider_id
FROM provider_identifier pi
WHERE cp.provider_id IS NULL AND cp.provider_identifier ~ '^[0-9]{5}$'
  AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
  AND pi.identifier_value = lpad(cp.provider_identifier, 6, '0');

COMMIT;
