BEGIN;

-- Task 015C — consumer publication surface for VERIFIED CA/NY/TX state claims.
-- facility_claim is append-only; eligibility is a read rule.
CREATE OR REPLACE VIEW published_state_claim AS
SELECT c.*
FROM facility_claim c
WHERE c.resolution_state = 'VERIFIED'
  AND c.claim_type IN (
    'STATE_LICENSE_ID',
    'STATE_LICENSE_STATUS',
    'STATE_LICENSE_TYPE',
    'STATE_LICENSE_CAPACITY',
    'STATE_LICENSEE',
    'STATE_OPERATOR',
    'STATE_ADMINISTRATOR',
    'STATE_MANAGEMENT_ENTITY'
  )
  AND c.resolver_reference LIKE 'system:state-regulator-v1:%'
  AND (
    c.resolver_reference LIKE '%:ca-%'
    OR c.resolver_reference LIKE '%:ny-%'
    OR c.resolver_reference LIKE '%:tx-%'
  )
  AND c.effective_to IS NULL
  AND c.claim_value IS NOT NULL
  AND c.claim_value <> 'null'::jsonb
  AND jsonb_typeof(c.claim_value) = 'string'
  AND btrim(c.claim_value #>> '{}') <> '';

COMMENT ON VIEW published_state_claim IS
  '015C consumer-readable VERIFIED CA/NY/TX state license claims. Not a ranking input.';

COMMIT;
