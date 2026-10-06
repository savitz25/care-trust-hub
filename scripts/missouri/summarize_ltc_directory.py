"""Summarize Missouri DHSS LTC directory at its actual license-level grain."""
from __future__ import annotations

import csv
import hashlib
import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / "data/missouri/mo-sen-001"
SOURCE = BASE / "raw/dhss-ltc-directory-2026-10-05.csv"
META = BASE / "raw/socrata-view-metadata-2026-10-06.json"
OUT = ROOT / "apps/web/src/data/missouri-public-snapshot.json"

with SOURCE.open(encoding="utf-8-sig", newline="") as fh:
    rows = list(csv.DictReader(fh))
metadata = json.loads(META.read_text(encoding="utf-8"))
assert metadata["id"] == "fenu-sipv"
assert len(rows) == 1101
assert all(row["Facility Number"] and row["LicenseNumber"] for row in rows)
groups: dict[str, list[dict[str, str]]] = defaultdict(list)
for row in rows:
    groups[row["Level of Care"]].append(row)
expected = {"SNF", "ICF", "RCF", "RCF*", "ALF", "ALF**"}
assert set(groups) == expected

classes = []
for code in ("SNF", "ICF", "RCF", "RCF*", "ALF", "ALF**"):
    sample = groups[code]
    classes.append({
        "code": code,
        "rows": len(sample),
        "facilityNumbers": len({r["Facility Number"] for r in sample}),
        "licenseNumbers": len({r["LicenseNumber"] for r in sample}),
        "licensedCapacitySum": sum(int(r["Capacity"]) for r in sample if r["Capacity"].isdigit()),
    })

facility_classes: dict[str, set[str]] = defaultdict(set)
for row in rows:
    facility_classes[row["Facility Number"]].add(row["Level of Care"])
snapshot = {
    "source": "Missouri Department of Health and Senior Services, Section for Long-Term Care Regulation",
    "dataset": "LTC DIRECTORY (fenu-sipv)",
    "sourceUrl": "https://data.mo.gov/d/fenu-sipv",
    "csvUrl": "https://data.mo.gov/api/v3/views/fenu-sipv/export.csv?accessType=DOWNLOAD",
    "levelDefinitionsUrl": "https://health.mo.gov/providers/nursing-homes-other-long-term-care/level-licensure-long-term-care-facilities",
    "showMeLtcUrl": "https://healthapps.dhss.mo.gov/showmeltc/default.aspx",
    "administratorUrl": "https://health.mo.gov/board-nursing-home-administrators",
    "sourceRowsUpdatedAt": datetime.fromtimestamp(metadata["rowsUpdatedAt"], timezone.utc).isoformat(),
    "retrievedAt": "2026-10-06",
    "sourceSha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
    "rows": len(rows),
    "distinctFacilityNumbersAcrossClasses": len(facility_classes),
    "distinctLicenseNumbersAcrossClasses": len({r["LicenseNumber"] for r in rows}),
    "facilityNumbersWithMultipleClasses": sum(len(v) > 1 for v in facility_classes.values()),
    "classes": classes,
    "certificationCategoryRows": dict(Counter(r["Certification Cat"] or "blank" for r in rows)),
    "hospitalBasedLtc": "NOT_ACQUIRED",
    "inspections": "NOT_ACQUIRED",
    "complaints": "NOT_ACQUIRED",
    "deficiencies": "NOT_ACQUIRED",
    "enforcement": "NOT_ACQUIRED",
    "administratorLicenses": "NOT_ACQUIRED",
    "cmsOverlay": "NOT_ACQUIRED",
    "newCanonicalFacilities": 0,
    "evidenceAttachments": 0,
}
OUT.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
print(json.dumps({"rows": len(rows), "classes": classes, "facilities": len(facility_classes)}))
