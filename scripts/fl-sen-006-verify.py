"""FL-SEN-006 reconciliation, census, and QA cohort export."""

from __future__ import annotations

import hashlib
import json
import os
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
WEB_DATA = ROOT / "apps" / "web" / "src" / "data"
LOCKED = {
    "providers": 6983,
    "FL_ALF": 3016,
    "FL_AFCH": 228,
    "FL_HOME_HEALTH_LICENSE": 2971,
    "FL_HOSPICE_LICENSE": 74,
    "FL_NH_LICENSE": 694,
    "credentials": 15227,
    "contacts": 69903,
    "geography": 32420,
    "events": 77219,
    "with_event": 5317,
    "without_event": 1666,
    "fines": 12951,
    "fine_usd": "39607312.57",
    "final_orders": 15712,
    "emergency": 73,
    "nh_known": 14696,
    "nh_current": 14690,
    "hh": 12460,
    "hospice_gi": 6669,
    "hospice_typed": 6911,
    "orgs": 205082,
    "edges": 1421277,
    "unknown": 554644,
    "chow": 5227,
    "hh_index": 250,
    "hospice_index": 250,
}
KIND_TO_CLASS = {
    "assisted-living": "FL_ALF",
    "adult-family-care": "FL_AFCH",
    "home-health": "FL_HOME_HEALTH_LICENSE",
    "hospice": "FL_HOSPICE_LICENSE",
    "nursing-home": "FL_NH_LICENSE",
}
INTEL_FP = "1aff3a096a2ae790bfba2d9b6a4686f25051ee0577b74275106669ec96a6d2bb"


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


def scalar(cur, sql: str):
    cur.execute(sql)
    row = cur.fetchone()
    return next(iter(row.values()))


def pick_cohort(rows: list[dict]) -> list[dict]:
    by_kind: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_kind[row["profile_kind"]].append(row)
    selected: list[dict] = []
    for kind in (
        "assisted-living",
        "adult-family-care",
        "home-health",
        "hospice",
        "nursing-home",
    ):
        items = by_kind[kind]
        used: set[str] = set()
        picks: list[dict] = []

        def obs(item: dict) -> int:
            return int(item["payload"]["regulatory"]["observation_count"])

        def status(item: dict) -> str:
            return item["payload"]["identity"].get("license_status_raw") or ""

        def name(item: dict) -> str:
            return item["payload"]["identity"]["official_name"]

        def take(predicate, reason: str) -> None:
            ranked = sorted(items, key=lambda x: (-obs(x), name(x)))
            for item in ranked:
                if item["provider_id"] in used:
                    continue
                if predicate(item):
                    used.add(item["provider_id"])
                    picks.append({**item, "qa_reason": reason})
                    return

        take(lambda x: True, "richest_history")
        take(lambda x: obs(x) == 0, "zero_events")
        take(lambda x: status(x) != "LICENSED", "non_licensed_status")
        take(
            lambda x: any(
                c.get("credential_type") in {"ECC", "LMH", "LNS"} for c in x["payload"]["credentials"]
            )
            or any(c.get("contact_kind") == "website" for c in x["payload"]["contacts"]),
            "credentials_or_website",
        )
        take(
            lambda x: len(name(x)) >= 28 or len(x["payload"]["contacts"]) <= 6,
            "long_name_or_sparse",
        )
        take(lambda x: True, "fill")
        selected.extend(picks[:5])
    return selected


def main() -> int:
    load_env()
    conn = connect()
    cur = conn.cursor()
    cur.execute("select set_config('statement_timeout', '0', false)")
    checks: dict[str, object] = {}

    checks["profile_n"] = scalar(cur, "select count(*) from state_provider_profile")
    cur.execute("select profile_kind, count(*) n from state_provider_profile group by 1 order by 1")
    checks["by_kind"] = {r["profile_kind"]: r["n"] for r in cur.fetchall()}
    checks["future_path_unique"] = scalar(
        cur, "select count(distinct future_path) from state_provider_profile"
    )
    checks["kind_file_unique"] = scalar(
        cur,
        "select count(*) from (select distinct profile_kind, ahca_file_number from state_provider_profile) t",
    )
    checks["publication_states"] = scalar(
        cur,
        "select count(*) from state_provider_profile where publication_state <> 'internal_only'",
    )
    checks["contract"] = scalar(
        cur,
        "select count(*) from state_provider_profile where contract_version <> 'fl-sen-provider-v1'",
    )
    checks["score_or_rank"] = scalar(
        cur,
        "select count(*) from state_provider_profile where payload ? 'score' or payload ? 'rank'",
    )
    checks["cms_confirmed"] = scalar(
        cur,
        "select count(*) from state_provider_profile where coalesce(payload->'identity'->>'cms_confirmed','false') = 'true'",
    )
    checks["indexable"] = scalar(
        cur,
        "select count(*) from state_provider_profile where coalesce(payload->'publication'->>'indexable','false') = 'true'",
    )
    checks["obs_sum"] = scalar(
        cur,
        "select coalesce(sum((payload->'regulatory'->>'observation_count')::int),0) from state_provider_profile",
    )
    checks["zero_event_profiles"] = scalar(
        cur,
        "select count(*) from state_provider_profile where (payload->'regulatory'->>'observation_count')::int = 0",
    )
    checks["cred_sum"] = scalar(
        cur,
        "select coalesce(sum(jsonb_array_length(payload->'credentials')),0) from state_provider_profile",
    )
    checks["contact_sum"] = scalar(
        cur,
        "select coalesce(sum(jsonb_array_length(payload->'contacts')),0) from state_provider_profile",
    )
    checks["geo_sum"] = scalar(
        cur,
        "select coalesce(sum(jsonb_array_length(payload->'geography')),0) from state_provider_profile",
    )
    checks["capacity_as_occupancy"] = scalar(
        cur,
        "select count(*) from state_provider_profile where coalesce(payload->'licensing'->>'capacity_is_occupancy','false') = 'true'",
    )
    checks["memory_care"] = scalar(
        cur,
        "select count(*) from state_provider_profile where payload::text ilike '%memory care%'",
    )
    checks["nh_ftag_in_profile"] = scalar(
        cur,
        """
        select count(*) from state_provider_profile p
        where profile_kind='nursing-home'
          and exists (
            select 1 from jsonb_array_elements(p.payload->'regulatory'->'recent') e
            where e->>'event_type' ~ '^[FK][0-9]'
          )
        """,
    )
    checks["nh_ftag_in_events"] = scalar(
        cur,
        """
        select count(*)
        from state_regulatory_event e
        join state_licensed_provider p on p.id = e.provider_id
        where p.provider_class='FL_NH_LICENSE'
          and e.event_type ~ '^[FK][0-9]'
        """,
    )
    checks["provider_publication"] = scalar(
        cur,
        "select count(*) from state_licensed_provider where publication_state <> 'NOT_CURRENTLY_PUBLISHABLE'",
    )
    checks["provider_identity"] = scalar(
        cur,
        "select count(*) from state_licensed_provider where identity_state <> 'VERIFIED'",
    )
    checks["cms_links"] = scalar(
        cur,
        "select count(*) from state_licensed_provider where cms_link_confidence = 'CONFIRMED' or cms_provider_id is not null",
    )
    checks["event_n"] = scalar(cur, "select count(*) from state_regulatory_event")
    checks["rls"] = scalar(
        cur,
        "select relrowsecurity from pg_class where relname='state_provider_profile'",
    )
    cur.execute(
        """
        select p.license_status_normalized, p.license_status_raw,
               count(*) filter (where pr.payload->'identity'->>'locator_status' = 'CURRENT') current_locator
        from state_licensed_provider p
        join state_provider_profile pr on pr.provider_id = p.id
        group by 1, 2
        order by 3 desc
        """
    )
    checks["status_mix"] = [
        {
            "normalized": r["license_status_normalized"],
            "raw": r["license_status_raw"],
            "n": r["current_locator"],
        }
        for r in cur.fetchall()
    ]
    cur.execute(
        """
        select profile_kind, count(*) n,
               count(*) filter (where slug in (
                 select slug from state_provider_profile s2
                 where s2.profile_kind = state_provider_profile.profile_kind
                 group by slug having count(*) > 1
               )) colliding_name_slugs
        from state_provider_profile
        group by 1
        """
    )
    checks["name_slug_collision_rows"] = {r["profile_kind"]: r["colliding_name_slugs"] for r in cur.fetchall()}

    national = {
        "nh_known": scalar(cur, "SELECT count(*) FROM provider WHERE provider_type='nursing_home'"),
        "nh_current": scalar(
            cur,
            """
            SELECT count(*) FROM (
              SELECT DISTINCT ON (pds.ccn) pds.directory_status
              FROM provider_directory_status pds
              JOIN provider p ON p.id=pds.provider_id
              WHERE p.provider_type='nursing_home'
              ORDER BY pds.ccn, pds.observed_at DESC, pds.ingested_at DESC
            ) t WHERE directory_status='CURRENT_ACTIVE'
            """,
        ),
        "hh": scalar(cur, "SELECT count(*) FROM home_health_snapshot"),
        "hospice_gi": scalar(cur, "SELECT count(*) FROM hospice_snapshot"),
        "hospice_typed": scalar(cur, "SELECT count(*) FROM provider WHERE provider_type='hospice'"),
        "orgs": scalar(cur, "SELECT count(*) FROM organization"),
        "edges": scalar(cur, "SELECT count(*) FROM provider_organization_edge"),
        "unknown": scalar(
            cur,
            "SELECT count(*) FROM provider_organization_edge WHERE temporal_status='UNKNOWN'",
        ),
        "chow": scalar(cur, "SELECT count(*) FROM ownership_change_event"),
        "alf_fl": scalar(
            cur, "SELECT count(*) FROM assisted_living_provider WHERE state_code='FL'"
        ),
    }
    checks["national"] = national
    agency = json.loads((WEB_DATA / "agency-index-cohort.json").read_text(encoding="utf-8"))
    checks["agency_index"] = {
        "home_health": len(agency["home_health"]),
        "hospice": len(agency["hospice"]),
    }
    intel = json.loads((WEB_DATA / "florida-intelligence.json").read_text(encoding="utf-8"))
    checks["intel_fingerprint"] = intel["sourceFingerprint"]
    checks["intel_fingerprint_ok"] = intel["sourceFingerprint"] == INTEL_FP

    cur.execute(
        """
        select provider_id::text, profile_kind, ahca_file_number, slug, future_path, payload
        from state_provider_profile
        """
    )
    rows = list(cur.fetchall())
    cohort = pick_cohort(rows)
    qa = {
        "contract_version": "fl-sen-provider-v1",
        "non_public": True,
        "indexable": False,
        "n": len(cohort),
        "profiles": [
            {
                "provider_id": r["provider_id"],
                "profile_kind": r["profile_kind"],
                "ahca_file_number": r["ahca_file_number"],
                "name_slug": r["slug"],
                "future_path": r["future_path"],
                "internal_path": f"/florida/internal/{r['profile_kind']}/{r['ahca_file_number']}/{r['slug']}",
                "qa_reason": r["qa_reason"],
                "official_name": r["payload"]["identity"]["official_name"],
                "provider_class": KIND_TO_CLASS[r["profile_kind"]],
                "events": r["payload"]["regulatory"]["observation_count"],
                "license_status_raw": r["payload"]["identity"].get("license_status_raw"),
                "payload": r["payload"],
            }
            for r in cohort
        ],
    }
    class_counts = Counter(p["provider_class"] for p in qa["profiles"])
    reasons = Counter(p["qa_reason"] for p in qa["profiles"])
    checks["qa"] = {
        "n": qa["n"],
        "classes": dict(class_counts),
        "reasons": dict(reasons),
        "zero_event_in_cohort": sum(1 for p in qa["profiles"] if p["events"] == 0),
        "non_licensed_in_cohort": sum(
            1 for p in qa["profiles"] if (p["license_status_raw"] or "") != "LICENSED"
        ),
    }

    failures = []
    if checks["profile_n"] != LOCKED["providers"]:
        failures.append(f"profile_n {checks['profile_n']}")
    if checks["future_path_unique"] != LOCKED["providers"]:
        failures.append("future_path not unique")
    if checks["kind_file_unique"] != LOCKED["providers"]:
        failures.append("kind+file not unique")
    if checks["publication_states"] != 0:
        failures.append("non-internal publication")
    if checks["score_or_rank"] != 0:
        failures.append("score/rank present")
    if checks["cms_confirmed"] != 0:
        failures.append("cms confirmed")
    if checks["indexable"] != 0:
        failures.append("indexable")
    if int(checks["obs_sum"]) != LOCKED["events"]:
        failures.append(f"obs_sum {checks['obs_sum']}")
    if checks["zero_event_profiles"] != LOCKED["without_event"]:
        failures.append(f"zero_event {checks['zero_event_profiles']}")
    if int(checks["cred_sum"]) != LOCKED["credentials"]:
        failures.append(f"cred_sum {checks['cred_sum']}")
    if int(checks["contact_sum"]) != LOCKED["contacts"]:
        failures.append(f"contact_sum {checks['contact_sum']}")
    if int(checks["geo_sum"]) != LOCKED["geography"]:
        failures.append(f"geo_sum {checks['geo_sum']}")
    if checks["capacity_as_occupancy"] != 0:
        failures.append("capacity occupancy")
    if checks["nh_ftag_in_profile"] != 0 or checks["nh_ftag_in_events"] != 0:
        failures.append("nh ftag leak")
    if checks["provider_publication"] != 0:
        failures.append("provider published")
    if checks["event_n"] != LOCKED["events"]:
        failures.append(f"events {checks['event_n']}")
    if national["nh_known"] != LOCKED["nh_known"] or national["nh_current"] != LOCKED["nh_current"]:
        failures.append("nh census")
    if national["hh"] != LOCKED["hh"] or national["hospice_gi"] != LOCKED["hospice_gi"]:
        failures.append("hh/hospice census")
    if national["hospice_typed"] != LOCKED["hospice_typed"]:
        failures.append("hospice typed")
    if national["orgs"] != LOCKED["orgs"] or national["edges"] != LOCKED["edges"]:
        failures.append("org/edge census")
    if national["unknown"] != LOCKED["unknown"] or national["chow"] != LOCKED["chow"]:
        failures.append("unknown/chow")
    if national["alf_fl"] != 0:
        failures.append("alf_fl dual write")
    if checks["agency_index"]["home_health"] != 250 or checks["agency_index"]["hospice"] != 250:
        failures.append("agency index")
    if not checks["intel_fingerprint_ok"]:
        failures.append("intel fingerprint")
    if qa["n"] != 25 or any(v != 5 for v in class_counts.values()):
        failures.append("qa cohort")
    if checks["qa"]["zero_event_in_cohort"] < 4:
        failures.append("qa missing zero-event class coverage")
    if "zero_events" not in reasons or reasons["zero_events"] < 4:
        failures.append("qa zero-event picks")
    checks["failures"] = failures
    checks["ok"] = not failures

    DOCS.mkdir(exist_ok=True)
    (DOCS / "fl-sen-006-verify.json").write_text(
        json.dumps(checks, indent=2, default=str) + "\n", encoding="utf-8"
    )
    (DOCS / "fl-sen-006-qa-cohort.json").write_text(
        json.dumps(
            [{k: p[k] for k in p if k != "payload"} for p in qa["profiles"]],
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    (WEB_DATA / "florida-profile-qa-cohort.json").write_text(
        json.dumps(qa, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({k: checks[k] for k in ("ok", "failures", "profile_n", "by_kind", "qa", "national")}, default=str, indent=2))
    conn.close()
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
