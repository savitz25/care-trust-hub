"""IN-SEN-001: freeze Indiana Department of Health statewide senior-care directories (stdlib only).

Sources (IDOH Health Care Regulatory Services, QAMIS statewide listings):
  LTC Facility Directory (Comprehensive Care licenses, with residential beds where supplied),
  Residential Care Facility Directory, Home Health Agency Directory, Hospice Facility Directory.

Raw pages carry administrator names and phone numbers; they stay in the gitignored raw folder.
The committed snapshot keeps facility name, city, ZIP, license number, printed expiration and bed fields.
No directory prints a CMS CCN, so no state-to-CMS bridge is made and no name-based join is attempted.

  python -X utf8 scripts/acquire-in-senior.py fetch   # download raw pages, then build
  python -X utf8 scripts/acquire-in-senior.py build   # rebuild the snapshot from raw pages
  python -X utf8 scripts/acquire-in-senior.py check   # raw present: rebuild must match; absent: invariants only
"""

from __future__ import annotations

import hashlib
import html
import json
import re
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/indiana/in-sen-001/raw"
OUT = ROOT / "apps/web/src/data/indiana-public-snapshot.json"
BASE = "https://www.in.gov/health/reports/QAMIS/"
SOURCES = [
    ("comprehensive-care", "ltcdir/wdirltc.htm", "wdirltc.htm", "LTC Facility Directory (Comprehensive Care)"),
    ("residential-care", "resdir/wdirres.htm", "wdirres.htm", "Residential Care Facility Directory"),
    ("home-health-agency", "hhadir/wdirHha.htm", "wdirHha.htm", "Home Health Agency Directory"),
    ("hospice", "hspcdir/wdirHsp.htm", "wdirHsp.htm", "Hospice Facility Directory"),
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"
LICENSE = re.compile(r"\d{2}-\d{6}-\d")
BEDS = ("SNF", "NF", "SNF/NF", "NCC", "RES")


def text(fragment: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def fetch() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    meta = {}
    for _, path, filename, _ in SOURCES:
        req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read()
            meta[filename] = {"retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                              "httpLastModified": resp.headers.get("Last-Modified")}
        (RAW / filename).write_bytes(body)
    (RAW / "fetch-meta.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")


def parse(source_class: str, raw: str, retrieved: date) -> tuple[str, list[dict]]:
    posted = re.search(r"Posted to the Web on:</strong>\s*([\d/]+)", raw)
    if not posted:
        raise SystemExit(f"{source_class}: posting date missing")
    rows = []
    for block in re.findall(r'<div class="provider">(.*?)</div>', raw, re.S):
        heading = re.search(r"<h3>(.*?)</h3>", block, re.S)
        paras = [text(p) for p in re.findall(r"<p>(.*?)</p>", block, re.S)]
        name = text(heading.group(1)) if heading else paras[0]
        name = re.sub(r"\s*\(Residential\)\s*$", "", name)
        fields = {}
        for p in paras:
            m = re.match(r"(License Number|License #|Lic Expire Date|Bed Capacity|Bed Breakdown|Counties Served):\s*(.*)", p)
            if m:
                fields[m.group(1).replace("License #", "License Number")] = m.group(2).strip()
        city_zip = next((p for p in paras if re.search(r",\s+\d{5}$", p)), "")
        city, zip_code = (re.match(r"(.*?),\s+(\d{5})$", city_zip).groups() if city_zip else ("", ""))
        printed = fields.get("License Number", "")
        license_id = printed if LICENSE.fullmatch(printed) else None
        expires = fields.get("Lic Expire Date", "")
        try:
            exp = datetime.strptime(expires, "%m/%d/%Y").date()
        except ValueError:
            exp = None
        row = {
            "class": source_class,
            "name": name,
            "city": city.title(),
            "zip": zip_code,
            "license": license_id,
            "licenseAsPrinted": printed if printed and not license_id else None,
            "expires": exp.isoformat() if exp else None,
            "printedExpirationPassed": bool(exp and exp < retrieved),
        }
        if source_class == "comprehensive-care":
            beds = dict((k, int(n)) for n, k in re.findall(r"(\d+)\s+([A-Z/]+)", fields.get("Bed Breakdown", "")))
            if set(beds) != set(BEDS):
                raise SystemExit(f"bed breakdown schema changed: {fields.get('Bed Breakdown')}")
            row["bedCapacity"] = int(fields["Bed Capacity"])
            row["beds"] = {k: beds[k] for k in BEDS}
        if source_class in ("home-health-agency", "hospice"):
            counties = [c.strip() for c in fields.get("Counties Served", "").split(",") if c.strip()]
            row["countiesServed"] = len(counties)
        rows.append(row)
    return datetime.strptime(posted.group(1), "%m/%d/%Y").date().isoformat(), rows


def build() -> dict:
    meta = json.loads((RAW / "fetch-meta.json").read_text(encoding="utf-8"))
    sources, rows = [], []
    for source_class, path, filename, label in SOURCES:
        raw_bytes = (RAW / filename).read_bytes()
        retrieved = datetime.fromisoformat(meta[filename]["retrievedAt"])
        posted, class_rows = parse(source_class, raw_bytes.decode("utf-8", "replace"), retrieved.date())
        licensed = [r["license"] for r in class_rows if r["license"]]
        source = {
            "class": source_class,
            "label": label,
            "url": BASE + path,
            "postedToWeb": posted,
            "retrievedAt": meta[filename]["retrievedAt"],
            "sha256": hashlib.sha256(raw_bytes).hexdigest(),
            "rows": len(class_rows),
            "distinctLicenses": len(set(licensed)),
            "rowsWithoutStandardLicense": sum(1 for r in class_rows if not r["license"]),
            "rowsWithoutExpiration": sum(1 for r in class_rows if not r["expires"]),
            "rowsPrintedExpirationPassed": sum(r["printedExpirationPassed"] for r in class_rows),
            "rowsWithCcn": 0,
        }
        if source_class == "comprehensive-care":
            source["bedCapacity"] = sum(r["bedCapacity"] for r in class_rows)
            source["beds"] = {k: sum(r["beds"][k] for r in class_rows) for k in BEDS}
            source["rowsWithResidentialBeds"] = sum(1 for r in class_rows if r["beds"]["RES"] > 0)
        sources.append(source)
        rows.extend(class_rows)
    by_class = {}
    for r in rows:
        if r["license"]:
            by_class.setdefault(r["class"], set()).add(r["license"])
    cross = sum(len(by_class[a] & by_class[b]) for i, a in enumerate(by_class) for b in list(by_class)[i + 1:])
    return {
        "regulator": "Indiana Department of Health, Health Care Regulatory Services",
        "generatedAt": max(s["retrievedAt"] for s in sources),
        "sources": sources,
        "crossClassLicenseOverlap": cross,
        "cmsExactBridges": 0,
        "cmsBridgeReason": "No IDOH directory prints a CMS CCN; state and CMS populations stay separate.",
        "inspectionIndex": "NOT_ACQUIRED",
        "inspectionExactAttachments": 0,
        "enforcementRows": "NOT_ACQUIRED",
        "enforcementExactAttachments": 0,
        "complaintIntake": "KNOWN",
        "complaintProviderRows": "NOT_ACQUIRED",
        "nameOnlyAdverseJoins": 0,
        "newCanonicalFacilities": 0,
        "graphWrites": 0,
        "claimEligibilityChanges": 0,
        "fieldsDropped": ["street", "administrator", "telephone", "fax", "countiesServedList"],
        "rows": rows,
    }


def serialize(snapshot: dict) -> str:
    return json.dumps(snapshot, indent=1, ensure_ascii=False) + "\n"


def check() -> None:
    committed = json.loads(OUT.read_text(encoding="utf-8"))
    if (RAW / "fetch-meta.json").exists():
        if OUT.read_text(encoding="utf-8") != serialize(build()):
            raise SystemExit("IN-SEN-001 snapshot does not match raw IDOH pages")
        print("IN-SEN-001 snapshot matches raw IDOH pages")
    for source in committed["sources"]:
        rows = [r for r in committed["rows"] if r["class"] == source["class"]]
        assert len(rows) == source["rows"], source["class"]
        assert len({r["license"] for r in rows if r["license"]}) == source["distinctLicenses"], source["class"]
    assert all(not ({"street", "administrator", "telephone", "phone", "fax"} & set(r)) for r in committed["rows"])
    print("IN-SEN-001 snapshot invariants PASS")


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "build"
    if mode == "fetch":
        fetch()
        mode = "build"
    if mode == "build":
        snap = build()
        OUT.write_text(serialize(snap), encoding="utf-8")
        for s in snap["sources"]:
            print(s["class"], s["postedToWeb"], s["rows"], s["distinctLicenses"], s["rowsWithoutStandardLicense"], s["rowsPrintedExpirationPassed"])
    elif mode == "check":
        check()
