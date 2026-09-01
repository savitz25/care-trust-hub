"""FL-SEN-006: generate internal Florida provider profile snapshots."""

from __future__ import annotations

import hashlib
import json
import os
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path
from uuid import UUID

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
SQL = ROOT / "db" / "migrations" / "0030_florida_state_provider_profile.sql"
CONTRACT = "fl-sen-provider-v1"
ADAPTER = "fl-sen-006-v1"
NO_EVENT = "No connected Florida regulatory event was observed in the acquired AHCA sources."
KINDS = {
    "FL_ALF": "assisted-living",
    "FL_AFCH": "adult-family-care",
    "FL_HOME_HEALTH_LICENSE": "home-health",
    "FL_HOSPICE_LICENSE": "hospice",
    "FL_NH_LICENSE": "nursing-home",
}
PUBLIC_CONTACTS = {
    "street_address",
    "mailing_address",
    "phone",
    "website",
    "administrator",
    "owner_licensee",
    "management_company",
}
ALIASES = {"Dade": "Miami-Dade", "Desoto": "DeSoto", "Hillsborou": "Hillsborough"}
LOCKED = {
    "providers": 6983,
    "credentials": 15227,
    "contacts": 69903,
    "geography": 32420,
    "events": 77219,
    "with_event": 5317,
    "without_event": 1666,
    "fines": 12951,
    "fine_usd": Decimal("39607312.57"),
    "final_orders": 15712,
    "emergency": 73,
}


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


def name_slug(name: str) -> str:
    text = unicodedata.normalize("NFKD", name)
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    text = text.lower().replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:60].strip("-")
    return text or "provider"


def future_path(kind: str, file_no: str, slug: str) -> str:
    return f"/florida/{kind}/{file_no}/{slug}"


def map_county(raw: str) -> dict:
    value = raw.strip()
    if value in ALIASES:
        return {"raw": value, "canonical": ALIASES[value], "mapping": f"{value} → {ALIASES[value]}"}
    return {"raw": value, "canonical": value if value else None, "mapping": None}


def fingerprint(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def limitations(cls: str, event_n: int) -> list[str]:
    lines = [
        "CURRENT means the provider appears in the AHCA Active/Open locator. It is not good standing.",
        "Raw AHCA license status is the official status field and is not replaced by CURRENT.",
    ]
    if event_n == 0:
        lines.append(NO_EVENT)
    else:
        lines.append("State regulatory history reflects connected AHCA sources, not a complete historical universe.")
    lines.append("No confirmed AHCA↔CMS provider crosswalk exists for this identity.")
    if cls == "FL_NH_LICENSE":
        lines.append("AHCA Nursing Home F/K inspection rows were excluded as federal CMS reposts.")
        lines.append("Equal Florida CMS and AHCA nursing-home counts do not prove row-level identity.")
    if cls == "FL_HOME_HEALTH_LICENSE":
        lines.append(
            "Florida AHCA tracks 2,971 CURRENT Home Health license identities; the separate CMS Florida Home Health universe contains 1,146 providers. No row-level AHCA↔CMS identity is inferred here."
        )
    if cls == "FL_HOSPICE_LICENSE":
        lines.append(
            "Florida AHCA tracks 74 CURRENT Hospice license identities; the separate CMS Florida Hospice GI universe contains 61 providers. No row-level AHCA↔CMS identity is inferred here. No Hospice star is assigned here."
        )
    if cls == "FL_ALF":
        lines.append("LMH, LNS, and ECC are specialty credentials, not Memory Care licenses.")
    lines.append("Historical/non-current Florida identities are not represented.")
    return lines


def build_one(provider: dict, creds: list, contacts: list, geos: list, events: list) -> dict:
    cls = provider["provider_class"]
    kind = KINDS[cls]
    slug = name_slug(provider["official_name"])
    file_no = provider["ahca_file_number"]
    families = Counter(e["event_family"] for e in events)
    dates = [e["event_date"] for e in events if e.get("event_date")]
    ordered = sorted(events, key=lambda e: (e.get("event_date") or datetime(1970, 1, 1).date()), reverse=True)
    recent = ordered[:8]
    fines = [e for e in ordered if e["event_family"] == "fine"][:3]
    orders = [e for e in ordered if e["event_family"] == "final_order"][:3]
    fine_usd = Decimal("0")
    for e in events:
        if e["event_family"] != "fine":
            continue
        amount = (e.get("payload") or {}).get("fine_amount")
        if amount:
            fine_usd += Decimal(str(amount))
    payload = {
        "contract_version": CONTRACT,
        "identity": {
            "external_key": provider["external_key"],
            "provider_class": cls,
            "profile_kind": kind,
            "official_name": provider["official_name"],
            "ahca_file_number": file_no,
            "healthfinder_lid": provider.get("healthfinder_lid"),
            "locator_status": "CURRENT",
            "license_status_raw": provider.get("license_status_raw"),
            "license_status_normalized": provider.get("license_status_normalized"),
            "cms_confirmed": False,
        },
        "licensing": {
            "license_effective_on": provider.get("license_effective_on").isoformat()
            if provider.get("license_effective_on")
            else None,
            "license_expires_on": provider.get("license_expires_on").isoformat()
            if provider.get("license_expires_on")
            else None,
            "licensed_capacity": provider.get("licensed_capacity"),
            "capacity_is_occupancy": False,
        },
        "credentials": [
            {
                "credential_type": c["credential_type"],
                "raw_label": c["raw_label"],
                "credential_code": c.get("credential_code"),
                "source_field": c["source_field"],
            }
            for c in creds
        ],
        "contacts": [
            {
                "contact_kind": c["contact_kind"],
                "value_text": c["value_text"],
                "title": c.get("title"),
                "source_field": c["source_field"],
                "display_tier": "public_candidate"
                if c["contact_kind"] in PUBLIC_CONTACTS
                else "review_before_public",
            }
            for c in contacts
        ],
        "geography": [
            {
                "geography_kind": g["geography_kind"],
                **map_county(g["value_text"]),
                "source_field": g["source_field"],
            }
            for g in geos
        ],
        "regulatory": {
            "observation_count": len(events),
            "has_connected_event": bool(events),
            "absence_language": None if events else NO_EVENT,
            "counts": {
                "inspection": families.get("inspection", 0),
                "deficiency": families.get("deficiency", 0),
                "legal_action": families.get("legal_action", 0),
                "fine": families.get("fine", 0),
                "final_order": families.get("final_order", 0),
                "emergency_action": families.get("emergency_action", 0),
            },
            "earliest": min(dates).isoformat() if dates else None,
            "latest": max(dates).isoformat() if dates else None,
            "fine_usd": str(fine_usd) if fine_usd else "0",
            "recent": [
                {
                    "event_family": e["event_family"],
                    "event_type": e["event_type"],
                    "event_date": e["event_date"].isoformat() if e.get("event_date") else None,
                    "case_number": e.get("case_number"),
                    "is_final": e.get("is_final"),
                    "source_locator": e.get("source_locator"),
                }
                for e in recent
            ],
            "recent_fines": [
                {
                    "event_date": e["event_date"].isoformat() if e.get("event_date") else None,
                    "case_number": e.get("case_number"),
                    "amount": (e.get("payload") or {}).get("fine_amount"),
                    "source_locator": e.get("source_locator"),
                }
                for e in fines
            ],
            "recent_final_orders": [
                {
                    "event_date": e["event_date"].isoformat() if e.get("event_date") else None,
                    "case_number": e.get("case_number"),
                    "document_url": e.get("source_locator"),
                }
                for e in orders
            ],
        },
        "sources": {
            "provider_source_as_of": provider["source_as_of"].isoformat() if provider.get("source_as_of") else None,
            "provider_retrieved_at": provider["retrieved_at"].isoformat() if provider.get("retrieved_at") else None,
            "adapter_version": provider.get("adapter_version"),
        },
        "limitations": limitations(cls, len(events)),
        "publication": {"state": "internal_only", "indexable": False},
    }
    return {
        "provider_id": provider["id"],
        "contract_version": CONTRACT,
        "profile_kind": kind,
        "ahca_file_number": file_no,
        "slug": slug,
        "future_path": future_path(kind, file_no, slug),
        "payload": payload,
        "publication_state": "internal_only",
        "source_fingerprint": fingerprint(payload),
        "status_raw": provider.get("license_status_raw"),
        "event_n": len(events),
        "credential_n": len(creds),
        "contact_n": len(contacts),
        "name": provider["official_name"],
        "cls": cls,
        "has_ecc": any(c["credential_type"] == "ECC" for c in creds),
        "has_website": any(c["contact_kind"] == "website" for c in contacts),
    }


def pick_cohort(rows: list[dict]) -> list[dict]:
    by_class: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        by_class[row["cls"]].append(row)
    selected: list[dict] = []
    for cls, items in by_class.items():
        used: set[str] = set()
        picks: list[dict] = []

        def take(predicate, fallback_last=False):
            for item in items:
                if item["provider_id"] in used:
                    continue
                if predicate(item):
                    used.add(item["provider_id"])
                    picks.append(item)
                    return
            if fallback_last:
                for item in reversed(items):
                    if item["provider_id"] not in used:
                        used.add(item["provider_id"])
                        picks.append(item)
                        return

        ranked = sorted(items, key=lambda x: (-x["event_n"], x["name"]))
        take(lambda x: x["event_n"] == ranked[0]["event_n"])
        take(lambda x: x["event_n"] == 0, fallback_last=True)
        take(lambda x: (x.get("status_raw") or "") != "LICENSED", fallback_last=True)
        if cls == "FL_ALF":
            take(lambda x: x["has_ecc"] or x["credential_n"] > 2, fallback_last=True)
        else:
            take(lambda x: x["has_website"], fallback_last=True)
        take(lambda x: len(x["name"]) >= 28 or x["contact_n"] >= 8, fallback_last=True)
        while len(picks) < 5:
            take(lambda x: True, fallback_last=True)
        selected.extend(picks[:5])
    return selected


def ensure_table(cur) -> None:
    cur.execute(
        """
        select 1 from information_schema.tables
        where table_schema='public' and table_name='state_provider_profile'
        """
    )
    if cur.fetchone():
        return
    sql = SQL.read_text(encoding="utf-8").replace("BEGIN;", "").replace("COMMIT;", "")
    cur.execute(sql)


def persist(cur, rows: list[dict]) -> dict:
    from psycopg.types.json import Json

    cur.execute("select provider_id::text, source_fingerprint, future_path from state_provider_profile")
    existing = {r["provider_id"]: r for r in cur.fetchall()}
    inserts, updates, unchanged = [], [], 0
    now = datetime.now(UTC)
    for row in rows:
        found = existing.get(str(row["provider_id"]))
        if found and found["source_fingerprint"] == row["source_fingerprint"] and found["future_path"] == row["future_path"]:
            unchanged += 1
            continue
        values = (
            str(row["provider_id"]),
            row["contract_version"],
            row["profile_kind"],
            row["ahca_file_number"],
            row["slug"],
            row["future_path"],
            Json(row["payload"]),
            row["publication_state"],
            now,
            row["source_fingerprint"],
        )
        if found:
            updates.append(values)
        else:
            inserts.append(values)
    if inserts:
        with cur.copy(
            """
            COPY state_provider_profile (
              provider_id, contract_version, profile_kind, ahca_file_number, slug, future_path,
              payload, publication_state, computed_at, source_fingerprint
            ) FROM STDIN
            """
        ) as copy:
            for item in inserts:
                copy.write_row(item)
    if updates:
        cur.executemany(
            """
            update state_provider_profile set
              contract_version=%s, profile_kind=%s, ahca_file_number=%s, slug=%s, future_path=%s,
              payload=%s, publication_state=%s, computed_at=%s, source_fingerprint=%s
            where provider_id=%s::uuid
            """,
            [(*item[1:], item[0]) for item in updates],
        )
    return {"inserted": len(inserts), "updated": len(updates), "unchanged": unchanged, "n": len(rows)}


def main() -> int:
    load_env()
    conn = connect()
    conn.autocommit = False
    try:
        cur = conn.cursor()
        cur.execute("select set_config('statement_timeout', '0', false)")
        ensure_table(cur)
        print("LOAD_START", flush=True)
        cur.execute("select * from state_licensed_provider")
        providers = list(cur.fetchall())
        cur.execute("select * from state_license_credential")
        creds = defaultdict(list)
        for row in cur.fetchall():
            creds[str(row["provider_id"])].append(row)
        cur.execute("select * from state_provider_contact")
        contacts = defaultdict(list)
        for row in cur.fetchall():
            contacts[str(row["provider_id"])].append(row)
        cur.execute("select * from state_service_geography")
        geos = defaultdict(list)
        for row in cur.fetchall():
            geos[str(row["provider_id"])].append(row)
        cur.execute(
            """
            select provider_id, event_family, event_type, event_date, case_number,
                   inspection_track_id, disposition_raw, is_final, source_locator,
                   source_as_of, retrieved_at, payload
            from state_regulatory_event
            """
        )
        events = defaultdict(list)
        for row in cur.fetchall():
            events[str(row["provider_id"])].append(row)
        print("BUILD_START", len(providers), flush=True)
        built = [
            build_one(
                p,
                creds[str(p["id"])],
                contacts[str(p["id"])],
                geos[str(p["id"])],
                events[str(p["id"])],
            )
            for p in providers
        ]
        paths = [r["future_path"] for r in built]
        if len(set(paths)) != len(paths):
            raise SystemExit("PATH_COLLISION")
        if len(built) != LOCKED["providers"]:
            raise SystemExit(f"COUNT {len(built)}")
        class_counts = Counter(r["cls"] for r in built)
        write = persist(cur, built)
        conn.commit()
        cohort = pick_cohort(built)
        contact_cov = {
            "phone": sum(1 for r in built if any(c["contact_kind"] == "phone" for c in contacts[str(r["provider_id"])])),
            "website": sum(1 for r in built if r["has_website"]),
            "administrator": sum(
                1
                for r in built
                if any(c["contact_kind"] == "administrator" for c in contacts[str(r["provider_id"])])
            ),
            "owner_licensee": sum(
                1
                for r in built
                if any(c["contact_kind"] == "owner_licensee" for c in contacts[str(r["provider_id"])])
            ),
            "financial_officer": sum(
                1
                for r in built
                if any(c["contact_kind"] == "financial_officer" for c in contacts[str(r["provider_id"])])
            ),
            "management_company": sum(
                1
                for r in built
                if any(c["contact_kind"] == "management_company" for c in contacts[str(r["provider_id"])])
            ),
        }
        name_slug_counts = Counter((r["profile_kind"], r["slug"]) for r in built)
        name_collisions = sum(1 for _, n in name_slug_counts.items() if n > 1)
        manifest = {
            "task": "FL-SEN-006",
            "contract_version": CONTRACT,
            "adapter_version": ADAPTER,
            "provider_count": len(built),
            "class_counts": dict(class_counts),
            "path_collisions": 0,
            "name_slug_collisions_within_kind": name_collisions,
            "write": write,
            "source_data_counts": LOCKED,
            "contact_coverage_providers": contact_cov,
            "qa_cohort": [
                {
                    "provider_id": str(r["provider_id"]),
                    "class": r["cls"],
                    "file": r["ahca_file_number"],
                    "path": r["future_path"],
                    "events": r["event_n"],
                    "status": r["status_raw"],
                }
                for r in cohort
            ],
            "generated_at": datetime.now(UTC).isoformat(),
            "snapshot_fingerprint": hashlib.sha256(
                json.dumps(sorted(r["source_fingerprint"] for r in built)).encode()
            ).hexdigest(),
        }
        DOCS.mkdir(exist_ok=True)
        (DOCS / "fl-sen-006-profile-manifest.json").write_text(
            json.dumps(manifest, indent=2, default=str) + "\n", encoding="utf-8"
        )
        (DOCS / "fl-sen-006-qa-cohort.json").write_text(
            json.dumps(manifest["qa_cohort"], indent=2) + "\n", encoding="utf-8"
        )
        print(json.dumps({"write": write, "classes": dict(class_counts), "name_slug_collisions": name_collisions}, default=str))
        print("PROFILE_OK", flush=True)
        return 0
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
