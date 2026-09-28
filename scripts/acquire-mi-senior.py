"""MI-SEN-001: public LARA exports to privacy-minimized, source-traceable snapshots.

Raw AFC records contain individual licensee contact fields. Do not commit the raw file.
The committed projection retains only facility identifiers and care attributes.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import subprocess
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

from openpyxl import load_workbook


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "michigan" / "mi-sen-001"
AFC_URL = "https://documents.apps.lara.state.mi.us/bchs/afc_sw.txt"
EXPORT = "https://statelicensing.apps.lara.state.mi.us/home/downloadExcel?licenseNumber=&legacyFacilityId=&licenseName=&licenseeEntityName=&address=&city=&zip=&county=Any&primaryStatus=ACTIVE&serviceCategory=Any&orderBy=LicenseName&direction=ascending&licenseType="
CLASSES = {
    "NursingHome": "Nursing Home",
    "HospiceAgency": "Hospice Agency",
    "HospiceResidence": "Hospice Residence",
    "HomesForTheAgedLicensed": "Home For The Aged - HFA Licensed",
    "HomesForTheAgedExempt": "Home For The Aged - HFA Exempt",
}


def get(url: str) -> bytes:
    return subprocess.run(["curl.exe", "-fsSL", "--retry", "2", url], check=True, capture_output=True).stdout


def date(value: str) -> str | None:
    return f"{value[:4]}-{value[4:6]}-{value[6:8]}" if len(value) == 8 and value.isdigit() else None


def write(name: str, value: dict) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / name).write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def acquire() -> None:
    clock = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    headers = subprocess.run(["curl.exe", "-fsSI", AFC_URL], check=True, capture_output=True).stdout.decode("ascii", errors="replace")
    modified = next((line.split(":", 1)[1].strip() for line in headers.splitlines() if line.lower().startswith("last-modified:")), None)
    raw = get(AFC_URL)
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig", errors="strict"))))
    if not rows or any(len(row) != 31 for row in rows):
        raise ValueError("Unexpected AFC record width")
    records = []
    for r in rows:
        if not r[2].startswith(r[1]) or r[30] != "ACTIVE":
            raise ValueError(f"Unexpected AFC identity/status {r[2]}")
        records.append({
            "license": r[2], "classCode": r[1], "facilityName": r[3],
            "capacity": int(r[10]), "effectiveDate": date(r[11]), "expirationDate": date(r[12]),
            "licenseStatus": r[13], "facilityStatus": r[30],
            "servesAged": r[17], "servesAlzheimers": r[19],
            "servesPhysicallyDisabled": r[14], "servesDevelopmentallyDisabled": r[15],
            "servesMentalIllness": r[16], "servesBrainInjury": r[18],
            "specialCertificationDevelopmentalDisability": r[20],
            "specialCertificationMentalIllness": r[21],
        })
    if len({r["license"] for r in records}) != len(records):
        raise ValueError("Duplicate AFC license")
    records.sort(key=lambda r: r["license"])
    write("afc-hfa.json", {
        "source": AFC_URL, "retrievedAt": clock, "rawSha256": hashlib.sha256(raw).hexdigest(),
        "sourceClockNote": f"LARA says the file updates daily; HTTP Last-Modified for this release: {modified or 'not provided'}.",
        "privacy": "Raw licensee names, addresses, phone numbers and facility contact/address fields excluded.",
        "classCounts": dict(sorted(Counter(r["classCode"] for r in records).items())),
        "records": records,
    })

    exports = []
    release_hashes = {}
    for key, label in CLASSES.items():
        url = EXPORT + key
        data = get(url)
        release_hashes[key] = hashlib.sha256(data).hexdigest()
        table = list(load_workbook(io.BytesIO(data), read_only=True, data_only=True).active.values)
        header = [str(x) for x in table[0]]
        for raw_row in table[1:]:
            row = dict(zip(header, raw_row))
            if not row.get("License Number"):
                continue
            if row.get("Facility License Type") != label:
                raise ValueError(f"Unexpected facility class: {row.get('Facility License Type')}")
            beds = row.get("Total Facility Beds")
            exports.append({
                "license": str(row["License Number"]),
                "legacyLicense": str(row["Legacy License Number"]) if row.get("Legacy License Number") else None,
                "facilityId": str(row["Facility ID Number"]) if row.get("Facility ID Number") not in (None, "N/A") else None,
                "facilityName": str(row["Facility/DBA Name"]),
                "class": label, "licensedBeds": int(beds) if beds not in (None, "") else None,
            })
    if len({r["license"] for r in exports}) != len(exports):
        raise ValueError("Duplicate health-facility license")
    exports.sort(key=lambda r: (r["class"], r["license"]))
    write("health-facilities.json", {
        "source": "https://www.michigan.gov/lara/bureau-list/bchs/directory",
        "exportUrlTemplate": EXPORT, "retrievedAt": clock,
        "statusFilter": "ACTIVE", "rawSha256ByClass": release_hashes,
        "privacy": "Facility license, legacy license, facility ID, name, class and beds only; no addresses or contacts.",
        "classCounts": dict(sorted(Counter(r["class"] for r in exports).items())),
        "records": exports,
    })


def check() -> None:
    afc = json.loads((OUT / "afc-hfa.json").read_text(encoding="utf-8"))
    health = json.loads((OUT / "health-facilities.json").read_text(encoding="utf-8"))
    if Counter(r["classCode"] for r in afc["records"]) != afc["classCounts"]:
        raise ValueError("AFC class count mismatch")
    if Counter(r["class"] for r in health["records"]) != health["classCounts"]:
        raise ValueError("Health-facility class count mismatch")
    if any(set(r) - {"license", "classCode", "facilityName", "capacity", "effectiveDate", "expirationDate", "licenseStatus", "facilityStatus", "servesAged", "servesAlzheimers", "servesPhysicallyDisabled", "servesDevelopmentallyDisabled", "servesMentalIllness", "servesBrainInjury", "specialCertificationDevelopmentalDisability", "specialCertificationMentalIllness"} for r in afc["records"]):
        raise ValueError("Unexpected private AFC field")
    print("MI-SEN-001 source projection check OK", len(afc["records"]), len(health["records"]))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=("acquire", "check"))
    args = parser.parse_args()
    acquire() if args.mode == "acquire" else check()
