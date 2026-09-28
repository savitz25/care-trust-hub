"""Freeze Connecticut DPH facility credentials from its public Socrata mirror.

Usage: python scripts/acquire-ct-senior.py acquire|check
Only facility classes are requested; personal credential classes and addresses are excluded.
"""
from __future__ import annotations

import hashlib
import json
import sys
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "connecticut" / "ct-sen-001" / "raw" / "dph-credentials.json"
OUT = ROOT / "apps" / "web" / "src" / "data" / "connecticut-public-snapshot.json"
API = "https://data.ct.gov/resource/ngch-56tr.json"
CLASSES = (
    "Assisted Living Service Agency",
    "Chronic & Convalescent Nursing Home",
    "Chronic & Convalescent Nursing Homes and Rest Home with Nursing Supervision",
    "Home Health Care",
    "Homemaker-Home Health Aide",
    "Hospice",
    "Residential Care Facility",
    "Rest Home with Nursing Supervision",
)
FIELDS = "credentialid,name,businessname,dba,type,fullcredentialcode,credentialtype,credentialnumber,credential,status,statusreason,active,issuedate,effectivedate,expirationdate,city,state,recordrefreshedon"


def get_release():
    names = ",".join("'" + name.replace("'", "''") + "'" for name in CLASSES)
    params = urllib.parse.urlencode({"$select": FIELDS, "$where": f"credential in({names}) and active='1'", "$order": "credential,fullcredentialcode", "$limit": "5000"})
    url = API + "?" + params
    request = urllib.request.Request(url, headers={"User-Agent": "SeniorTrustHub CT-SEN-001 public source snapshot"})
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()
        last_modified = response.headers.get("Last-Modified")
    rows = json.loads(payload)
    assert len(rows) < 5000, "Socrata limit reached; do not publish a partial roster"
    assert all(row["credential"] in CLASSES and row["active"] == "1" for row in rows)
    assert all(row["status"] in {"ACTIVE", "ACTIVE IN RENEWAL"} for row in rows)
    assert len({row["fullcredentialcode"] for row in rows}) == len(rows)
    retrieved = datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    return {"source": url, "retrievedAt": retrieved, "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"), "sourceLastModified": last_modified, "sourceResponseSha256": hashlib.sha256(payload).hexdigest(), "rows": rows}


def normalize(release):
    rows = release["rows"]
    kept = [{"credential": r["credential"], "license": r["fullcredentialcode"], "licenseNumber": r["credentialnumber"], "name": r.get("dba") or r.get("businessname") or r["name"], "status": r["status"], "effectiveDate": r.get("effectivedate"), "expirationDate": r.get("expirationdate"), "recordRefreshedOn": r.get("recordrefreshedon"), "city": r.get("city"), "state": r.get("state")} for r in rows]
    return {"contract": "ct-sen-001-public-v1", "source": release["source"], "retrievedAt": release["retrievedAt"], "generatedAt": release["generatedAt"], "sourceLastModified": release["sourceLastModified"], "sourceResponseSha256": release["sourceResponseSha256"], "classCounts": dict(Counter(r["credential"] for r in rows)), "statusCounts": dict(Counter(r["status"] for r in rows)), "rows": kept, "cmsExactBridges": 0, "graphWrites": 0, "newCanonicalFacilities": 0, "claimEligibilityChanged": False}


def main():
    mode = sys.argv[1] if len(sys.argv) == 2 else ""
    if mode not in {"acquire", "check"}:
        raise SystemExit("Usage: python scripts/acquire-ct-senior.py acquire|check")
    if mode == "acquire":
        release = get_release()
        RAW.parent.mkdir(parents=True, exist_ok=True)
        RAW.write_text(json.dumps(release, separators=(",", ":")), encoding="utf-8")
        OUT.parent.mkdir(parents=True, exist_ok=True)
        OUT.write_text(json.dumps(normalize(release), separators=(",", ":")), encoding="utf-8")
    else:
        release = json.loads(RAW.read_text(encoding="utf-8"))
        assert json.loads(OUT.read_text(encoding="utf-8")) == normalize(release)
    print(json.dumps({"mode": mode, "rows": len(release["rows"]), "counts": normalize(release)["classCounts"], "retrievedAt": release["retrievedAt"], "sourceLastModified": release["sourceLastModified"]}))


if __name__ == "__main__":
    main()
