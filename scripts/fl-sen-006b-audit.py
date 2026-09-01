"""FL-SEN-006B: privilege audit, REST negative test, CMS-limitation scan."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    for raw in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if raw.strip() and not raw.startswith("#") and "=" in raw:
            key, _, value = raw.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def connect():
    import psycopg
    from psycopg.rows import dict_row

    return psycopg.connect(
        os.environ["CARE_DATABASE_URL"],
        sslmode=os.environ.get("CARE_DATABASE_SSL", "require"),
        row_factory=dict_row,
        options="-c statement_timeout=0",
    )


def rest_probe(role_key: str, role_name: str) -> dict:
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    if not url:
        db = os.environ["CARE_DATABASE_URL"]
        # postgresql://user:pass@aws-0-...pooler.supabase.com:5432/postgres
        host = db.split("@", 1)[-1].split("/", 1)[0].split(":")[0]
        ref = host.split(".")[0] if "supabase.com" in host else None
        if ref and ref.startswith("postgres"):
            ref = None
        # pooler host is aws-0-us-east-1.pooler.supabase.com; project ref is in user
        user = db.split("://", 1)[-1].split(":", 1)[0]
        if user.startswith("postgres."):
            ref = user.split(".", 1)[1]
        url = f"https://{ref}.supabase.co" if ref else ""
    if not url:
        return {"role": role_name, "error": "no_supabase_url"}
    endpoint = url.rstrip("/") + "/rest/v1/state_provider_profile?select=provider_id&limit=1"
    req = urllib.request.Request(
        endpoint,
        headers={
            "apikey": role_key,
            "Authorization": f"Bearer {role_key}",
            "Accept": "application/json",
            "Prefer": "count=exact",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read()
            content_range = resp.headers.get("content-range")
            parsed = json.loads(body.decode("utf-8") or "null")
            n = len(parsed) if isinstance(parsed, list) else None
            return {
                "role": role_name,
                "http_status": resp.status,
                "row_count": n,
                "content_range": content_range,
                "body_is_array": isinstance(parsed, list),
                "retrieved_rows": bool(n),
            }
    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8", errors="replace")[:300]
        return {
            "role": role_name,
            "http_status": exc.code,
            "retrieved_rows": False,
            "error_class": "HTTPError",
            "error_preview": raw.replace(role_key, "[redacted]"),
        }
    except Exception as exc:
        return {
            "role": role_name,
            "retrieved_rows": False,
            "error_class": type(exc).__name__,
            "error_preview": str(exc)[:200],
        }


def main() -> int:
    load_env()
    conn = connect()
    cur = conn.cursor()
    out: dict = {}
    cur.execute(
        """
        select
          has_table_privilege('anon', 'public.state_provider_profile', 'SELECT') as anon_select,
          has_table_privilege('anon', 'public.state_provider_profile', 'INSERT') as anon_insert,
          has_table_privilege('anon', 'public.state_provider_profile', 'UPDATE') as anon_update,
          has_table_privilege('anon', 'public.state_provider_profile', 'DELETE') as anon_delete,
          has_table_privilege('authenticated', 'public.state_provider_profile', 'SELECT') as authenticated_select,
          has_table_privilege('authenticated', 'public.state_provider_profile', 'INSERT') as authenticated_insert,
          has_table_privilege('authenticated', 'public.state_provider_profile', 'UPDATE') as authenticated_update,
          has_table_privilege('authenticated', 'public.state_provider_profile', 'DELETE') as authenticated_delete,
          has_table_privilege('service_role', 'public.state_provider_profile', 'SELECT') as service_select,
          has_table_privilege('service_role', 'public.state_provider_profile', 'INSERT') as service_insert,
          has_schema_privilege('anon', 'public', 'USAGE') as anon_schema,
          has_schema_privilege('authenticated', 'public', 'USAGE') as authenticated_schema,
          has_schema_privilege('service_role', 'public', 'USAGE') as service_schema
        """
    )
    out["privileges"] = dict(cur.fetchone())
    cur.execute(
        """
        select grantee, privilege_type
        from information_schema.role_table_grants
        where table_schema='public' and table_name='state_provider_profile'
        order by grantee, privilege_type
        """
    )
    out["table_grants"] = [dict(r) for r in cur.fetchall()]
    cur.execute(
        """
        select n.nspname as schema, c.relname as table, c.relrowsecurity as rls,
               c.relforcerowsecurity as rls_forced
        from pg_class c
        join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relname='state_provider_profile'
        """
    )
    out["rls"] = dict(cur.fetchone())
    cur.execute(
        """
        select polname, polcmd, polroles::regrole[] as roles, polqual is not null as has_using,
               polwithcheck is not null as has_check
        from pg_policy
        where polrelid = 'public.state_provider_profile'::regclass
        """
    )
    out["policies"] = [dict(r) for r in cur.fetchall()]
    cur.execute(
        """
        select defaclrole::regrole::text as role, defaclobjtype, defaclacl::text
        from pg_default_acl
        where defaclnamespace = 'public'::regnamespace
        """
    )
    out["default_acls"] = [dict(r) for r in cur.fetchall()]

    role_counts = {}
    for role in ("anon", "authenticated"):
        try:
            cur.execute(f"set local role {role}")
            cur.execute("select count(*) n from public.state_provider_profile")
            role_counts[role] = {"ok": True, "n": cur.fetchone()["n"]}
        except Exception as exc:
            role_counts[role] = {"ok": False, "error": type(exc).__name__, "msg": str(exc).split("\n")[0][:180]}
        conn.rollback()
        cur = conn.cursor()
    out["set_role_select"] = role_counts
    cur.execute("select count(*) n from public.state_provider_profile")
    out["server_select_n"] = cur.fetchone()["n"]

    cur.execute(
        """
        select
          count(*) filter (where payload::text like '%12460%' or payload::text like '%12,460%') as n_12460,
          count(*) filter (where payload::text like '%6669%' or payload::text like '%6,669%') as n_6669,
          count(*) filter (where payload::text like '%6911%' or payload::text like '%6,911%') as n_6911,
          count(*) filter (where payload::text like '%1146%' or payload::text like '%1,146%') as n_1146,
          count(*) filter (where payload::text like '%Hospice GI%' ) as n_hospice_gi,
          count(*) filter (where profile_kind='home-health') as hha,
          count(*) filter (where profile_kind='hospice') as hospice
        from public.state_provider_profile
        """
    )
    out["payload_numbers"] = dict(cur.fetchone())
    cur.execute(
        """
        select distinct jsonb_array_elements_text(payload->'limitations') as line
        from public.state_provider_profile
        where profile_kind in ('home-health','hospice','nursing-home')
        order by 1
        """
    )
    out["limitation_lines"] = [r["line"] for r in cur.fetchall()]
    cur.execute("select count(*) n from home_health_snapshot where state_code='FL'")
    out["cms_fl_hha"] = cur.fetchone()["n"]
    cur.execute("select count(*) n from hospice_snapshot where state_code='FL'")
    out["cms_fl_hospice_gi"] = cur.fetchone()["n"]

    anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_ANON_KEY") or ""
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    out["rest_anon"] = rest_probe(anon_key, "anon") if anon_key else {"role": "anon", "error": "missing_key"}
    out["rest_service"] = (
        rest_probe(service_key, "service_role") if service_key else {"role": "service_role", "error": "missing_key"}
    )
    (ROOT / "docs" / "fl-sen-006b-audit.json").write_text(
        json.dumps(out, indent=2, default=str) + "\n", encoding="utf-8"
    )
    print(json.dumps(out, indent=2, default=str))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
