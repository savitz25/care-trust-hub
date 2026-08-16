BEGIN;

CREATE TABLE trust_request (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_type text NOT NULL CHECK (request_type IN ('profile_claim','trusthub_correction','source_data_concern','provider_factual_context')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','needs_information','approved','partially_approved','rejected','withdrawn','resolved')),
  provider_id uuid REFERENCES provider(id),
  organization_id uuid REFERENCES organization(id),
  cms_ccn text CHECK (cms_ccn IS NULL OR cms_ccn ~ '^[A-Z0-9]{6}$'),
  cms_chain_id text,
  submitter_name text NOT NULL CHECK (char_length(submitter_name) BETWEEN 1 AND 160),
  submitter_role text NOT NULL CHECK (char_length(submitter_role) BETWEEN 1 AND 160),
  submitter_organization text NOT NULL CHECK (char_length(submitter_organization) BETWEEN 1 AND 240),
  submitter_email text NOT NULL CHECK (char_length(submitter_email) BETWEEN 3 AND 320),
  submitter_phone text CHECK (submitter_phone IS NULL OR char_length(submitter_phone) <= 40),
  factual_description text NOT NULL CHECK (char_length(factual_description) BETWEEN 20 AND 5000),
  evidence_links jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence_links)='array'),
  internal_reviewer_notes text,
  resolution text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trust_request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_request_id uuid NOT NULL REFERENCES trust_request(id),
  from_status text,
  to_status text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('submitter','reviewer','system')),
  actor_reference text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trust_request_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_request_id uuid NOT NULL REFERENCES trust_request(id),
  evidence_url text NOT NULL CHECK (evidence_url ~ '^https://'),
  description text,
  is_private boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE provider_context_submission (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_request_id uuid NOT NULL UNIQUE REFERENCES trust_request(id),
  provider_id uuid REFERENCES provider(id),
  organization_id uuid REFERENCES organization(id),
  referenced_section text,
  public_text text NOT NULL CHECK (char_length(public_text) BETWEEN 20 AND 3000),
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending','needs_edits','approved','rejected','withdrawn')),
  moderation_reviewer_reference text,
  moderation_reason text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  CHECK ((moderation_status='approved' AND approved_at IS NOT NULL) OR moderation_status<>'approved'),
  CHECK (moderation_status='pending' OR moderation_reviewer_reference IS NOT NULL)
);

CREATE TABLE trusthub_manual_override (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_request_id uuid NOT NULL REFERENCES trust_request(id),
  target_kind text NOT NULL CHECK (target_kind IN ('provider_mapping','organization_mapping','canonical_slug','display_mapping','trusthub_classification')),
  target_id uuid NOT NULL,
  target_field text NOT NULL,
  original_derived_value jsonb NOT NULL,
  corrected_value jsonb NOT NULL,
  reason text NOT NULL,
  reviewer_reference text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  activated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK ((status='revoked' AND revoked_at IS NOT NULL) OR status='active')
);

CREATE TABLE trust_audit_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trust_request_id uuid NOT NULL REFERENCES trust_request(id),
  event_type text NOT NULL CHECK (event_type IN ('request_submitted','status_changed','reviewer_assigned','evidence_added','claim_decided','correction_decided','override_activated','override_revoked','provider_context_decided','resolution_closed')),
  actor_kind text NOT NULL CHECK (actor_kind IN ('submitter','reviewer','system')),
  actor_reference text,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(event_data)='object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION trust_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION '% is append-only', TG_TABLE_NAME; END $$;
CREATE TRIGGER trust_status_history_append_only BEFORE UPDATE OR DELETE ON trust_request_status_history FOR EACH ROW EXECUTE FUNCTION trust_append_only();
CREATE TRIGGER trust_audit_event_append_only BEFORE UPDATE OR DELETE ON trust_audit_event FOR EACH ROW EXECUTE FUNCTION trust_append_only();

CREATE FUNCTION trust_request_audit_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    INSERT INTO trust_request_status_history(trust_request_id,to_status,actor_kind) VALUES(NEW.id,NEW.status,'submitter');
    INSERT INTO trust_audit_event(trust_request_id,event_type,actor_kind) VALUES(NEW.id,'request_submitted','submitter');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO trust_request_status_history(trust_request_id,from_status,to_status,actor_kind) VALUES(NEW.id,OLD.status,NEW.status,'system');
    INSERT INTO trust_audit_event(trust_request_id,event_type,actor_kind,event_data) VALUES(NEW.id,'status_changed','system',jsonb_build_object('from',OLD.status,'to',NEW.status));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trust_request_audit_status_trigger AFTER INSERT OR UPDATE ON trust_request FOR EACH ROW EXECUTE FUNCTION trust_request_audit_status();

CREATE FUNCTION trust_request_touch() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at=now(); RETURN NEW; END $$;
CREATE TRIGGER trust_request_touch_trigger BEFORE UPDATE ON trust_request FOR EACH ROW EXECUTE FUNCTION trust_request_touch();

CREATE FUNCTION trust_evidence_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO trust_audit_event(trust_request_id,event_type,actor_kind,event_data)
  VALUES(NEW.trust_request_id,'evidence_added','submitter',jsonb_build_object('evidence_id',NEW.id));
  RETURN NEW;
END $$;
CREATE TRIGGER trust_evidence_audit_trigger AFTER INSERT ON trust_request_evidence FOR EACH ROW EXECUTE FUNCTION trust_evidence_audit();

CREATE FUNCTION trust_context_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.moderation_status IN ('approved','rejected','withdrawn') THEN
    RAISE EXCEPTION 'decided provider context is immutable';
  END IF;
  IF NEW.moderation_status <> 'pending' AND NEW.moderation_reviewer_reference IS NULL THEN
    RAISE EXCEPTION 'provider context decision requires reviewer reference';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trust_context_guard_trigger BEFORE UPDATE ON provider_context_submission FOR EACH ROW EXECUTE FUNCTION trust_context_guard();

CREATE FUNCTION trust_context_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.moderation_status IS DISTINCT FROM OLD.moderation_status THEN
    INSERT INTO trust_audit_event(trust_request_id,event_type,actor_kind,actor_reference,event_data)
    VALUES(NEW.trust_request_id,'provider_context_decided','reviewer',NEW.moderation_reviewer_reference,
      jsonb_build_object('from',OLD.moderation_status,'to',NEW.moderation_status,'reason',NEW.moderation_reason));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trust_context_audit_trigger AFTER UPDATE ON provider_context_submission FOR EACH ROW EXECUTE FUNCTION trust_context_audit();

CREATE FUNCTION trust_override_guard_and_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' THEN
    IF OLD.status <> 'active' OR NEW.status <> 'revoked'
       OR NEW.trust_request_id IS DISTINCT FROM OLD.trust_request_id
       OR NEW.target_kind IS DISTINCT FROM OLD.target_kind
       OR NEW.target_id IS DISTINCT FROM OLD.target_id
       OR NEW.target_field IS DISTINCT FROM OLD.target_field
       OR NEW.original_derived_value IS DISTINCT FROM OLD.original_derived_value
       OR NEW.corrected_value IS DISTINCT FROM OLD.corrected_value
       OR NEW.reason IS DISTINCT FROM OLD.reason
       OR NEW.reviewer_reference IS DISTINCT FROM OLD.reviewer_reference
       OR NEW.activated_at IS DISTINCT FROM OLD.activated_at THEN
      RAISE EXCEPTION 'reviewed manual override values are immutable; only active-to-revoked is allowed';
    END IF;
    IF NEW.revoked_at IS NULL THEN RAISE EXCEPTION 'revoked override requires revoked_at'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trust_override_guard_trigger BEFORE UPDATE ON trusthub_manual_override FOR EACH ROW EXECUTE FUNCTION trust_override_guard_and_audit();

CREATE FUNCTION trust_override_audit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO trust_audit_event(trust_request_id,event_type,actor_kind,actor_reference,event_data)
  VALUES(NEW.trust_request_id,
    CASE WHEN TG_OP='INSERT' THEN 'override_activated' ELSE 'override_revoked' END,
    'reviewer',NEW.reviewer_reference,jsonb_build_object('override_id',NEW.id,'target_kind',NEW.target_kind,'target_id',NEW.target_id,'target_field',NEW.target_field));
  RETURN NEW;
END $$;
CREATE TRIGGER trust_override_audit_trigger AFTER INSERT OR UPDATE OF status ON trusthub_manual_override FOR EACH ROW EXECUTE FUNCTION trust_override_audit();

CREATE INDEX trust_request_queue_idx ON trust_request(status,request_type,submitted_at);
CREATE INDEX trust_request_rate_limit_idx ON trust_request(submitter_email,submitted_at DESC);
CREATE INDEX trust_request_provider_idx ON trust_request(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX trust_request_organization_idx ON trust_request(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX provider_context_public_idx ON provider_context_submission(provider_id,approved_at DESC) WHERE moderation_status='approved';
CREATE INDEX trust_override_target_idx ON trusthub_manual_override(target_kind,target_id,target_field) WHERE status='active';
CREATE INDEX trust_audit_request_idx ON trust_audit_event(trust_request_id,created_at);

COMMIT;
