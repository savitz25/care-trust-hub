"""Retain DIAL assisted-living program certifications at certification grain."""
import csv
import hashlib
import io
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "data/iowa/ia-sen-001"
URL = "https://idh-be.iowa.gov/api/v1/datasets/562/rows.csv"

def main():
    response = requests.get(URL, timeout=90)
    response.raise_for_status()
    content = response.content
    rows = list(csv.DictReader(io.StringIO(content.decode("utf-8-sig"))))
    ids = [r["certification_no"].strip() for r in rows]
    assert all(ids) and len(ids) == len(set(ids))
    snapshot = {
        "contract": "iowa-assisted-living-programs-v1",
        "catalog": "https://data.iowa.gov/catalog/dataset/562",
        "source": URL,
        "regulator": "Iowa Department of Inspections, Appeals, and Licensing",
        "grain": "Assisted living program certification number; not a unique campus or nursing facility license",
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "catalogLastUpdated": "2025-10-30",
        "sha256": hashlib.sha256(content).hexdigest(),
        "rawRows": len(rows),
        "distinctCertificationNumbers": len(set(ids)),
        "dementiaSpecific": [{"sourceValue": value, "programs": count} for value, count in sorted(Counter(r["dementia_specific"].strip() or "Unspecified" for r in rows).items())],
        "graphWrites": 0,
    }
    DEST.mkdir(parents=True, exist_ok=True)
    (DEST / "assisted-living-programs-release.csv").write_bytes(content)
    (DEST / "assisted-living-snapshot.json").write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: snapshot[k] for k in ("rawRows", "distinctCertificationNumbers", "sha256", "retrievedAt")}, indent=2))

if __name__ == "__main__":
    main()
