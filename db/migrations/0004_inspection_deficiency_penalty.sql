BEGIN;

CREATE TABLE inspection_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  event_key text NOT NULL,
  survey_date date NOT NULL,
  survey_type text NOT NULL,
  survey_cycle integer NOT NULL CHECK (survey_cycle >= 0),
  processing_date date,
  source_record_locator text NOT NULL CHECK (btrim(source_record_locator) <> ''),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, event_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id)
);

CREATE TABLE deficiency_finding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  inspection_event_id uuid REFERENCES inspection_event(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  finding_key text NOT NULL,
  survey_date date NOT NULL,
  survey_type text,
  inspection_cycle integer NOT NULL CHECK (inspection_cycle >= 0),
  deficiency_prefix text NOT NULL,
  deficiency_tag text NOT NULL,
  deficiency_category text,
  official_description text,
  scope_severity_code text NOT NULL CHECK (scope_severity_code ~ '^[A-L]$'),
  deficiency_corrected text,
  correction_date date,
  standard_deficiency boolean,
  complaint_deficiency boolean,
  infection_control_deficiency boolean,
  citation_under_idr boolean,
  citation_under_iidr boolean,
  processing_date date,
  source_record_locator text NOT NULL CHECK (btrim(source_record_locator) <> ''),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, finding_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id)
);

CREATE TABLE penalty_enforcement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES provider(id),
  source_release_id uuid NOT NULL REFERENCES source_release(id),
  raw_object_id uuid NOT NULL,
  ingest_run_id uuid NOT NULL,
  penalty_key text NOT NULL,
  penalty_date date NOT NULL,
  penalty_type text NOT NULL CHECK (penalty_type IN ('Fine', 'Payment Denial')),
  fine_id text,
  fine_amount numeric(14,2) CHECK (fine_amount IS NULL OR fine_amount >= 0),
  payment_denial_start_date date,
  payment_denial_days integer CHECK (payment_denial_days IS NULL OR payment_denial_days >= 0),
  processing_date date,
  source_record_locator text NOT NULL CHECK (btrim(source_record_locator) <> ''),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  transformation_version text NOT NULL,
  UNIQUE (source_release_id, penalty_key),
  FOREIGN KEY (raw_object_id, source_release_id) REFERENCES raw_object(id, source_release_id),
  FOREIGN KEY (ingest_run_id, source_release_id) REFERENCES ingest_run(id, source_release_id),
  CHECK ((penalty_type = 'Fine' AND fine_amount IS NOT NULL) OR penalty_type <> 'Fine')
);

CREATE INDEX inspection_event_provider_date_idx ON inspection_event(provider_id, survey_date DESC);
CREATE INDEX deficiency_finding_inspection_idx ON deficiency_finding(inspection_event_id);
CREATE INDEX deficiency_finding_provider_date_idx ON deficiency_finding(provider_id, survey_date DESC);
CREATE INDEX deficiency_finding_tag_idx ON deficiency_finding(deficiency_prefix, deficiency_tag);
CREATE INDEX deficiency_finding_scope_idx ON deficiency_finding(scope_severity_code);
CREATE INDEX penalty_enforcement_provider_date_idx ON penalty_enforcement(provider_id, penalty_date DESC);

COMMIT;
