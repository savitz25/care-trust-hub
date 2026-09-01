"""SEN-NAT-004 set-based graph derive, then idempotent rerun. Does not print secrets."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services" / "ingest" / "src"))

from care_ingest.ownership_graph_database import (  # noqa: E402
    derive_ownership_graph,
    ownership_graph_report,
)


def load_env() -> None:
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    os.environ.pop("CARE_CMS_REFRESH_WRITES", None)


def public(result: dict) -> dict:
    return {
        key: result[key]
        for key in (
            "inserted_edges",
            "updated_edges",
            "inserted_name_observations",
            "batches",
            "parent_subsidiary_edges",
            "census",
            "cross_class",
            "network_size",
            "multi_state",
            "collisions",
            "regression",
            "database_bytes_before",
            "database_bytes_after",
            "baseline_before",
            "baseline_after",
        )
        if key in result
    }


def main() -> int:
    load_env()
    url = os.environ.get("CARE_DATABASE_URL")
    if not url:
        raise SystemExit("CARE_DATABASE_URL missing")
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    payload: dict = {}
    if mode in {"all", "report"}:
        print("=== COMMITTED GRAPH REPORT ===", flush=True)
        report = ownership_graph_report(url)
        print(json.dumps(report, default=str), flush=True)
        payload["report"] = report
    if mode in {"all", "derive", "idempotent"}:
        resume = mode != "idempotent"
        label = "IDEMPOTENT FULL RERUN" if mode == "idempotent" else "DERIVE"
        print(f"=== {label} ===", flush=True)
        derived = derive_ownership_graph(url, resume=resume)
        print(json.dumps(public(derived), default=str), flush=True)
        payload["derive"] = derived
    out = ROOT / "docs" / "sen-nat-004-graph.json"
    merged = {}
    if out.exists():
        merged = json.loads(out.read_text(encoding="utf-8"))
    merged.update(payload)
    out.write_text(json.dumps(merged, indent=2, default=str), encoding="utf-8")
    print(f"wrote {out}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
