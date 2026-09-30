"""Acquire only the official NYC DCWP Storage Warehouse category, never the HIC file."""

from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "enrichment" / "th-enrich-b2"
URL = "https://data.cityofnewyork.us/resource/w7w3-xahh.json"


def main():
    raw = BASE / "raw" / "nyc-dcwp-storage-warehouse.json"
    if not raw.exists():
        response = requests.get(URL, params={"$where": "business_category='Storage Warehouse'", "$limit": 5000, "$order": ":id"}, timeout=60)
        response.raise_for_status()
        raw.write_bytes(response.content)
        retrieved = datetime.now(timezone.utc).isoformat()
    else:
        retrieved = None
    rows = json.loads(raw.read_text(encoding="utf-8"))
    if not isinstance(rows, list) or len(rows) >= 5000 or any(r.get("business_category") != "Storage Warehouse" for r in rows):
        raise ValueError("bounded warehouse category audit failed")
    ids = [r.get("license_nbr", "") for r in rows]
    if not all(ids) or len(ids) != len(set(ids)):
        raise ValueError("missing or duplicate DCWP license number")
    staged = BASE / "staged" / "ny_storage_warehouse.csv"
    with staged.open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["source_class", "license_nbr", "business_unique_id", "business_name", "license_status", "license_creation_date", "license_expiration_date"])
        writer.writeheader()
        for row in rows:
            writer.writerow({"source_class": "NYC_STORAGE_WAREHOUSE", "license_nbr": row["license_nbr"],
                             "business_unique_id": row.get("business_unique_id", ""), "business_name": row.get("business_name", ""),
                             "license_status": row.get("license_status", ""), "license_creation_date": row.get("license_creation_date", ""),
                             "license_expiration_date": row.get("lic_expir_dd", "")})
    manifest_path = BASE / "source-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    prior = next((x for x in manifest if x["source_id"] == "nyc_dcwp_storage_warehouse"), None)
    manifest = [x for x in manifest if x["source_id"] != "nyc_dcwp_storage_warehouse"]
    manifest.append({"source_id": "nyc_dcwp_storage_warehouse", "official_source": URL,
                     "retrieved_at": retrieved or prior["retrieved_at"] if prior else retrieved,
                     "filename": str(raw.relative_to(ROOT)).replace("\\", "/"), "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(),
                     "bytes": raw.stat().st_size, "grain": "DCWP Storage Warehouse license row", "target_class": "NYC_STORAGE_WAREHOUSE",
                     "filter": "business_category='Storage Warehouse'", "ownership": "acquired_subset_for_b2"})
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    result = {"source_rows": len(rows), "unique_license_numbers": len(set(ids)), "status_distribution": dict(Counter(r.get("license_status", "") for r in rows)),
              "duplicate_license_numbers": 0, "mover_denominator_delta": 0}
    (BASE / "ny-warehouse-audit.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
