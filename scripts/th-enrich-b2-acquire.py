"""Acquire immutable public B2 releases for local review; never writes a database."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

import requests


ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "data" / "enrichment" / "th-enrich-b2" / "raw"
SOURCES = {
    "tx_icfiid": ("ICFIID.xlsx", "https://apps.hhs.texas.gov/providers/directories/ICFIID.xlsx", "TX_ICF_IID", "facility/provider directory row"),
    "tx_dahs": ("DAHS.xlsx", "https://apps.hhs.texas.gov/providers/directories/DAHS.xlsx", "TX_DAHS", "day-service provider directory row"),
    "tx_dahs_iss_only": ("dahs_issonly.xlsx", "https://apps.hhs.texas.gov/providers/directories/dahs_issonly.xlsx", "TX_DAHS_ISS_ONLY", "day-service provider directory row"),
    "ca_sea_20240730": ("sea_final_20240730.xlsx", "https://data.chhs.ca.gov/dataset/1e1e2904-1bfb-448c-97e1-cf3e228c9159/resource/7c885969-3349-427f-8696-fba4374cd7f8/download/sea_final_20240730.xlsx", "CA_PENALTY_EVIDENCE", "citation/penalty event row"),
}


def main() -> None:
    DEST.mkdir(parents=True, exist_ok=True)
    manifest_path = DEST.parent / "source-manifest.json"
    previous = {item["source_id"]: item for item in json.loads(manifest_path.read_text(encoding="utf-8"))} if manifest_path.exists() else {}
    manifest = []
    for source_id, (filename, url, target_class, grain) in SOURCES.items():
        path = DEST / filename
        if path.exists():
            body = path.read_bytes()
            retrieved_at = previous.get(source_id, {}).get("retrieved_at")
            ownership = previous.get(source_id, {}).get("ownership", "reused_local_release")
        else:
            response = requests.get(url, timeout=90)
            response.raise_for_status()
            body = response.content
            if not body.startswith(b"PK\x03\x04"):
                raise ValueError(f"{source_id}: response is not XLSX")
            path.write_bytes(body)
            retrieved_at = datetime.now(timezone.utc).isoformat()
            ownership = "acquired_for_b2"
        manifest.append({"source_id": source_id, "official_source": url, "retrieved_at": retrieved_at,
                         "filename": str(path.relative_to(ROOT)).replace('\\', '/'),
                         "sha256": hashlib.sha256(body).hexdigest(), "bytes": len(body),
                         "grain": grain, "target_class": target_class, "ownership": ownership})
    manifest.extend(item for source_id, item in previous.items() if source_id not in SOURCES)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
