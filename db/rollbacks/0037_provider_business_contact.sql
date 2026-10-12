-- Rollback for db/migrations/0037_provider_business_contact.sql.
-- Drops only provider_business_contact. Does not touch snapshot tables,
-- facility_claim, facility_identity_candidate, or state_provider_contact.
-- Not applied by the migration runner (that directory is db/migrations only).

BEGIN;

DROP TABLE IF EXISTS public.provider_business_contact;

COMMIT;
