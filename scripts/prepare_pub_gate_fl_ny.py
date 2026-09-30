"""Build the two pinned publication-gate CSVs; optionally verify fresh official exports."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data/enrichment/th-enrich-b2"
OUT = BASE / "publication-gate"
FL_SHA = "f93658aef11e59fd1f89e1f33e248c1a50f47386a2e48c1b103063e6296467af"
NY_SHA = "ae5c55e70d4c240b06ac9b537a8db8b8b227ed0148949415661db7395c294bca"
FL_LOAD_SHA = "793d55c849a21cf32a44a44b950978fb79e56bcceab8ff7f757148610d086478"
NY_LOAD_SHA = "2b9794a64516bc48c0bbd7e1370ac247e6966130ca116898ea2508ea437808ab"
NY_URL = "https://data.cityofnewyork.us/resource/w7w3-xahh.json"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def date(value: str) -> str:
    return datetime.strptime(value, "%m/%d/%Y %I:%M:%S %p").date().isoformat() if value else ""


def build() -> dict:
    OUT.mkdir(exist_ok=True)
    fl_raw = BASE / "raw/fl_nurse_registry.csv"
    ny_raw = BASE / "raw/nyc-dcwp-storage-warehouse.json"
    if sha(fl_raw) != FL_SHA or sha(ny_raw) != NY_SHA:
        raise ValueError("Pinned official source hash changed: stop for drift reconciliation")
    with fl_raw.open(encoding="utf-8-sig", newline="") as stream:
        florida = list(csv.DictReader(stream))
    new_york = json.loads(ny_raw.read_text(encoding="utf-8"))
    if len(florida) != 1356 or len(new_york) != 55:
        raise ValueError("Official source row count drifted")
    fl_ids = [r["AHCA Number (File Number)"].strip() for r in florida]
    ny_ids = [r["license_nbr"].strip() for r in new_york]
    if not all(fl_ids) or len(set(fl_ids)) != 1356 or not all(ny_ids) or len(set(ny_ids)) != 55:
        raise ValueError("Missing or duplicated authoritative native ID")
    if Counter(r["License Status"].strip() for r in florida) != {"LICENSED": 1291, "IN REVIEW": 65}:
        raise ValueError("Florida status distribution drifted")
    if sum(bool(r["Closed Date"].strip()) for r in florida if r["License Status"] == "LICENSED") != 2:
        raise ValueError("Florida closed-date exception count drifted")
    if any(r["Facility Type"] != "Nurse Registry" for r in florida):
        raise ValueError("Florida class drifted")
    if Counter(r["license_status"] for r in new_york) != {"Active": 35, "Surrendered": 12, "Expired": 8}:
        raise ValueError("New York status distribution drifted")
    if any(r.get("business_category") != "Storage Warehouse" for r in new_york):
        raise ValueError("New York category drifted")

    fl_out = OUT / "fl_nurse_registry_load.csv"
    with fl_out.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["ahca_file_number", "license_number", "healthfinder_lid", "official_name", "license_status_raw", "closed_on", "license_effective_on", "license_expires_on", "publication_label", "record_fingerprint"])
        writer.writeheader()
        for r in florida:
            status = r["License Status"].strip()
            closed = date(r["Closed Date"].strip())
            label = "In review" if status == "IN REVIEW" else "Licensed — closed date reported" if closed else "Licensed"
            row = {"ahca_file_number": r["AHCA Number (File Number)"].strip(), "license_number": r["License Number"].strip(), "healthfinder_lid": r["License ID"].strip(),
                   "official_name": r["Name"].strip(), "license_status_raw": status, "closed_on": closed,
                   "license_effective_on": date(r["License Effective Date"].strip()),
                   "license_expires_on": date(r["License Expiration Date"].strip()), "publication_label": label}
            row["record_fingerprint"] = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            writer.writerow(row)

    ny_out = OUT / "nyc_storage_warehouse_load.csv"
    with ny_out.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["license_nbr", "business_unique_id", "business_name", "license_status", "license_type", "license_creation_on", "license_expiration_on", "publication_label", "record_fingerprint"])
        writer.writeheader()
        for r in new_york:
            status = r["license_status"]
            row = {"license_nbr": r["license_nbr"], "business_unique_id": r.get("business_unique_id", ""),
                   "business_name": r["business_name"], "license_status": status, "license_type": r.get("license_type", ""),
                   "license_creation_on": r.get("license_creation_date", "")[:10], "license_expiration_on": r.get("lic_expir_dd", "")[:10],
                   "publication_label": {"Active": "NYC storage warehouse license — active", "Surrendered": "NYC storage warehouse license — surrendered", "Expired": "NYC storage warehouse license — expired"}[status]}
            row["record_fingerprint"] = hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
            writer.writerow(row)
    if sha(fl_out) != FL_LOAD_SHA or sha(ny_out) != NY_LOAD_SHA:
        raise ValueError("Derived release CSV hash changed: STOP for packet review")
    receipt = {"fl_source_sha256": FL_SHA, "fl_csv_sha256": FL_LOAD_SHA, "fl_rows": 1356,
               "ny_source_sha256": NY_SHA, "ny_csv_sha256": NY_LOAD_SHA, "ny_rows": 55,
               "source_as_of_ny": "2026-08-20", "production_mutations": False}
    (OUT / "receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    return receipt


def fresh_check() -> None:
    """Re-fetch both official subset exports and require byte-identical source releases."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(accept_downloads=True)
        page.goto("https://quality.healthfinder.fl.gov/Facility-Provider/Nurse-Registry?type=1", wait_until="domcontentloaded", timeout=60000)
        page.locator("#dropdownMenuButton1").click()
        with page.expect_download(timeout=60000) as pending:
            page.get_by_role("button", name="Download as CSV").click(no_wait_after=True, timeout=10000)
        fl_fresh = OUT / "fl_fresh_preflight.csv"
        pending.value.save_as(fl_fresh)
        browser.close()
    response = requests.get(NY_URL, params={"$where": "business_category='Storage Warehouse'", "$limit": 5000, "$order": ":id"}, timeout=60)
    response.raise_for_status()
    ny_fresh = OUT / "ny_fresh_preflight.json"
    ny_fresh.write_bytes(response.content)
    if sha(fl_fresh) != FL_SHA or sha(ny_fresh) != NY_SHA:
        raise ValueError("Fresh official export differs from pinned source: STOP; reconcile drift before execution")
    fl_fresh.unlink()
    ny_fresh.unlink()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-fresh", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build(), indent=2))
    if args.verify_fresh:
        fresh_check()
        print("Fresh official exports match pinned hashes")
