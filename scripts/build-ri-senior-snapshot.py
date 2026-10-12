#!/usr/bin/env python3
"""Acquire RI RIDOH's public license roster and retain source-native facility classes."""
import csv
import hashlib
import io
import json
from datetime import date, datetime, timezone
from pathlib import Path
import requests

URL = "https://datahealth.ri.gov/lists/licensees/download.php"
INDEX = "https://datahealth.ri.gov/lists/licensees/index.php"
CLASSES = {
    "Nursing Facility": ("Nursing Facility", "Nursing Facility"),
    "Assisted Living Residence": ("Assisted Living Residence", "Assisted Living Residence"),
    "Limited Health Service": ("Assisted Living Residence", "Limited Health Service"),
    "Special Care Unit": ("Assisted Living Residence", "Special Care Unit"),
    "Adult Day Care Program": ("Adult Day Care Program", "Adult Day Care Program"),
    "Home Care Provider": ("Home Care Provider", "Home Care Provider"),
    "Home Nursing Care Provider": ("Home Nursing Care Provider", "Home Nursing Care Provider"),
    "Home Nursing Care Branch": ("Home Nursing Care Provider", "Home Nursing Care Branch"),
    "Hospice Provider": ("Hospice Provider", "Hospice Provider"),
    "Hospice Provider Branch": ("Hospice Provider", "Hospice Provider Branch"),
    "ICF/MR (Group Home)-Federal": ("ICF/MR (Group Home)", "ICF/MR (Group Home)-Federal"),
}
KEEP = ("Name", "License No", "Profession", "License Type", "Status", "Issue Date",
        "Specialty", "Expiration Date", "License Address Line 1", "License Address Line 2",
        "City", "State", "Zip", "Total Capacity Beds", "Alzheimer/Special Care Unit Beds",
        "Skilled Nursing Facility Beds", "Long-Term Care Beds", "Skilled/Long-Term Care Beds",
        "Private Pay Beds")

session = requests.Session()
page = session.get(INDEX, timeout=45)
page.raise_for_status()
updated = None
for pattern in (r"Last Updated on:\s*[^,]+,\s*(\d{1,2}(?:st|nd|rd|th)?\s+\w+\s+\d{4})", r"Last\s+Updated\s*:?\s*(\w+\s+\d{1,2},?\s+\d{4})", r"Last Updated[^<]{0,20}(\d{4}-\d{2}-\d{2})"):
    import re
    m = re.search(pattern, page.text, re.I)
    if m:
        updated = m.group(1)
        break

rows = []
sources = []
artifact_dir = Path(__file__).resolve().parents[1] / "artifacts/ri-sen-001/raw"
artifact_dir.mkdir(parents=True, exist_ok=True)
page_artifact = artifact_dir / "ridoh-licensee-list.source"
page_artifact.write_bytes(page.content)
for source_class, (profession, license_type) in CLASSES.items():
    response = session.post(URL, data={"prof": profession, "licType": license_type}, timeout=60)
    response.raise_for_status()
    raw = response.content
    raw_name = f"{profession}--{license_type}.csv".replace("/", "-")
    (artifact_dir / raw_name).write_bytes(raw)
    parsed = list(csv.DictReader(io.StringIO(response.text)))
    selected = [row for row in parsed if row.get("License Type", "").strip() == source_class]
    # Retain only active roster records; inactive records remain part of acquisition metadata.
    active = [row for row in selected if row.get("Status", "").strip().casefold() == "active"]
    slim = [{key: (row.get(key) or "").strip() for key in KEEP} for row in active]
    licenses = [row["License No"] for row in slim if row["License No"]]
    rows.extend({"sourceClass": source_class, **row} for row in slim)
    sources.append({
        "class": source_class, "profession": profession, "licenseType": license_type,
        "url": URL, "retrievedAt": datetime.now(timezone.utc).isoformat(),
        "sha256": hashlib.sha256(raw).hexdigest(), "rawArtifact": f"artifacts/ri-sen-001/raw/{raw_name}", "rawRows": len(selected),
        "activeRows": len(active), "distinctActiveLicenseNumbers": len(set(licenses)),
        "statusCounts": {status: sum(1 for row in selected if row.get("Status", "").strip() == status)
                         for status in sorted({row.get("Status", "").strip() for row in selected})},
        "rowGrain": f"RIDOH {source_class} facility license row (License No)",
    })

snapshot = {
    "state": "Rhode Island", "sourcePage": INDEX, "sourceLastUpdated": updated,
    "retrievedAt": datetime.now(timezone.utc).isoformat(), "generatedAt": date.today().isoformat(),
    "sourcePageSha256": hashlib.sha256(page.content).hexdigest(),
    "sourcePageArtifact": "artifacts/ri-sen-001/raw/ridoh-licensee-list.source",
    "classes": sources, "rows": rows,
}
output = Path(__file__).resolve().parents[1] / "apps/web/src/data/rhode-island-senior-snapshot.json"
output.write_text(json.dumps(snapshot, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps({"path": str(output), "sourceLastUpdated": updated,
                  "classes": [{"class": x["class"], "rawRows": x["rawRows"],
                               "activeRows": x["activeRows"],
                               "distinctActiveLicenseNumbers": x["distinctActiveLicenseNumbers"]}
                              for x in sources]}, indent=2))
