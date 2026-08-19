from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

import psycopg

from care_ingest.assisted_living_database import (
    audit_assisted_living_database,
    persist_assisted_living_records,
)
from care_ingest.assisted_living_pilot import (
    load_local_pilot_payloads,
    parse_pilot_records,
    qa_publication_sample,
)
from care_ingest.migrations import apply_migration

ROOT = Path(__file__).resolve().parents[3]


def _load_database_url() -> str:
    if os.environ.get("CARE_DATABASE_URL"):
        return os.environ["CARE_DATABASE_URL"]
    for relative in (ROOT / ".env.local", ROOT / "apps" / "web" / ".env.local"):
        if not relative.is_file():
            continue
        for source_line in relative.read_text(encoding="utf-8").splitlines():
            line = source_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            if key.strip() == "CARE_DATABASE_URL":
                return value.strip().strip("'").strip('"')
    raise SystemExit("CARE_DATABASE_URL is required")


def main() -> None:
    database_url = _load_database_url()
    with psycopg.connect(database_url) as connection:
        exists = connection.execute(
            "SELECT to_regclass('public.assisted_living_provider')"
        ).fetchone()[0]
    if exists is None:
        apply_migration(database_url, ROOT / "db" / "migrations", "0020_assisted_living_pilot.sql")
    retrieved = datetime.now(UTC).isoformat()
    ca_csv, ny_general, ny_certs, tx_xlsx = load_local_pilot_payloads(ROOT / "data")
    records = parse_pilot_records(ca_csv, ny_general, ny_certs, tx_xlsx, retrieved)
    print(json.dumps({"parsed": len(records), "google_places_requests": 0}), flush=True)
    first = persist_assisted_living_records(database_url, records)
    second = persist_assisted_living_records(database_url, records)
    report = {
        "retrieved_at": retrieved,
        "google_places_requests": 0,
        "parsed": len(records),
        "first": first,
        "second": second,
        "audit": audit_assisted_living_database(database_url),
        "qa": qa_publication_sample(records),
    }
    print(json.dumps(report, indent=2, default=str))


if __name__ == "__main__":
    main()
