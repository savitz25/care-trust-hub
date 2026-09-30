"""Local, read-only audit of B2 releases. Output is not a current roster."""

from __future__ import annotations

import collections
import gzip
import hashlib
import json
import re
from datetime import date, datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "enrichment" / "th-enrich-b2"
RAW = BASE / "raw"


def cell(value):
    if isinstance(value, (date, datetime)):
        return value.date().isoformat() if isinstance(value, datetime) else value.isoformat()
    return str(value).strip() if value is not None else ""


def table(filename, header_row):
    sheet = load_workbook(RAW / filename, read_only=True, data_only=True).active
    rows = sheet.values
    for _ in range(header_row - 1):
        next(rows)
    columns = [cell(x) for x in next(rows)]
    return [dict(zip(columns, map(cell, row))) for row in rows if any(cell(x) for x in row)]


def stage(filename, rows):
    destination = BASE / "staged" / filename
    destination.parent.mkdir(parents=True, exist_ok=True)
    with gzip.open(destination, "wt", encoding="utf-8", newline="\n") as output:
        for row in rows:
            output.write(json.dumps(row, sort_keys=True) + "\n")


def audit_texas(filename, label):
    rows = table(filename, 2)
    stage(label.lower() + ".jsonl.gz", [
        {"source_class": label, "source_row": index, "facility_id": r["Facility ID"],
         "license_number": r["License No"], "program_type": r["Program Type"],
         "facility_name": r["Facility Name"], "facility_licensed": r["Facility  Licensed"],
         "facility_certified": r["Facility Certified"], "license_effective_date": r["License Effective Date"],
         "license_expiration_date": r["License Expiration Date"], "county": r["County"],
         "physical_address": r["Physical Address"], "city": r["Physical Address CITY"],
         "state": r["Physical Address State"], "zip": r["Physical Address Zipcode"]}
        for index, r in enumerate(rows, 3)])
    ids = [r["Facility ID"] for r in rows]
    licenses = [r["License No"] for r in rows]
    return {"class": label, "raw_rows": len(rows), "parsed_rows": len(rows),
            "unique_facility_ids": len(set(ids)), "missing_facility_ids": ids.count(""),
            "duplicate_facility_ids": {k: v for k, v in collections.Counter(ids).items() if v > 1},
            "unique_license_numbers": len(set(licenses) - {""}),
            "duplicate_license_numbers": {k: v for k, v in collections.Counter(licenses).items() if k and v > 1},
            "program_type": dict(collections.Counter(r["Program Type"] for r in rows)),
            "facility_licensed": dict(collections.Counter(r["Facility  Licensed"] for r in rows)),
            "facility_certified": dict(collections.Counter(r["Facility Certified"] for r in rows)),
            "source_title": load_workbook(RAW / filename, read_only=True, data_only=True).active.cell(1, 1).value,
            "identity_key": "TX|HHSC|" + label + "|{Facility ID}",
            "exact_existing_bridges": None, "bridge_status": "unmeasured: no owned row-level facility-ID spine in this packet",
            "denominator_treatment": "new class candidate only; no current roster publication"}


def audit_california():
    rows = table("sea_final_20240730.xlsx", 1)
    stage("ca_penalty_evidence.jsonl.gz", [dict(source_row=index, **row) for index, row in enumerate(rows, 2)])
    facids = [r["FACID"] for r in rows]
    keys = [r["PENALTY_NUMBER"] for r in rows]
    dates = sorted(r["PENALTY_ISSUE_DATE"] for r in rows if r["PENALTY_ISSUE_DATE"])
    return {"class": "CA_PENALTY_EVIDENCE", "raw_rows": len(rows), "parsed_rows": len(rows),
            "unique_facids": len(set(facids) - {""}), "missing_facids": facids.count(""),
            "unique_penalty_numbers": len(set(keys) - {""}), "missing_penalty_numbers": keys.count(""),
            "duplicate_penalty_numbers": {k: v for k, v in collections.Counter(keys).items() if k and v > 1},
            "date_range_issue": [dates[0], dates[-1]],
            "penalty_type": dict(collections.Counter(r["PENALTY_TYPE"] for r in rows)),
            "penalty_category": dict(collections.Counter(r["PENALTY_CATEGORY"] for r in rows)),
            "fac_type": dict(collections.Counter(r["FAC_TYPE_CODE"] for r in rows)),
            "exact_facid_bridges": None, "bridge_status": "unmeasured: owned CA snapshot has FACID counts but no row-level FACID list",
            "event_key": "PENALTY_NUMBER; preserve original row and FACID; review duplicate numbers",
            "denominator_treatment": "evidence only; zero new facilities"}


def audit_illinois():
    path = RAW / "icc-mcis-legacy.html"
    if not path.exists():
        response = requests.get("https://icc.illinois.gov/docket/mcis-legacy", timeout=60)
        response.raise_for_status()
        path.write_bytes(response.content)
    soup = BeautifulSoup(path.read_bytes(), "html.parser")
    orders = []
    for card in soup.select("div.soi-icc-card-calendar"):
        link = card.select_one("h3 a")
        if not link:
            continue
        body = card.select_one("div.card-body")
        paragraphs = [p.get_text(" ", strip=True) for p in body.select("p")]
        filed = next((p.removeprefix("Filed: ") for p in paragraphs if p.startswith("Filed:")), "")
        authority = next((p.removeprefix("Authority Type(s): ") for p in paragraphs if "Authority Type(s):" in p), "")
        orders.append({"order_id": link.get_text(" ", strip=True), "url": "https://icc.illinois.gov" + link["href"],
                       "business_identity_text": body.select_one("h4").get_text(" ", strip=True),
                       "description": paragraphs[0] if paragraphs else "", "filed_date": filed,
                       "authority_types": authority,
                       "household_goods_tagged": "Household Goods Movers" in authority})
    (BASE / "icc-orders-staged.json").write_text(json.dumps(orders, indent=2) + "\n", encoding="utf-8")
    stage("il_legacy_orders.jsonl.gz", orders)
    ids = [x["order_id"] for x in orders]
    return {"class": "IL_LEGACY_MOTOR_CARRIER_ORDER", "raw_rows": len(orders), "parsed_rows": len(orders),
            "unique_order_ids": len(set(ids)), "duplicate_order_ids": {k: v for k, v in collections.Counter(ids).items() if v > 1},
            "household_goods_tagged": sum(x["household_goods_tagged"] for x in orders),
            "exact_carrier_bridges": None, "unmatched_orders": None,
            "bridge_status": "no licensed current carrier ID in owned Move records supplied to this Care worktree",
            "denominator_treatment": "historical evidence only; zero current movers",
            "source_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "retrieved_at": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}


def main():
    audit = {"tx_icfiid": audit_texas("ICFIID.xlsx", "TX_ICF_IID"),
             "tx_dahs": audit_texas("DAHS.xlsx", "TX_DAHS"),
             "tx_dahs_iss_only": audit_texas("dahs_issonly.xlsx", "TX_DAHS_ISS_ONLY"),
             "ca_sea_20240730": audit_california(), "il_mcis_legacy": audit_illinois()}
    (BASE / "audit.json").write_text(json.dumps(audit, indent=2) + "\n", encoding="utf-8")
    manifest_path = BASE / "source-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    il_path = RAW / "icc-mcis-legacy.html"
    il_entry = {"source_id": "il_mcis_legacy", "official_source": "https://icc.illinois.gov/docket/mcis-legacy",
                "retrieved_at": audit["il_mcis_legacy"]["retrieved_at"],
                "filename": str(il_path.relative_to(ROOT)).replace('\\', '/'),
                "sha256": audit["il_mcis_legacy"]["source_sha256"], "bytes": il_path.stat().st_size,
                "grain": "historical order card", "target_class": "IL_LEGACY_MOTOR_CARRIER_ORDER",
                "ownership": "acquired_for_b2"}
    manifest = [entry for entry in manifest if entry["source_id"] != "il_mcis_legacy"] + [il_entry]
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, indent=2))


if __name__ == "__main__":
    main()
