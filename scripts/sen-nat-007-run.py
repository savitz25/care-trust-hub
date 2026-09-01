"""SEN-NAT-007 CHOW event derive, then idempotent rerun. Does not print secrets."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))

import psycopg  # noqa: E402
from psycopg import ClientCursor  # noqa: E402

from care_ingest.ownership_change_database import (  # noqa: E402
    derive_ownership_change_events,
)


def load_env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.pop("CARE_CMS_REFRESH_WRITES", None)


def public(result: dict) -> dict:
    keep = (
        "new_events",
        "new_parties",
        "new_links",
        "classified_event_writes",
        "inserted_legal_parties",
        "inserted_owner_info_parties",
        "inserted_links",
        "unknown_before",
        "unknown_after",
        "unknown_resolved",
        "effective_to_before",
        "effective_to_after",
        "public_writes",
        "census",
        "regression",
        "fingerprint",
        "hh_event_availability",
        "hospice_event_availability",
        "database_bytes_before",
        "database_bytes_after",
    )
    return {key: result[key] for key in keep if key in result}


def main() -> int:
    load_env()
    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        raise SystemExit("CARE_DATABASE_URL missing")
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    payload: dict = {}
    if mode in {"all", "migrate"}:
        print("=== APPLY 0025 ===", flush=True)
        sql = (
            ROOT / "db" / "migrations" / "0025_ownership_change_intelligence.sql"
        ).read_text(encoding="utf-8")
        with psycopg.connect(url, autocommit=True, cursor_factory=ClientCursor) as conn:
            conn.execute(sql)
        print("migration applied", flush=True)
    if mode in {"all", "derive", "idempotent"}:
        print("=== FIRST DERIVE ===", flush=True)
        first = derive_ownership_change_events(url)
        print(json.dumps(public(first), default=str), flush=True)
        payload["first"] = first
        print("=== SECOND DERIVE ===", flush=True)
        second = derive_ownership_change_events(url)
        print(json.dumps(public(second), default=str), flush=True)
        payload["second"] = second
    out = ROOT / "docs" / "sen-nat-007-events.json"
    out.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    print(f"wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
