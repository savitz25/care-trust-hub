"""SEN-NAT-008 intelligence snapshot, then idempotent rerun. Does not print secrets."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg
from psycopg import ClientCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))

from care_ingest.senior_intelligence_database import (  # noqa: E402
    materialize_senior_intelligence,
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
        "fingerprint",
        "new_definitions",
        "definition_writes",
        "limitation_writes",
        "snapshot_writes",
        "value_writes",
        "stored_values",
        "public_writes",
        "census",
        "cross_class",
        "network_size",
        "multi_state",
        "regression",
        "database_bytes_before",
        "database_bytes_after",
    )
    return {key: result[key] for key in keep if key in result}


def main() -> int:
    load_env()
    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        raise SystemExit("CARE_DATABASE_URL missing")
    print("=== APPLY 0026 ===", flush=True)
    sql = (ROOT / "db" / "migrations" / "0026_senior_intelligence.sql").read_text(
        encoding="utf-8"
    )
    with psycopg.connect(url, autocommit=True, cursor_factory=ClientCursor) as conn:
        conn.execute(sql)
    print("=== FIRST MATERIALIZE ===", flush=True)
    first = materialize_senior_intelligence(url)
    print(json.dumps(public(first), default=str), flush=True)
    print("=== SECOND MATERIALIZE ===", flush=True)
    second = materialize_senior_intelligence(url)
    print(json.dumps(public(second), default=str), flush=True)
    out = ROOT / "docs" / "sen-nat-008-intelligence.json"
    out.write_text(
        json.dumps({"first": first, "second": second}, indent=2, default=str),
        encoding="utf-8",
    )
    print(f"wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
