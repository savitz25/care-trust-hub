BEGIN;

ALTER TABLE facility_intelligence_run_provider
  ADD COLUMN selection_metadata jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(selection_metadata) = 'object'),
  ADD COLUMN discovery_requests integer NOT NULL DEFAULT 0 CHECK (discovery_requests >= 0),
  ADD COLUMN details_requests integer NOT NULL DEFAULT 0 CHECK (details_requests >= 0),
  ADD COLUMN retry_requests integer NOT NULL DEFAULT 0 CHECK (retry_requests >= 0),
  ADD COLUMN cache_hits integer NOT NULL DEFAULT 0 CHECK (cache_hits >= 0),
  ADD COLUMN candidate_count integer NOT NULL DEFAULT 0 CHECK (candidate_count >= 0),
  ADD COLUMN final_resolution_state facility_resolution_state,
  ADD COLUMN reason_codes text[] NOT NULL DEFAULT '{}',
  ADD COLUMN verified_audit_status text CHECK (
    verified_audit_status IS NULL OR verified_audit_status IN (
      'AUDIT_PASS', 'AUDIT_FAIL', 'AUDIT_REQUIRES_REVIEW'
    )
  );

ALTER TABLE facility_intelligence_run
  ADD COLUMN discovery_requests integer NOT NULL DEFAULT 0 CHECK (discovery_requests >= 0),
  ADD COLUMN details_requests integer NOT NULL DEFAULT 0 CHECK (details_requests >= 0),
  ADD COLUMN retry_requests integer NOT NULL DEFAULT 0 CHECK (retry_requests >= 0);

CREATE INDEX facility_run_provider_resolution_idx
  ON facility_intelligence_run_provider(run_id, final_resolution_state, ordinal);
CREATE INDEX facility_run_provider_reason_codes_gin
  ON facility_intelligence_run_provider USING gin(reason_codes);
CREATE INDEX facility_run_provider_selection_gin
  ON facility_intelligence_run_provider USING gin(selection_metadata);

COMMENT ON COLUMN facility_intelligence_run_provider.selection_metadata IS
  'Deterministic pilot strata, source facts, and selection reason; never an external claim.';
COMMENT ON COLUMN facility_intelligence_run_provider.verified_audit_status IS
  'Independent pilot audit outcome; not a consumer publication flag.';

COMMIT;
