"""Snapshot Utah DHHS licensed-facility GIS without treating all classes as senior care."""

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


BASE = "https://services1.arcgis.com/99lidPhWCzftIe9K/ArcGIS/rest/services/LicensedHealthCareFacilities/FeatureServer/0"
ROOT = Path(__file__).resolve().parents[1] / "data" / "utah" / "ut-sen-001"
SENIOR_TYPES = {
    "Assisted Living Facility - Type I",
    "Assisted Living Facility - Type II",
    "Nursing Care Facility",
    "Home Health Agency",
    "Hospice",
    "Personal Care Agency",
    "Small Health Care Facility",
}


def get(path, params):
    with urlopen(f"{BASE}/{path}?{urlencode(params)}", timeout=60) as response:
        return json.load(response)


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    metadata = get("", {"f": "json"})
    result = get("query", {
        "where": "1=1", "outFields": "*", "returnGeometry": "false",
        "orderByFields": "OBJECTID", "f": "json",
    })
    if "error" in result or result.get("exceededTransferLimit"):
        raise RuntimeError("ArcGIS query incomplete")
    rows = [feature["attributes"] for feature in result["features"]]
    if len(rows) != len({row["OBJECTID"] for row in rows}):
        raise RuntimeError("Duplicate OBJECTID")
    count = get("query", {"where": "1=1", "returnCountOnly": "true", "f": "json"})["count"]
    if len(rows) != count:
        raise RuntimeError(f"Expected {count} rows, got {len(rows)}")
    raw = json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    (ROOT / "raw-feature-service.json").write_text(raw, encoding="utf-8")
    classes = Counter(row["LICENSE_TYPE"] for row in rows)
    summary = {
        "source": BASE,
        "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "sourceDataLastEditEpochMs": metadata.get("editingInfo", {}).get("dataLastEditDate"),
        "rawSha256": hashlib.sha256(raw.encode()).hexdigest(),
        "rawRows": count,
        "classes": dict(sorted(classes.items())),
        "seniorRelevantClasses": sorted(SENIOR_TYPES),
        "idNumberUniqueByClass": {
            kind: len({row["ID_NUMBER"] for row in rows if row["LICENSE_TYPE"] == kind and row["ID_NUMBER"]})
            for kind in SENIOR_TYPES
        },
        "graphWrites": 0,
        "exactEntityMatches": "NOT_ACQUIRED",
        "netNewEntities": 0,
    }
    (ROOT / "summary.json").write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
