-- migration_20261016150000_care_security_followups.sql
-- Follow-ups to 20261013200000 RLS fail-closed. Founder GO 2026-10-16 11:02 ET. Project wiuiwgbablgyssuxrjho.
-- Run as postgres. Rollback: rollback_20261016150000_care.sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';
DO $g$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'guard: must run as postgres'; END IF;
  IF to_regclass('public.trust_request') IS NULL OR to_regclass('public.pbj_staffing_day') IS NULL OR to_regclass('public.people') IS NOT NULL THEN RAISE EXCEPTION 'guard: fingerprint mismatch - wrong project'; END IF;
END $g$;
-- 1. Default privileges: new public objects created by postgres no longer auto-grant to anon/authenticated (functions: also PUBLIC).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
-- built-in PUBLIC EXECUTE on functions is a global default; a per-schema REVOKE cannot remove it, so this one is global (functions created by postgres):
ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
-- 3. Fixed search_path on advisor-flagged functions.
ALTER FUNCTION public.trust_append_only() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_request_audit_status() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_request_touch() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_evidence_audit() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_context_guard() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_context_audit() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_override_guard_and_audit() SET search_path = public, pg_temp;
ALTER FUNCTION public.trust_override_audit() SET search_path = public, pg_temp;
ALTER FUNCTION public.facility_intelligence_append_only() SET search_path = public, pg_temp;
-- 3b. Advisor ERROR security_definer_view: anon/authenticated had full privileges (incl. write) on 8 owner-run views.
--     The site reads them as postgres (owner, BYPASSRLS), so revoking plus security_invoker does not affect it.
ALTER VIEW public.provider_ownership_timeline SET (security_invoker = true);
REVOKE ALL ON public.provider_ownership_timeline FROM anon, authenticated;
ALTER VIEW public.published_facility_claim SET (security_invoker = true);
REVOKE ALL ON public.published_facility_claim FROM anon, authenticated;
ALTER VIEW public.published_state_claim SET (security_invoker = true);
REVOKE ALL ON public.published_state_claim FROM anon, authenticated;
ALTER VIEW public.published_facility_history_event SET (security_invoker = true);
REVOKE ALL ON public.published_facility_history_event FROM anon, authenticated;
ALTER VIEW public.published_cms_facility_designation SET (security_invoker = true);
REVOKE ALL ON public.published_cms_facility_designation FROM anon, authenticated;
ALTER VIEW public.published_provider_npi_relationship SET (security_invoker = true);
REVOKE ALL ON public.published_provider_npi_relationship FROM anon, authenticated;
ALTER VIEW public.published_facility_quality_measure SET (security_invoker = true);
REVOKE ALL ON public.published_facility_quality_measure FROM anon, authenticated;
ALTER VIEW public.cms_source_freshness SET (security_invoker = true);
REVOKE ALL ON public.cms_source_freshness FROM anon, authenticated;
DO $p$ DECLARE bad text; BEGIN
  SELECT string_agg(a.grantee::regrole::text||':'||d.defaclobjtype::text,',') INTO bad FROM pg_default_acl d, aclexplode(d.defaclacl) a
   WHERE d.defaclrole='postgres'::regrole AND ((d.defaclnamespace='public'::regnamespace AND a.grantee::regrole::text IN ('__none__')) OR (d.defaclnamespace=0 AND d.defaclobjtype='f' AND a.grantee=0) OR (d.defaclnamespace='public'::regnamespace AND a.grantee::regrole::text IN ('anon','authenticated')));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'post: default privileges still grant %', bad; END IF;
  SELECT string_agg(p.oid::regprocedure::text,',') INTO bad FROM pg_proc p WHERE p.pronamespace='public'::regnamespace AND p.oid::regprocedure::text IN ('trust_append_only()','trust_request_audit_status()','trust_request_touch()','trust_evidence_audit()','trust_context_guard()','trust_context_audit()','trust_override_guard_and_audit()','trust_override_audit()','facility_intelligence_append_only()') AND NOT coalesce(p.proconfig::text,'') LIKE '%search_path=%';
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'post: search_path not set on %', bad; END IF;
  SELECT string_agg(relname,',') INTO bad FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('provider_ownership_timeline','published_facility_claim','published_state_claim','published_facility_history_event','published_cms_facility_designation','published_provider_npi_relationship','published_facility_quality_measure','cms_source_freshness') AND (has_table_privilege('anon',oid,'SELECT') OR has_table_privilege('anon',oid,'INSERT') OR has_table_privilege('authenticated',oid,'SELECT') OR NOT coalesce(reloptions::text,'') LIKE '%security_invoker=true%');
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'post: view still exposed %', bad; END IF;
  
  RAISE NOTICE 'followups post-checks passed';
END $p$;
COMMIT;
