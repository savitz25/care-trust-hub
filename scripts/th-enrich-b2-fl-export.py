"""Use the public FloridaHealthFinder 'Download as CSV' form for two classes."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "enrichment" / "th-enrich-b2"
ORIGIN = "https://quality.healthfinder.fl.gov"
CLASSES = {"fl_adult_day_care": ("Adult-DayCare", "FL_ADULT_DAY_CARE"),
           "fl_nurse_registry": ("Nurse-Registry", "FL_NURSE_REGISTRY")}


def main():
    manifest_path = BASE / "source-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    audits = {}
    if any(not (BASE / "raw" / f"{source_id}.csv").exists() for source_id in CLASSES):
        subprocess.run([sys.executable, str(ROOT / "scripts" / "th-enrich-b2-fl-browser-export.py")], check=True)
    for source_id, (route, target_class) in CLASSES.items():
        path = BASE / "raw" / f"{source_id}.csv"
        prior_retrieved = next((x.get("retrieved_at") for x in manifest if x["source_id"] == source_id), None)
        retrieved_at = prior_retrieved or datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        rows = list(csv.DictReader(io.StringIO(text)))
        if not rows:
            raise ValueError(f"{source_id}: no CSV rows")
        fields = list(rows[0])
        id_field = next((name for name in fields if "file number" in name.lower()), None)
        if not id_field:
            raise ValueError(f"{source_id}: no AHCA file number: {fields}")
        ids = [row.get(id_field, "").strip() for row in rows]
        if not all(ids):
            raise ValueError(f"{source_id}: blank AHCA file number")
        staged = BASE / "staged" / f"{source_id}.csv"
        with staged.open("w", newline="", encoding="utf-8") as stream:
            writer = csv.DictWriter(stream, fieldnames=["source_class", "ahca_file_number", "license_number", "license_status_raw", "official_name", "city", "county", "facility_type"])
            writer.writeheader()
            for row in rows:
                writer.writerow({"source_class": target_class, "ahca_file_number": row[id_field].strip(),
                                 "license_number": row.get("License Number", "").strip(),
                                 "license_status_raw": row.get("License Status", "").strip(),
                                 "official_name": row.get("Name", "").strip(), "city": row.get("Street City", "").strip(),
                                 "county": row.get("Street County", "").strip(), "facility_type": row.get("Facility Type", "").strip()})
        audit = {"source_rows": len(rows), "parsed_rows": len(rows), "unique_file_numbers": len(set(ids)),
                 "duplicate_file_numbers": {key: n for key, n in Counter(ids).items() if n > 1},
                 "columns": fields, "class": target_class,
                 "facility_type_distribution": dict(Counter(r.get("Facility Type", "") for r in rows)),
                 "license_status_distribution": dict(Counter(r.get("License Status", "") for r in rows)),
                 "nonblank_license_numbers": sum(bool(r.get("License Number", "").strip()) for r in rows)}
        audits[source_id] = audit
        manifest = [x for x in manifest if x["source_id"] != source_id]
        manifest.append({"source_id": source_id, "official_source": f"{ORIGIN}/Facility-Provider/{route}?handler=ExportAsCSV",
                         "retrieved_at": retrieved_at, "filename": str(path.relative_to(ROOT)).replace("\\", "/"),
                         "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "bytes": path.stat().st_size,
                         "grain": "AHCA licensed facility/provider export row", "target_class": target_class,
                         "ownership": "acquired_for_b2_source_access", "access": "public official CSV export form; no credentials"})
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (BASE / "fl-export-audit.json").write_text(json.dumps(audits, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audits, indent=2))


if __name__ == "__main__":
    main()
