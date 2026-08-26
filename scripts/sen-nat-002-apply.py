"""Apply SEN-NAT-002 migration and derive designations/NPI/directory status."""

from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env() -> None:
    path = ROOT / ".env.local"
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        if os.environ.get(k.strip()) in (None, ""):
            os.environ[k.strip()] = v.strip().strip('"').strip("'")


def main() -> None:
    load_env()
    url = os.environ["CARE_DATABASE_URL"]
    from care_ingest.migrations import apply_migration
    from care_ingest.cms_designations import derive_cms_designations
    from care_ingest.directory_status import derive_directory_status
    from care_ingest.facility_npi import derive_facility_npi

    import psycopg

    with psycopg.connect(url) as connection:
        exists = connection.execute(
            "SELECT to_regclass('public.cms_facility_designation') IS NOT NULL"
        ).fetchone()[0]
    if not exists:
        apply_migration(url, ROOT / "db" / "migrations", "0021_nursing_home_national_evidence.sql")
    result = {
        "migration": "0021_nursing_home_national_evidence.sql",
        "designations": derive_cms_designations(url),
        "npi": derive_facility_npi(url),
        "directory": derive_directory_status(url),
    }
    dest = ROOT / "docs" / "sen-nat-002-derive-report.json"
    dest.write_text(json.dumps(result, default=str, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, default=str, indent=2))


if __name__ == "__main__":
    main()
