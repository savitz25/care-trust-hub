BEGIN;

-- NJ-SEN-002: reusable state facility documents, actions, and match ledger.
-- Additive. Reuses state_source_snapshot. Does not publish /new-jersey.
-- Does not rewrite CMS inspection/deficiency tables or Florida AHCA events.
-- Penalty dollars are stored as amounts, never as a rating.

CREATE TABLE state_facility_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text NOT NULL UNIQUE,
  state_code char(2) NOT NULL,
  regulator_code text NOT NULL,
  dataset_key text NOT NULL,
  source_document_id text NOT NULL,
  source_document_url text NOT NULL,
  document_title text,
  document_kind text NOT NULL CHECK (document_kind IN (
    'penalty_letter',
    'enforcement_order',
    'inspection_index',
    'inspection_sod',
    'inspection_poc',
    'other'
  )),
  printed_facility_name text,
  printed_license_number text,
  printed_source_facility_id text,
  printed_street text,
  printed_city text,
  printed_county text,
  printed_zip text,
  document_date date,
  effective_date date,
  end_date date,
  remedy_type_raw text NOT NULL,
  remedy_type_canonical text NOT NULL,
  penalty_amount_cents bigint CHECK (penalty_amount_cents IS NULL OR penalty_amount_cents >= 0),
  admission_curtailment boolean,
  admission_curtailment_start date,
  admission_curtailment_end date,
  conditional_license boolean,
  conditional_license_start date,
  conditional_license_end date,
  legal_citation text,
  source_agency text NOT NULL,
  content_sha256 text CHECK (content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'),
  file_size_bytes integer CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  page_count integer CHECK (page_count IS NULL OR page_count >= 0),
  text_extraction_status text NOT NULL CHECK (text_extraction_status IN (
    'extracted',
    'partial',
    'no_text_layer',
    'encrypted',
    'corrupt',
    'not_downloaded',
    'failed',
    'not_applicable'
  )),
  corpus_scope text CHECK (
    corpus_scope IS NULL OR corpus_scope IN (
      'NJ_LTC_FACILITY_MATCHED',
      'LIKELY_NJ_LTC_REVIEW_REQUIRED',
      'NJ_ACUTE_OR_OTHER_HEALTH_FACILITY',
      'NON_FACILITY_OR_AGENCY_DOCUMENT',
      'UNRESOLVED_SCOPE',
      'SOURCE_DOCUMENT_UNAVAILABLE'
    )
  ),
  document_class text,
  is_proposed boolean,
  document_fingerprint text NOT NULL,
  extraction_confidence text NOT NULL CHECK (extraction_confidence IN (
    'high', 'medium', 'low', 'none'
  )),
  status_raw text CHECK (
    status_raw IS NULL OR status_raw IN ('current', 'historical', 'resolved', 'unknown')
  ),
  is_final boolean,
  evidence_track text CHECK (
    evidence_track IS NULL OR evidence_track IN ('CMS_FORM', 'STATE_FORM', 'UNKNOWN')
  ),
  public_eligible boolean NOT NULL DEFAULT false,
  publication_state text NOT NULL CHECK (publication_state IN (
    'PUBLISHABLE_CURRENT',
    'PUBLISHABLE_WITH_STATUS',
    'HISTORICAL_ONLY',
    'NOT_CURRENTLY_PUBLISHABLE',
    'REVIEW_REQUIRED'
  )),
  facility_id uuid REFERENCES state_facility_identity(id),
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_code, regulator_code, source_document_id),
  CHECK (btrim(external_key) <> ''),
  CHECK (btrim(source_document_id) <> ''),
  CHECK (btrim(source_document_url) <> ''),
  CHECK (btrim(remedy_type_raw) <> ''),
  CHECK (btrim(remedy_type_canonical) <> ''),
  CHECK (btrim(source_agency) <> ''),
  CHECK (btrim(document_fingerprint) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_facility_action (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES state_facility_document(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES state_facility_identity(id),
  state_code char(2) NOT NULL,
  regulator_code text NOT NULL,
  event_identity text NOT NULL,
  event_type_raw text NOT NULL,
  event_type_canonical text NOT NULL,
  event_date date,
  effective_date date,
  end_date date,
  penalty_amount_cents bigint CHECK (penalty_amount_cents IS NULL OR penalty_amount_cents >= 0),
  status_raw text CHECK (
    status_raw IS NULL OR status_raw IN ('current', 'historical', 'resolved', 'unknown')
  ),
  is_final boolean,
  baseline_only boolean NOT NULL DEFAULT true,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  adapter_version text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regulator_code, event_identity),
  CHECK (btrim(event_identity) <> ''),
  CHECK (btrim(event_type_raw) <> ''),
  CHECK (btrim(event_type_canonical) <> ''),
  CHECK (jsonb_typeof(raw) = 'object')
);

CREATE TABLE state_facility_document_match_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES state_facility_document(id) ON DELETE CASCADE,
  facility_id uuid REFERENCES state_facility_identity(id),
  match_bucket text NOT NULL CHECK (match_bucket IN (
    'EXACT', 'HIGH_CONFIDENCE', 'REVIEW_REQUIRED', 'CONFLICT', 'UNRESOLVED', 'UNSAFE_REJECTED'
  )),
  match_method text NOT NULL,
  reason text NOT NULL,
  candidate_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (btrim(match_method) <> ''),
  CHECK (btrim(reason) <> '')
);
CREATE UNIQUE INDEX state_facility_document_match_natural_idx
  ON state_facility_document_match_ledger (
    document_id, match_bucket, match_method, COALESCE(facility_id::text, '')
  );

CREATE TABLE state_facility_monitor_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_key text NOT NULL,
  event_kind text NOT NULL CHECK (event_kind IN (
    'newly_published_penalty_letter',
    'new_admission_curtailment',
    'new_conditional_license',
    'new_license_suspension_revocation',
    'changed_remedy_status',
    'new_inspection_document'
  )),
  event_identity text NOT NULL,
  document_id uuid REFERENCES state_facility_document(id) ON DELETE CASCADE,
  action_id uuid REFERENCES state_facility_action(id) ON DELETE CASCADE,
  baseline_only boolean NOT NULL DEFAULT true,
  source_snapshot_id uuid NOT NULL REFERENCES state_source_snapshot(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dataset_key, event_kind, event_identity),
  CHECK (btrim(dataset_key) <> ''),
  CHECK (btrim(event_identity) <> '')
);

CREATE UNIQUE INDEX state_facility_document_hash_idx
  ON state_facility_document (content_sha256)
  WHERE content_sha256 IS NOT NULL;

CREATE TABLE state_facility_document_occurrence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES state_facility_document(id) ON DELETE CASCADE,
  source_index_url text NOT NULL,
  original_href text,
  resolved_url text NOT NULL,
  source_document_id text NOT NULL,
  printed_facility_name text,
  document_date date,
  action_raw text,
  acquisition_status text NOT NULL,
  http_status integer,
  retry_count integer NOT NULL DEFAULT 0,
  last_error_category text,
  last_error_detail text,
  baseline_only boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resolved_url),
  CHECK (btrim(resolved_url) <> ''),
  CHECK (btrim(source_document_id) <> ''),
  CHECK (btrim(acquisition_status) <> '')
);

CREATE INDEX state_facility_document_kind_idx
  ON state_facility_document (state_code, document_kind, document_date DESC);
CREATE INDEX state_facility_document_facility_idx
  ON state_facility_document (facility_id)
  WHERE facility_id IS NOT NULL;
CREATE INDEX state_facility_action_event_idx
  ON state_facility_action (state_code, event_type_canonical, event_date DESC);
CREATE INDEX state_facility_document_match_bucket_idx
  ON state_facility_document_match_ledger (match_bucket);

COMMENT ON TABLE state_facility_document IS
  'Reusable state facility source documents. facility_id may be null. public_eligible defaults false. Not a ranking table.';
COMMENT ON TABLE state_facility_action IS
  'Reusable state enforcement/inspection actions. First snapshot is baseline_only. Dollars are not a score.';
COMMENT ON TABLE state_facility_document_match_ledger IS
  'Document-to-state-facility identity attachment. Name-only matches are never auto-attached.';
COMMENT ON TABLE state_facility_monitor_event IS
  'Subsequent-run change events keyed by official document identity, not index order.';
COMMENT ON COLUMN state_facility_document.penalty_amount_cents IS
  'Explicit source amount in cents. Never converted into a rating or Trust Score.';
COMMENT ON COLUMN state_facility_document.facility_id IS
  'Nullable. Unmatched official documents are retained.';
COMMENT ON COLUMN state_facility_document.is_final IS
  'Null unless the source expressly calls the document a final order or equivalent.';
COMMENT ON TABLE state_facility_document_occurrence IS
  'Every index URL/occurrence. Duplicate content hashes share one canonical document.';
COMMENT ON COLUMN state_facility_document.corpus_scope IS
  'LTC matched versus acute/other/non-facility. Non-LTC rows are not unresolved LTC failures.';
COMMENT ON COLUMN state_facility_document.is_proposed IS
  'True when the source is a notice/proposal, not a final order.';

COMMIT;
