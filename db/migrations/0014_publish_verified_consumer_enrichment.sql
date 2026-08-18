BEGIN;

-- Task 014D.1 — consumer publication surface.
-- facility_claim is append-only, so eligibility is a read rule, not an in-place flag rewrite.
-- Identity, Google address, and Google business status stay off this view.
CREATE OR REPLACE VIEW published_facility_claim AS
SELECT c.*
FROM facility_claim c
WHERE c.resolution_state = 'VERIFIED'
  AND c.claim_type IN (
    'google_official_website',
    'google_public_phone',
    'google_public_name'
  )
  AND c.effective_to IS NULL
  AND c.claim_value IS NOT NULL
  AND c.claim_value <> 'null'::jsonb
  AND jsonb_typeof(c.claim_value) = 'string'
  AND btrim(c.claim_value #>> '{}') <> '';

COMMENT ON VIEW published_facility_claim IS
  '014D.1 consumer-readable VERIFIED website, phone, and public-name claims. Not a ranking input.';

COMMIT;
