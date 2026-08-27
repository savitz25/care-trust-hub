BEGIN;

-- SEN-NAT-008: versioned National Senior Intelligence metric contract.
-- Small derived layer. Does not duplicate MDS/PBJ/graph/CHOW rows or combine denominators.

CREATE TABLE IF NOT EXISTS senior_intelligence_metric_definition (
  metric_key text NOT NULL,
  metric_version text NOT NULL,
  display_name text NOT NULL,
  provider_type text NOT NULL,
  evidence_family text NOT NULL,
  entity_class text NOT NULL CHECK (entity_class IN (
    'PROVIDER', 'ORGANIZATION', 'EVENT', 'OBSERVATION', 'SOURCE', 'NONE'
  )),
  definition text NOT NULL,
  numerator_definition text,
  denominator_definition text,
  derivation text NOT NULL CHECK (derivation IN ('DIRECT', 'DERIVED')),
  source_datasets text[] NOT NULL,
  geography_grain text NOT NULL,
  freshness_rule text NOT NULL,
  computability_status text NOT NULL CHECK (computability_status IN (
    'COMPUTABLE', 'PARTIAL', 'UNSUPPORTED', 'BLOCKED'
  )),
  publication_status text NOT NULL CHECK (publication_status IN (
    'INTERNAL_ONLY', 'PUBLIC_READY', 'CONDITIONAL', 'DO_NOT_PUBLISH'
  )),
  language_safe text NOT NULL,
  language_unsafe text NOT NULL,
  limitations text NOT NULL,
  PRIMARY KEY (metric_key, metric_version),
  CHECK (btrim(metric_key) <> ''),
  CHECK (btrim(display_name) <> ''),
  CHECK (btrim(definition) <> '')
);

CREATE TABLE IF NOT EXISTS senior_intelligence_limitation (
  limitation_key text NOT NULL,
  limitation_version text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  provider_type text,
  publication_status text NOT NULL CHECK (publication_status IN (
    'INTERNAL_ONLY', 'PUBLIC_READY', 'CONDITIONAL', 'DO_NOT_PUBLISH'
  )),
  PRIMARY KEY (limitation_key, limitation_version),
  CHECK (btrim(limitation_key) <> ''),
  CHECK (btrim(body) <> '')
);

CREATE TABLE IF NOT EXISTS senior_intelligence_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_version text NOT NULL,
  fingerprint text NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  transformation_version text NOT NULL,
  public_writes integer NOT NULL DEFAULT 0 CHECK (public_writes = 0),
  UNIQUE (snapshot_version, fingerprint),
  CHECK (btrim(snapshot_version) <> ''),
  CHECK (btrim(fingerprint) <> '')
);

CREATE TABLE IF NOT EXISTS senior_intelligence_metric_value (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id uuid NOT NULL REFERENCES senior_intelligence_snapshot(id),
  metric_key text NOT NULL,
  metric_version text NOT NULL,
  geography_code text NOT NULL DEFAULT '',
  value_numeric numeric,
  value_jsonb jsonb,
  numerator numeric,
  denominator numeric,
  status text NOT NULL CHECK (status IN (
    'COMPUTABLE', 'PARTIAL', 'UNSUPPORTED', 'BLOCKED'
  )),
  UNIQUE (snapshot_id, metric_key, metric_version, geography_code),
  FOREIGN KEY (metric_key, metric_version)
    REFERENCES senior_intelligence_metric_definition (metric_key, metric_version)
);

CREATE INDEX IF NOT EXISTS senior_intelligence_value_metric_idx
  ON senior_intelligence_metric_value (metric_key, snapshot_id);

COMMENT ON TABLE senior_intelligence_metric_definition IS
  'SEN-NAT-008 metric contract. Provider classes stay separate. No combined senior-provider denominator.';
COMMENT ON TABLE senior_intelligence_snapshot IS
  'Versioned National Intelligence snapshot. generated_at is not evidence freshness and is excluded from fingerprint.';
COMMENT ON TABLE senior_intelligence_metric_value IS
  'Small materialized counts and coverage. Does not copy MDS, PBJ, quality, or ownership rows.';
COMMENT ON TABLE senior_intelligence_limitation IS
  'Locked methodology statements: CMS vs state classes, ZIP vs service area, CHOW vs quality.';

COMMIT;
