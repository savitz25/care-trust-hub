"""SEN-NAT-005W durable-worker write. CARE_CMS_REFRESH_WRITES is process-local only."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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

    prewrite = json.loads((ROOT / "docs" / "sen-nat-005w-prewrite.json").read_text(encoding="utf-8"))
    discovered = [
        {
            "dataset_key": item["dataset_key"],
            "status": item["status"],
            "source_modified_at": item.get("source_modified_at"),
            "version_identifier": item.get("version_identifier"),
            "previous_checksum": item.get("previous_checksum"),
        }
        for item in prewrite["check"]["sources"]
        if item["status"] == "DISCOVERED"
    ]
    fingerprint = hashlib.sha256(
        json.dumps(discovered, sort_keys=True).encode("utf-8")
    ).hexdigest()
    print(f"COHORT_FINGERPRINT {fingerprint}", flush=True)
    print(f"COHORT_KEYS {[item['dataset_key'] for item in discovered]}", flush=True)
    (ROOT / "docs" / "sen-nat-005w-cohort.json").write_text(
        json.dumps(
            {
                "fingerprint": fingerprint,
                "captured_at": datetime.now(UTC).isoformat(),
                "discovered": discovered,
                "skipped": [
                    item["dataset_key"]
                    for item in prewrite["check"]["sources"]
                    if item["status"] != "DISCOVERED"
                ],
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

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

    url = os.environ["CARE_DATABASE_URL"]
    report = run_refresh(
        mode="refresh",
        database_url=url,
        data_root=ROOT / "data",
        trigger="manual",
        environment=dict(os.environ),
        write_source=write,
    )
    dest = ROOT / "docs" / "sen-nat-005w-write.json"
    dest.write_text(report.to_json(), encoding="utf-8")
    print(
        json.dumps(
            {
                "health": report.health,
                "writes_enabled": report.writes_enabled,
                "refresh_run_id": report.refresh_run_id,
                "directory": report.directory,
                "sources": [
                    {
                        "dataset_key": item.get("dataset_key"),
                        "status": item.get("status"),
                        "failure_class": item.get("failure_class"),
                        "rows_read": item.get("rows_read"),
                        "idempotent": item.get("idempotent"),
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
