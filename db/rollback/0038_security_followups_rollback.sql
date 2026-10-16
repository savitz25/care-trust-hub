-- rollback_20261016150000_care.sql
-- Follow-ups to 20261013200000 RLS fail-closed. Founder GO 2026-10-16 11:02 ET. Project wiuiwgbablgyssuxrjho.
-- Run as postgres. Rollback: (this file) - restores pre-2026-10-16 state
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '60s';
DO $g$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'guard: must run as postgres'; END IF;
  IF to_regclass('public.trust_request') IS NULL OR to_regclass('public.pbj_staffing_day') IS NULL OR to_regclass('public.people') IS NOT NULL THEN RAISE EXCEPTION 'guard: fingerprint mismatch - wrong project'; END IF;
END $g$;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated;
-- built-in PUBLIC EXECUTE on functions is a global default; a per-schema REVOKE cannot remove it, so this one is global (functions created by postgres):
ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT EXECUTE ON FUNCTIONS TO PUBLIC;
ALTER FUNCTION public.trust_append_only() RESET search_path;
ALTER FUNCTION public.trust_request_audit_status() RESET search_path;
ALTER FUNCTION public.trust_request_touch() RESET search_path;
ALTER FUNCTION public.trust_evidence_audit() RESET search_path;
ALTER FUNCTION public.trust_context_guard() RESET search_path;
ALTER FUNCTION public.trust_context_audit() RESET search_path;
ALTER FUNCTION public.trust_override_guard_and_audit() RESET search_path;
ALTER FUNCTION public.trust_override_audit() RESET search_path;
ALTER FUNCTION public.facility_intelligence_append_only() RESET search_path;
ALTER VIEW public.provider_ownership_timeline RESET (security_invoker);
GRANT ALL ON public.provider_ownership_timeline TO anon, authenticated;
ALTER VIEW public.published_facility_claim RESET (security_invoker);
GRANT ALL ON public.published_facility_claim TO anon, authenticated;
ALTER VIEW public.published_state_claim RESET (security_invoker);
GRANT ALL ON public.published_state_claim TO anon, authenticated;
ALTER VIEW public.published_facility_history_event RESET (security_invoker);
GRANT ALL ON public.published_facility_history_event TO anon, authenticated;
ALTER VIEW public.published_cms_facility_designation RESET (security_invoker);
GRANT ALL ON public.published_cms_facility_designation TO anon, authenticated;
ALTER VIEW public.published_provider_npi_relationship RESET (security_invoker);
GRANT ALL ON public.published_provider_npi_relationship TO anon, authenticated;
ALTER VIEW public.published_facility_quality_measure RESET (security_invoker);
GRANT ALL ON public.published_facility_quality_measure TO anon, authenticated;
ALTER VIEW public.cms_source_freshness RESET (security_invoker);
GRANT ALL ON public.cms_source_freshness TO anon, authenticated;
DO $p$ BEGIN RAISE NOTICE 'followups rollback applied'; END $p$;
COMMIT;
