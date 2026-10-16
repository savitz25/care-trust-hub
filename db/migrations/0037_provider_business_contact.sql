BEGIN;

-- Business website, email, and optional phone for every national provider type.
-- Kept off facility_snapshot, home_health_snapshot, hospice_snapshot, and
-- assisted_living_provider so a CMS or state re-import cannot delete it.
-- No foreign key to those tables or to provider.id: snapshot reloads mint new
-- row ids, and assisted living is not a CMS provider row.
-- facility_identity_candidate is a Google Places match store for nursing-home
-- provider UUIDs. It has no email, no home-health/hospice/assisted-living key,
-- and no publication flag. A later loader may copy a reviewed candidate
-- website into this table. It is not read by profile pages.
-- facility_claim remains the append-only Google evidence path for nursing homes.
--
-- Loader key (unique):
--   provider_type = nursing_home | home_health | hospice | assisted_living
--   provider_key  = CMS CCN for the three CMS types: exactly 6 characters,
--                   uppercase, matching ^[A-Z0-9]{6}$
--                 = assisted_living_provider.external_key for assisted living:
--                   STATE:REGULATOR:SOURCE_FACILITY_ID
--                   examples: CA:CA_CDSS_CCL:015600001
--                             NY:NY_DOH_ACF:3201201
--                             TX:TX_HHSC_ALF:123456
--                   Not the assisted_living_provider uuid (it changes on reload)
--                   and not license_id alone (nullable, and not unique across states).
--                   Where the state file uses one number for both, license_id and
--                   the last segment of external_key match. Otherwise use external_key.
--
-- Other columns the loader writes:
--   website_url     https URL, or NULL. http and non-URLs are rejected.
--   email           mailbox@domain, or NULL.
--   phone_override  optional display phone, 7-40 characters, or NULL.
--   source_urls     text[] of https URLs. Use '{}' when there is none.
--                   Postgres array literal: {https://example.com/about}
--   source_type     short provenance label, not a CMS dataset id.
--                   Example: enrichment_file
--   confidence      numeric from 0 to 1, or NULL. Not a public score.
--   verified_at     timestamptz when the contact was checked, or NULL.
--   is_public       true only when the row may render. Default false.
--   updated_at      timestamptz. Set it on insert and on conflict update.
-- At least one of website_url, email, phone_override is required.
--
-- Upsert:
--   INSERT INTO provider_business_contact (
--     provider_type, provider_key, website_url, email, phone_override,
--     source_urls, source_type, confidence, verified_at, is_public, updated_at
--   ) VALUES (
--     'nursing_home', '01A193', 'https://harborview.example',
--     'admin@harborview.example', NULL, ARRAY['https://harborview.example']::text[],
--     'enrichment_file', 0.90, '2026-10-01T00:00:00Z', true, now()
--   )
--   ON CONFLICT (provider_type, provider_key) DO UPDATE SET
--     website_url = EXCLUDED.website_url,
--     email = EXCLUDED.email,
--     phone_override = EXCLUDED.phone_override,
--     source_urls = EXCLUDED.source_urls,
--     source_type = EXCLUDED.source_type,
--     confidence = EXCLUDED.confidence,
--     verified_at = EXCLUDED.verified_at,
--     is_public = EXCLUDED.is_public,
--     updated_at = EXCLUDED.updated_at;

CREATE TABLE provider_business_contact (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type text NOT NULL CHECK (provider_type IN (
    'nursing_home', 'home_health', 'hospice', 'assisted_living'
  )),
  provider_key text NOT NULL CHECK (btrim(provider_key) <> '' AND char_length(provider_key) <= 200),
  website_url text,
  email text,
  phone_override text,
  source_urls text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_type text NOT NULL CHECK (btrim(source_type) <> '' AND char_length(source_type) <= 80),
  confidence numeric(7,6) CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  verified_at timestamptz,
  is_public boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provider_business_contact_identity UNIQUE (provider_type, provider_key),
  CONSTRAINT provider_business_contact_cms_key CHECK (
    provider_type = 'assisted_living' OR provider_key ~ '^[A-Z0-9]{6}$'
  ),
  CONSTRAINT provider_business_contact_al_key CHECK (
    provider_type <> 'assisted_living'
    OR provider_key ~ '^[A-Z]{2}:[A-Z0-9_]+:[^:[:space:]]+$'
  ),
  CONSTRAINT provider_business_contact_website CHECK (
    website_url IS NULL
    OR (website_url ~ '^https://[^[:space:]]+$' AND char_length(website_url) <= 500)
  ),
  CONSTRAINT provider_business_contact_email CHECK (
    email IS NULL
    OR (
      email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      AND char_length(email) <= 254
    )
  ),
  CONSTRAINT provider_business_contact_phone CHECK (
    phone_override IS NULL
    OR char_length(btrim(phone_override)) BETWEEN 7 AND 40
  ),
  CONSTRAINT provider_business_contact_has_channel CHECK (
    website_url IS NOT NULL OR email IS NOT NULL OR phone_override IS NOT NULL
  )
);

CREATE INDEX provider_business_contact_public_idx
  ON provider_business_contact (provider_type, provider_key)
  WHERE is_public;

COMMENT ON TABLE provider_business_contact IS
  'Business website, email, and optional phone keyed by provider type plus stable public id. Survives snapshot re-imports. is_public false is not rendered. Not a CMS or state official record and not a ranking input.';

COMMENT ON COLUMN provider_business_contact.provider_key IS
  'nursing_home, home_health, hospice: uppercase CMS CCN. assisted_living: external_key STATE:REGULATOR:SOURCE_FACILITY_ID, not the provider uuid and not license_id alone.';

COMMENT ON COLUMN provider_business_contact.is_public IS
  'Profile pages render website and email only when this is true and the value is present.';

-- Same exposure as state_provider_profile: RLS on, no anon or authenticated
-- privilege, no write grant. The direct CARE_DATABASE_URL owner connection
-- reads and a later privileged loader writes. PostgREST anon cannot write.
REVOKE ALL ON TABLE public.provider_business_contact FROM PUBLIC;
REVOKE ALL ON TABLE public.provider_business_contact FROM anon;
REVOKE ALL ON TABLE public.provider_business_contact FROM authenticated;

GRANT SELECT ON TABLE public.provider_business_contact TO service_role;

ALTER TABLE public.provider_business_contact ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Rollback is db/rollbacks/0037_provider_business_contact.sql.
-- Do not append it here. It drops only provider_business_contact.
