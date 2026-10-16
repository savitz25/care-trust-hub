-- =============================================================================
-- MIGRATION: 20261013200000_care_rls_fail_closed
-- Project: care-trust-hub (ref wiuiwgbablgyssuxrjho).  Drafted 2026-10-13 by Grok Bot (TrustHub Supabase Security).
-- Audit: network-rls-audit-20261013/audit.md.  Capture: read-only catalog SELECT 2026-10-13 (raw/catalog/care_tables.txt).
-- DRAFT - NOT APPLIED.  Requires Founder GO.  Rehearse on a branch first.  Do NOT `supabase db push`.
-- Run as postgres, single session, psql -v ON_ERROR_STOP=1:
--   SET mth.rls_fail_closed_target = 'branch';            -- preview branch / restored copy
--   SET mth.rls_fail_closed_target = 'wiuiwgbablgyssuxrjho';  -- production
-- NOTE: system_identifier 7666007964130682852 is NOT unique on its own (care and investor share it);
--       the guard also requires a project-specific table fingerprint.
-- =============================================================================
-- What it does (all-or-nothing, idempotent):
--   * ENABLE ROW LEVEL SECURITY on all 76 tables (no FORCE: owner postgres pg-Pool/psycopg paths keep bypass).
--   * REVOKE ALL (arwdDxtm) FROM anon, authenticated, PUBLIC.  service_role untouched (BYPASSRLS).
--   * No column grants / policies: audit found NO table read by the public site via anon.
--   * Default privileges and SECURITY DEFINER views/functions are NOT changed (see audit.md residual risks).
-- Rollback: rollback_20261013200000.sql (restores the captured ACLs exactly).
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '300s';

CREATE TEMP TABLE _mth_rls_capture (relname text PRIMARY KEY, pre_acl text NOT NULL) ON COMMIT DROP;
INSERT INTO _mth_rls_capture (relname, pre_acl) VALUES
    ('assisted_living_organization_party', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('assisted_living_provider', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_agency_quality_observation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_agency_service_offering', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_agency_service_zip', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_chain', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_chain_organization', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_chain_performance_snapshot', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_chain_provider', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_facility_designation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_refresh_run', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_refresh_source_policy', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('cms_source_run', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('deficiency_finding', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('evidence_assertion', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_claim', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_claim_observation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_external_identifier', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_external_request_cache', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_history_event', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_identity_candidate', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_intelligence_run', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_intelligence_run_provider', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_quality_measure_observation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_resolution_audit_event', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_review_action', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_review_item', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_snapshot', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('facility_source_observation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('fire_safety_citation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('home_health_snapshot', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('hospice_snapshot', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ingest_run', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('inspection_event', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('location_reference', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('organization', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('organization_identifier', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('organization_name_observation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('organization_relationship', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_change_event', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_change_event_party', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_change_relationship_link', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_party', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_portfolio', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_portfolio_member', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('ownership_source_notice', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('pbj_staffing_day', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('pbj_staffing_load_stage', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('pbj_staffing_quarter_summary', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('penalty_enforcement', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider_context_submission', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider_directory_status', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider_identifier', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider_npi_relationship', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider_organization_edge', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('provider_ownership_relationship', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('quality_measure_definition', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('raw_object', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('regulatory_load_stage', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('senior_intelligence_limitation', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('senior_intelligence_metric_definition', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('senior_intelligence_metric_value', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('senior_intelligence_snapshot', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('source_dataset', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('source_release', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('state_license_credential', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('state_licensed_provider', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('state_provider_contact', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('state_regulatory_event', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('state_service_geography', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('trust_audit_event', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('trust_request', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('trust_request_evidence', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('trust_request_status_history', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}'),
    ('trusthub_manual_override', '{postgres=arwdDxtm/postgres,anon=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}');

CREATE FUNCTION pg_temp.mth_acl_norm(a aclitem[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $f$
  SELECT coalesce(array_agg(x ORDER BY x), '{}')
  FROM (SELECT format('%s>%s:%s:%s', x.grantor::regrole,
                      CASE x.grantee WHEN 0 THEN 'PUBLIC' ELSE x.grantee::regrole::text END,
                      x.privilege_type, x.is_grantable) AS x
        FROM aclexplode(a) x) s
$f$;

DO $guard$
DECLARE
  v_target text := current_setting('mth.rls_fail_closed_target', true);
  v_sysid bigint;
  v_prod_sysid constant bigint := 7666007964130682852;  -- wiuiwgbablgyssuxrjho, captured 2026-10-13
  v_missing int; v_bad text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'guard: must run as postgres (got %)', current_user; END IF;
  IF current_database() <> 'postgres' THEN RAISE EXCEPTION 'guard: unexpected database %', current_database(); END IF;
  IF current_setting('server_version_num')::int < 170000 THEN RAISE EXCEPTION 'guard: expected PostgreSQL 17+'; END IF;
  -- project fingerprint (care-trust-hub)
  IF to_regclass('public.pbj_staffing_day') IS NULL OR to_regclass('public.trust_request') IS NULL OR to_regclass('public.facility_snapshot') IS NULL THEN RAISE EXCEPTION 'guard: fingerprint tables missing - this is not care-trust-hub'; END IF;
  IF to_regclass('public.form_adv_filings') IS NOT NULL OR to_regclass('public.people') IS NOT NULL OR to_regclass('public.lender_cfpb_complaints') IS NOT NULL THEN RAISE EXCEPTION 'guard: foreign-project table present - this is not care-trust-hub'; END IF;
  IF to_regnamespace('move_v2') IS NOT NULL THEN RAISE EXCEPTION 'guard: schema move_v2 present - this is the Move database'; END IF;

  SELECT system_identifier INTO v_sysid FROM pg_control_system();
  IF v_target IS NULL OR v_target = '' THEN
    RAISE EXCEPTION 'guard: set mth.rls_fail_closed_target first (''wiuiwgbablgyssuxrjho'' or ''branch'')';
  ELSIF v_target = 'wiuiwgbablgyssuxrjho' THEN
    IF v_sysid <> v_prod_sysid THEN RAISE EXCEPTION 'guard: target says prod but system_identifier % <> %', v_sysid, v_prod_sysid; END IF;
  ELSIF v_target = 'branch' THEN
    NULL;  -- branches may clone sysid; fingerprint + captured-state checks still apply
  ELSE
    RAISE EXCEPTION 'guard: unknown mth.rls_fail_closed_target %', v_target;
  END IF;

  SELECT count(*) INTO v_missing
  FROM _mth_rls_capture c
  LEFT JOIN pg_class k ON k.relname = c.relname AND k.relnamespace = 'public'::regnamespace
  WHERE k.oid IS NULL OR k.relkind <> 'r' OR k.relispartition
     OR pg_get_userbyid(k.relowner) <> 'postgres' OR k.relforcerowsecurity;
  IF v_missing > 0 THEN RAISE EXCEPTION 'guard: % of 76 tables missing / not owned by postgres / wrong kind / FORCE RLS', v_missing; END IF;

  SELECT string_agg(c.relname, ', ') INTO v_bad
  FROM _mth_rls_capture c
  JOIN pg_class k ON k.relname = c.relname AND k.relnamespace = 'public'::regnamespace
  WHERE NOT (
        (NOT k.relrowsecurity AND pg_temp.mth_acl_norm(k.relacl) = pg_temp.mth_acl_norm(c.pre_acl::aclitem[]))
     OR (k.relrowsecurity AND NOT EXISTS (SELECT 1 FROM aclexplode(k.relacl) a
           WHERE a.grantee = 0 OR a.grantee IN ('anon'::regrole, 'authenticated'::regrole))));
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'guard: state drift since 2026-10-13 capture on: %', v_bad; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies pp JOIN _mth_rls_capture c ON c.relname = pp.tablename WHERE pp.schemaname='public') THEN
    RAISE EXCEPTION 'guard: policies exist on captured tables (capture had 0) - re-audit';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_attribute a JOIN _mth_rls_capture c ON a.attrelid = ('public.'||quote_ident(c.relname))::regclass
             WHERE a.attnum > 0 AND a.attacl IS NOT NULL) THEN
    RAISE EXCEPTION 'guard: column ACLs exist on captured tables (capture had none) - re-audit';
  END IF;
END
$guard$;

DO $fix$
DECLARE r record;
BEGIN
  FOR r IN SELECT relname FROM _mth_rls_capture ORDER BY relname LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated, PUBLIC', r.relname);
  END LOOP;
END
$fix$;

DO $post$
DECLARE r record; p text;
  privs constant text[] := ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'];
BEGIN
  FOR r IN SELECT k.oid, k.relname, k.relrowsecurity, k.relforcerowsecurity, k.relacl
           FROM _mth_rls_capture cap JOIN pg_class k ON k.relname = cap.relname AND k.relnamespace = 'public'::regnamespace LOOP
    IF NOT r.relrowsecurity THEN RAISE EXCEPTION 'post: RLS not enabled on %', r.relname; END IF;
    IF r.relforcerowsecurity THEN RAISE EXCEPTION 'post: unexpected FORCE RLS on %', r.relname; END IF;
    IF EXISTS (SELECT 1 FROM aclexplode(r.relacl) a WHERE a.grantee = 0 OR a.grantee IN ('anon'::regrole,'authenticated'::regrole)) THEN
      RAISE EXCEPTION 'post: anon/authenticated/PUBLIC still in relacl of %', r.relname; END IF;
    FOREACH p IN ARRAY privs LOOP
      IF has_table_privilege('anon', r.oid, p) OR has_table_privilege('authenticated', r.oid, p) THEN
        RAISE EXCEPTION 'post: anon/authenticated still has % on %', p, r.relname; END IF;
      IF NOT has_table_privilege('service_role', r.oid, p) THEN RAISE EXCEPTION 'post: service_role lost % on %', p, r.relname; END IF;
      IF NOT has_table_privilege('postgres', r.oid, p) THEN RAISE EXCEPTION 'post: postgres lost % on %', p, r.relname; END IF;
    END LOOP;
    IF has_any_column_privilege('anon', r.oid, 'SELECT,INSERT,UPDATE,REFERENCES')
       OR has_any_column_privilege('authenticated', r.oid, 'SELECT,INSERT,UPDATE,REFERENCES') THEN
      RAISE EXCEPTION 'post: column privilege remains on %', r.relname; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_policies pp JOIN _mth_rls_capture c ON c.relname = pp.tablename WHERE pp.schemaname='public') THEN
    RAISE EXCEPTION 'post: unexpected policies'; END IF;
  RAISE NOTICE 'care_rls_fail_closed: post-checks passed for 76 tables';
END
$post$;

COMMIT;
