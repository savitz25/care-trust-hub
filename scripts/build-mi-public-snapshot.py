"""Build/check privacy-limited MI-SEN-001 page facts from the acquired source projections."""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/michigan/mi-sen-001"
TARGET = ROOT / "apps/web/src/data/michigan-public-snapshot.json"


def main() -> None:
    afc = json.loads((SOURCE / "afc-hfa.json").read_text(encoding="utf-8"))
    health = json.loads((SOURCE / "health-facilities.json").read_text(encoding="utf-8"))
    discipline = json.loads((SOURCE / "discipline.json").read_text(encoding="utf-8"))
    afc_by_license = {r["license"]: r for r in afc["records"]}
    licensed_hfa = [r for r in health["records"] if r["class"] == "Home For The Aged - HFA Licensed"]
    exempt_hfa = [r for r in health["records"] if r["class"] == "Home For The Aged - HFA Exempt"]
    actions = discipline["rows"]
    snapshot = {
        "afcRetrievedAt": afc["retrievedAt"],
        "afcSourceClock": afc["sourceClockNote"],
        "healthRetrievedAt": health["retrievedAt"],
        "disciplineRetrievedAt": discipline["retrievedAt"],
        "afcClassCounts": afc["classCounts"],
        "afcClassCapacity": {code: sum(r["capacity"] or 0 for r in afc["records"] if r["classCode"] == code) for code in afc["classCounts"]},
        "healthClassCounts": health["classCounts"],
        "exactHfaLegacyBridges": {
            "licensed": sum(r["legacyLicense"] in afc_by_license and afc_by_license[r["legacyLicense"]]["classCode"] == "AH" for r in licensed_hfa),
            "exempt": sum(r["legacyLicense"] in afc_by_license and afc_by_license[r["legacyLicense"]]["classCode"] == "XH" for r in exempt_hfa),
        },
        "disciplineRows": len(actions),
        "disciplineActionCounts": dict(sorted(Counter(r["action"] for r in actions).items())),
        "disciplineCurrentOpenAttachments": sum(r["license"] in afc_by_license for r in actions),
        "inspectionSample": {
            "stateLicense": "NH00000277",
            "facilityId": "464060",
            "reportType": "Licensure Survey",
            "reportDateAsPrinted": "10/23/2024",
            "source": "https://statelicensing.apps.lara.state.mi.us/details?license=1652",
        },
        "exactCmsBridges": 0,
        "graphWrites": 0,
    }
    assert any(r["license"] == snapshot["inspectionSample"]["stateLicense"] and r["facilityId"] == snapshot["inspectionSample"]["facilityId"] for r in health["records"])
    assert snapshot["disciplineCurrentOpenAttachments"] == 0
    rendered = json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n"
    if "--check" in sys.argv:
        assert TARGET.read_text(encoding="utf-8") == rendered
        print("MI-SEN-001 public snapshot check OK")
    else:
        TARGET.parent.mkdir(parents=True, exist_ok=True)
        TARGET.write_text(rendered, encoding="utf-8")
        print("MI-SEN-001 public snapshot built")


if __name__ == "__main__":
    main()
