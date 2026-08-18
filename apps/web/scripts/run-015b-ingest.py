"""Run CA/NY/TX 015B ingest using CARE_DATABASE_URL. Not a consumer path."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))


def load_env() -> None:
    import os

    for relative in (".env.local", "apps/web/.env.local", "services/ingest/.env.local"):
        path = ROOT / relative
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key, value.strip().strip("'\""))


def main() -> int:
    load_env()
    import os

    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        raise SystemExit("CARE_DATABASE_URL is required")
    from care_ingest.state_regulator_database import ingest_state_source

    keys = sys.argv[1:] or [
        "ca-cdph-healthcare-facility-locations",
        "ny-doh-hfis-general-information",
        "tx-hhsc-nursing-facility-directory",
    ]
    reports = []
    for key in keys:
        print(f"INGEST {key}", flush=True)
        report = ingest_state_source(url, key)
        print(report.to_json(), flush=True)
        reports.append(json.loads(report.to_json()))
    print("ALL_DONE", json.dumps(reports), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
