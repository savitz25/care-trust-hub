"""Gated durable-worker ingest of Home Health and Hospice P0/P1 CMS sources."""

from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEW_KEYS = {
    "home-health-care-agencies",
    "home-health-patient-survey-hhcahps",
    "home-health-zip-codes",
    "home-health-agency-enrollments",
    "home-health-agency-all-owners",
    "hospice-general-information",
    "hospice-provider-data",
    "hospice-provider-cahps",
    "hospice-zip-data",
    "hospice-enrollments",
    "hospice-all-owners",
}


def load_env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ["CARE_CMS_REFRESH_WRITES"] = "true"


def main() -> int:
    load_env()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))
    from care_ingest.refresh import run_refresh
    from care_ingest.refresh_execute import execute_source_write
    from care_ingest.refresh_policy import topological_refresh_order

    order = [key for key in topological_refresh_order() if key in NEW_KEYS]
    print("WRITE_ORDER", order, flush=True)

    def write(dataset_key: str, **kwargs):
        print(f"WRITE_START {dataset_key}", flush=True)
        try:
            result = execute_source_write(dataset_key, **kwargs)
            print(
                f"WRITE_DONE {dataset_key} status={result.get('status')} "
                f"rows={result.get('rows_read')} idempotent={result.get('idempotent')}",
                flush=True,
            )
            return result
        except Exception as error:
            print(f"WRITE_FAIL {dataset_key} {type(error).__name__}: {error}", flush=True)
            raise

    report = run_refresh(
        mode="refresh",
        database_url=os.environ["CARE_DATABASE_URL"],
        data_root=ROOT / "data",
        trigger="manual",
        sources=order,
        environment=dict(os.environ),
        write_source=write,
    )
    dest = ROOT / "docs" / "sen-nat-003-write.json"
    dest.write_text(report.to_json(), encoding="utf-8")
    print(
        json.dumps(
            {
                "health": report.health,
                "writes_enabled": report.writes_enabled,
                "sources": [
                    {
                        "dataset_key": item.get("dataset_key"),
                        "status": item.get("status"),
                        "rows_read": item.get("rows_read"),
                        "error": item.get("error"),
                    }
                    for item in report.sources
                ],
            },
            indent=2,
            default=str,
        )
    )
    return 0 if report.health != "FAILED" else 1


if __name__ == "__main__":
    raise SystemExit(main())
