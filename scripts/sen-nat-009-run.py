"""SEN-NAT-009 fixtures, benchmarks, census. Does not print secrets. Public writes = 0."""

from __future__ import annotations

import json
import os
import statistics
import sys
from pathlib import Path

import psycopg
from psycopg import ClientCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))

from care_ingest.provider_intelligence_database import (  # noqa: E402
    get_senior_provider_intelligence,
    provider_intelligence_census,
)


def load_env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.pop("CARE_CMS_REFRESH_WRITES", None)


FIXTURE_SQL = {
    "nh_current_ordinary": """
        SELECT i.identifier_value FROM provider_identifier i
        JOIN provider p ON p.id=i.provider_id
        JOIN provider_directory_status d ON d.provider_id=p.id
        WHERE p.provider_type='nursing_home' AND i.identifier_type='CCN'
          AND d.directory_status='CURRENT_ACTIVE'
          AND NOT EXISTS (SELECT 1 FROM ownership_change_event e WHERE e.provider_id=p.id)
        LIMIT 1
    """,
    "nh_with_chow": """
        SELECT i.identifier_value FROM ownership_change_event e
        JOIN provider_identifier i ON i.provider_id=e.provider_id AND i.identifier_type='CCN'
        WHERE e.provider_id IS NOT NULL LIMIT 1
    """,
    "nh_sff": """
        SELECT i.identifier_value FROM cms_facility_designation d
        JOIN provider_identifier i ON i.provider_id=d.provider_id AND i.identifier_type='CCN'
        WHERE d.designation_kind='special_focus' AND d.is_current
          AND d.official_status IN ('SFF','SFF_CANDIDATE') LIMIT 1
    """,
    "nh_missing_mds": """
        SELECT i.identifier_value FROM provider_identifier i
        JOIN provider p ON p.id=i.provider_id
        JOIN provider_directory_status d ON d.provider_id=p.id
        WHERE p.provider_type='nursing_home' AND i.identifier_type='CCN'
          AND d.directory_status='CURRENT_ACTIVE'
          AND NOT EXISTS (
            SELECT 1 FROM facility_quality_measure_observation q WHERE q.provider_id=p.id
          )
        LIMIT 1
    """,
    "nh_known_not_current": """
        SELECT i.identifier_value FROM provider_identifier i
        JOIN provider p ON p.id=i.provider_id
        JOIN provider_directory_status d ON d.provider_id=p.id
        WHERE p.provider_type='nursing_home' AND i.identifier_type='CCN'
          AND d.directory_status='ABSENT_FROM_CURRENT_DIRECTORY'
        LIMIT 1
    """,
    "hh_current": """
        SELECT cms_ccn FROM home_health_snapshot LIMIT 1
    """,
    "hh_many_zips": """
        SELECT cms_ccn FROM cms_agency_service_zip
        WHERE provider_type='home_health' AND provider_id IS NOT NULL
        GROUP BY cms_ccn ORDER BY count(*) DESC LIMIT 1
    """,
    "hospice_gi": """
        SELECT cms_ccn FROM hospice_snapshot LIMIT 1
    """,
    "hospice_evidence_only": """
        SELECT i.identifier_value FROM provider p
        JOIN provider_identifier i ON i.provider_id=p.id AND i.identifier_type='HOSPICE_CCN'
        WHERE p.provider_type='hospice'
          AND NOT EXISTS (SELECT 1 FROM hospice_snapshot s WHERE s.provider_id=p.id)
        LIMIT 1
    """,
    "hospice_no_zip": """
        SELECT s.cms_ccn FROM hospice_snapshot s
        WHERE NOT EXISTS (
          SELECT 1 FROM cms_agency_service_zip z WHERE z.provider_id=s.provider_id
        )
        LIMIT 1
    """,
}

TYPES = {
    "nh_current_ordinary": "nursing_home",
    "nh_with_chow": "nursing_home",
    "nh_sff": "nursing_home",
    "nh_missing_mds": "nursing_home",
    "nh_known_not_current": "nursing_home",
    "hh_current": "home_health",
    "hh_many_zips": "home_health",
    "hospice_gi": "hospice",
    "hospice_evidence_only": "hospice",
    "hospice_no_zip": "hospice",
}


def main() -> int:
    load_env()
    url = os.environ["CARE_DATABASE_URL"]
    print("=== APPLY 0027 ===", flush=True)
    sql = (ROOT / "db" / "migrations" / "0027_provider_intelligence.sql").read_text(
        encoding="utf-8"
    )
    with psycopg.connect(url, autocommit=True, cursor_factory=ClientCursor) as conn:
        conn.execute(sql)
    fixtures: dict[str, str | None] = {}
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("SET statement_timeout = '60s'")
        for name, query in FIXTURE_SQL.items():
            row = conn.execute(query).fetchone()
            fixtures[name] = row[0] if row else None
            print(f"fixture {name}={fixtures[name]}", flush=True)
    results = []
    times: dict[str, list[float]] = {
        "nursing_home": [],
        "home_health": [],
        "hospice": [],
    }
    for name, canonical in fixtures.items():
        if not canonical:
            results.append({"fixture": name, "found": False})
            continue
        provider_type = TYPES[name]
        first = get_senior_provider_intelligence(url, provider_type, canonical)
        second = get_senior_provider_intelligence(url, provider_type, canonical)
        times[provider_type].append(first["query_ms"] if first else 0)
        results.append(
            {
                "fixture": name,
                "canonical_id": canonical,
                "provider_type": provider_type,
                "status": first["profile_intelligence_status"] if first else None,
                "directory": first["directory"]["projection"] if first else None,
                "chow_available": first["chow"].get(
                    "ownership_change_history_available"
                )
                if first
                else None,
                "fingerprint": first["fingerprint"] if first else None,
                "fingerprint_match": bool(first and second)
                and first["fingerprint"] == second["fingerprint"],
                "query_ms": first["query_ms"] if first else None,
                "cms_star_label": (
                    (first.get("quality_summary") or {}).get("cms_stars") or {}
                ).get("label")
                if first
                else None,
            }
        )
    census = provider_intelligence_census(url)
    perf = {
        cls: {
            "n": len(vals),
            "p50": round(statistics.median(vals), 2) if vals else None,
            "p95": round(sorted(vals)[max(int(len(vals) * 0.95) - 1, 0)], 2)
            if vals
            else None,
            "worst": round(max(vals), 2) if vals else None,
        }
        for cls, vals in times.items()
    }
    payload = {
        "contract_version": "provider-intel-v1",
        "materialization": "live_provider_scoped_queries",
        "public_writes": 0,
        "fixtures": results,
        "performance_ms": perf,
        "census": census,
    }
    out = ROOT / "docs" / "sen-nat-009-profile-intelligence.json"
    out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(
        json.dumps(
            {"performance_ms": perf, "census": census, "public_writes": 0}, default=str
        )
    )
    print(f"wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
