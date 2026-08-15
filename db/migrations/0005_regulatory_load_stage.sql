BEGIN;

CREATE UNLOGGED TABLE regulatory_load_stage (
  load_key text NOT NULL,
  ordinal bigint NOT NULL CHECK (ordinal > 0),
  ccn text NOT NULL,
  locator text NOT NULL,
  normalized jsonb NOT NULL CHECK (jsonb_typeof(normalized) = 'object'),
  raw_record jsonb NOT NULL CHECK (jsonb_typeof(raw_record) = 'object'),
  PRIMARY KEY (load_key, ordinal)
);

CREATE INDEX regulatory_load_stage_key_ccn_idx ON regulatory_load_stage(load_key, ccn);

COMMIT;
