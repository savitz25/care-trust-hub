"""AL-SEN-001: check the published Alabama ADPH snapshot.

The Facilities Directory exports and the statistical-summary PDF stay outside
this repo. This check does not download them and does not scrape facility pages.
It checks the committed snapshot against the retrieval reconciled on 2026-10-05.

  python -X utf8 scripts/acquire-al-senior.py check
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps/web/src/data/alabama-public-snapshot.json"
FORBIDDEN = ("1719", "1,719", "59435", "59,435", "1225", "1,225", "01-G011", "01-1517")


def check() -> None:
    raw = OUT.read_text(encoding="utf-8")
    data = json.loads(raw)
    if "rows" in data:
        raise SystemExit("snapshot has a rows key")
    if data["combinedSeniorDenominator"] is not None:
        raise SystemExit("combined denominator must stay null")
    if data["cmsExactBridges"] != 0 or data["graphWrites"] != 0 or data["cityRoutes"] != 0:
        raise SystemExit("bridges, graph writes, or city routes are not zero")
    if data["nameOnlyAdverseJoins"] != 0 or data["specialFocusFacility"]["joinedToDirectoryFacId"]:
        raise SystemExit("an identity or adverse join was recorded")
    if data["statisticalSummary"]["allFacilityGrandTotalUsed"] is not False:
        raise SystemExit("all-facility grand total must stay unused")
    sources = {row["class"]: row for row in data["sources"]}
    expected = {
        "nursing-home": 232,
        "assisted-living": 187,
        "specialty-care-assisted-living": 107,
        "home-health": 197,
        "hospice": 188,
    }
    if set(sources) != set(expected):
        raise SystemExit(f"class set {sorted(sources)}")
    for key, count in expected.items():
        row = sources[key]
        if row["directoryRows"] != count or row["distinctFacIds"] != count:
            raise SystemExit(f"{key} row count drifted")
        labels = sum(item["count"] for item in row["licenseeType"])
        if labels != count:
            raise SystemExit(f"{key} licensee labels {labels} != {count}")
        status = sum(item["count"] for item in row["licenseStatus"])
        if status != count:
            raise SystemExit(f"{key} license status {status} != {count}")
    if sources["nursing-home"]["licensedBedsSum"] != 27342:
        raise SystemExit("nursing bed sum")
    if sources["home-health"]["licensedBedsSum"] is not None:
        raise SystemExit("home health bed sum must stay null")
    if sources["home-health"]["medicareNumberPrintedRows"] != 134:
        raise SystemExit("home health medicare cell count")
    if sources["hospice"]["licensedBedsSum"] != 99:
        raise SystemExit("hospice export bed sum")
    inpatient = sum(row["licensedBeds"] for row in data["hospiceInpatientBedRows"])
    if inpatient != 99 or len(data["hospiceInpatientBedRows"]) != 7:
        raise SystemExit("hospice inpatient beds")
    hospice_summary = data["statisticalSummary"]["classes"]
    hospice_line = next(row for row in hospice_summary if row["class"] == "hospice")["lines"][0]
    if hospice_line["licensedBedsOrStations"] != 100:
        raise SystemExit("hospice summary beds were changed to match the export")
    if data["adultDay"]["count"] is not None:
        raise SystemExit("adult day count must stay null")
    combined = sum(expected.values())
    if str(combined) in raw:
        raise SystemExit("combined class total was written into the snapshot")
    for token in FORBIDDEN:
        if token in raw:
            raise SystemExit(f"forbidden census token {token}")
    print("AL-SEN-001 snapshot check passed")


if __name__ == "__main__":
    if len(sys.argv) != 2 or sys.argv[1] != "check":
        raise SystemExit("usage: python -X utf8 scripts/acquire-al-senior.py check")
    check()
