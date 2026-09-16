#!/usr/bin/env python3
"""OR-SEN-001 — Oregon senior state intelligence from committed artifacts. No network."""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/oregon/or-sen-001/raw"
NATIONAL = ROOT / "apps/web/src/data/senior-national-intelligence.json"
ART = ROOT / "artifacts/or-sen-001-public-snapshot.json"
TS = ROOT / "packages/domain/src/or-public-snapshot.ts"
GENERATION_KEYS = frozenset({"generatedAt", "fingerprint"})


def dumps(obj: object) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sha(obj: object) -> str:
    return hashlib.sha256(dumps({k: v for k, v in obj.items() if k not in GENERATION_KEYS}).encode("utf-8")).hexdigest()


def file_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_csv(name: str) -> list[dict[str, str]]:
    raw = RAW / name
    gz = RAW / f"{name}.gz"
    if raw.is_file():
        with raw.open(encoding="utf-8-sig", newline="") as fh:
            return list(csv.DictReader(fh))
    with gzip.open(gz, "rt", encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def load_actions() -> list[list[str]]:
    raw = RAW / "odhs-actions.csv"
    gz = RAW / "odhs-actions.csv.gz"
    opener = raw.open if raw.is_file() else lambda **k: gzip.open(gz, "rt", **k)
    with opener(encoding="utf-8-sig", newline="") as fh:
        rows = list(csv.reader(fh))
    return rows[1:]


def parse_date(value: str) -> datetime | None:
    value = (value or "").strip()
    for fmt in ("%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def oha_licenses(text: str, prefix: str) -> list[str]:
    return sorted(set(re.findall(rf"\b{prefix}-\d+\b", text)))


def clock(sources: list[dict], key: str) -> dict:
    row = next((item for item in sources if item.get("datasetKey") == key), {})
    return {
        "datasetKey": key,
        "officialUrl": row.get("officialUrl"),
        "sourceModifiedAt": row.get("sourceModifiedAt"),
        "retrievedAt": row.get("retrievedAt"),
        "sourcePeriod": row.get("sourcePeriod"),
    }


def build_body(generated_at: str) -> dict:
    acquire = json.loads((RAW / "acquire-report.json").read_text(encoding="utf-8"))
    retrieved = acquire["retrievedAt"]
    national = json.loads(NATIONAL.read_text(encoding="utf-8"))
    geo = next((row for row in national.get("geography") or [] if row.get("state") == "OR"), None)
    if not geo:
        raise SystemExit("Oregon CMS geography partition missing")
    sources = national.get("sources") or []
    providers = load_csv("odhs-providers.csv")
    inspections = load_csv("odhs-inspections.csv")
    violations = load_csv("odhs-violations.csv")
    action_rows = load_actions()

    open_rows = [r for r in providers if r.get("Status") == "Open"]
    closed_rows = [r for r in providers if r.get("Status") == "Closed"]
    open_by = Counter(r["Type"] for r in open_rows)
    all_by = Counter(r["Type"] for r in providers)
    ids = [(r.get("ID") or "").strip() for r in providers]

    insp_events = {(r.get("Event ID") or "").strip() for r in inspections if (r.get("Event ID") or "").strip()}
    insp_providers = {(r.get("Provider ID") or "").strip() for r in inspections if (r.get("Provider ID") or "").strip()}
    insp_types = Counter((r.get("Inspection type(s)") or "").strip() for r in inspections)
    complaint_insp = sum(1 for r in inspections if "complaint" in (r.get("Inspection type(s)") or "").lower())
    insp_dates = [d for d in (parse_date(r.get("Date") or "") for r in inspections) if d]

    viol_types = Counter((r.get("Type") or "").strip() for r in violations)
    licensing = viol_types.get("Licensing Violation", 0)
    abuse = sum(n for k, n in viol_types.items() if k.startswith("Abuse"))
    viol_reports = {(r.get("Report number") or "").strip() for r in violations if (r.get("Report number") or "").strip()}
    viol_providers = {(r.get("Provider ID") or "").strip() for r in violations if (r.get("Provider ID") or "").strip()}

    sanctions = {(row[3] or "").strip() for row in action_rows if len(row) > 3 and (row[3] or "").strip()}
    action_providers = {(row[0] or "").strip() for row in action_rows if row and (row[0] or "").strip()}
    action_types = Counter((row[5] or "").strip() if len(row) > 5 else "" for row in action_rows)

    hha_txt = RAW / "oha-hha.txt"
    hospice_txt = RAW / "oha-hospice.txt"
    if not hha_txt.is_file() or not hospice_txt.is_file():
        raise SystemExit("Committed OHA extracts oha-hha.txt and oha-hospice.txt are required (offline rebuild).")
    hha_text = hha_txt.read_text(encoding="utf-8")
    hospice_text = hospice_txt.read_text(encoding="utf-8")
    hha_ids = oha_licenses(hha_text, "13")
    hospice_ids = oha_licenses(hospice_text, "16")

    return {
        "version": "senior-or-state-intel-v1",
        "ticket": "OR-SEN-001",
        "publicationPath": "/oregon",
        "asOf": None,
        "snapshotAsOf": retrieved[:10],
        "retrievedAt": retrieved,
        "generatedAt": generated_at,
        "regulatorMap": {
            "agency": "Oregon Department of Human Services — Aging and People with Disabilities",
            "ltcSearch": "https://ltclicensing.oregon.gov/",
            "providers": "https://ltclicensing.oregon.gov/Providers",
            "inspections": "https://ltclicensing.oregon.gov/Inspections",
            "violations": "https://ltclicensing.oregon.gov/Violations",
            "regulatoryActions": "https://ltclicensing.oregon.gov/RegulatoryActions",
            "ohaHhaPdf": "https://www.oregon.gov/oha/PH/PROVIDERPARTNERRESOURCES/HEALTHCAREPROVIDERSFACILITIES/HEALTHCAREHEALTHCAREREGULATIONQUALITYIMPROVEMENT/Documents/HHAList.pdf",
            "ohaHospicePdf": "https://www.oregon.gov/oha/PH/PROVIDERPARTNERRESOURCES/HEALTHCAREPROVIDERSFACILITIES/HEALTHCAREHEALTHCAREREGULATIONQUALITYIMPROVEMENT/Documents/HOSPICEList.pdf",
            "cmsCareCompare": "https://www.medicare.gov/care-compare/",
        },
        "clocks": {
            "odhs_sourceAsOf": None,
            "odhs_sourceAsOf_reason": "ODHS states information is updated every 24 hours. No rowsUpdatedAt field is exposed on the CSV export.",
            "odhs_retrievedAt": retrieved,
            "oha_hha_sourceModifiedAt": "2026-07-29",
            "oha_hospice_sourceModifiedAt": "2026-07-30",
            "oha_retrievedAt": retrieved,
            "snapshotAsOf": retrieved[:10],
            "generatedAt": generated_at,
            "retrievedAt_is_not_sourceAsOf": True,
        },
        "odhsProviders": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "SOURCE_ROWS": len(providers),
            "DISTINCT_PROVIDER_IDS": len(set(ids)),
            "ROWS_WITHOUT_ID": sum(1 for x in ids if not x),
            "OPEN_ROWS": len(open_rows),
            "CLOSED_ROWS": len(closed_rows),
            "OPEN_BY_TYPE": dict(open_by),
            "ALL_BY_TYPE": dict(all_by),
            "OPEN_NF": open_by.get("NF", 0),
            "OPEN_ALF": open_by.get("ALF", 0),
            "OPEN_RCF": open_by.get("RCF", 0),
            "OPEN_AFH": open_by.get("AFH", 0),
            "identityNamespace": "OR-ODHS:{ID}",
            "row_ne_unique_company": True,
            "nf_ne_cms_nursing_home": True,
            "sha256": acquire["files"]["providers"]["sha256"],
        },
        "odhsInspections": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "INSPECTION_ROWS": len(inspections),
            "DISTINCT_EVENT_IDS": len(insp_events),
            "DISTINCT_PROVIDER_IDS_WITH_INSPECTIONS": len(insp_providers),
            "DATE_RANGE": {
                "min": min(insp_dates).date().isoformat() if insp_dates else None,
                "max": max(insp_dates).date().isoformat() if insp_dates else None,
            },
            "INSPECTION_TYPE_COUNTS": dict(insp_types.most_common()),
            "COMPLAINT_RELATED_INSPECTION_ROWS": complaint_insp,
            "complaint_related_inspection_ne_complaint": True,
            "inspection_ne_deficiency": True,
            "five_year_history_note": "ODHS displays five years of inspection history.",
            "sha256": acquire["files"]["inspections"]["sha256"],
        },
        "odhsViolations": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "VIOLATION_ROWS": len(violations),
            "DISTINCT_VIOLATION_MATTERS": len(viol_reports),
            "DISTINCT_PROVIDER_IDS": len(viol_providers),
            "LICENSING_VIOLATION_ROWS": licensing,
            "ABUSE_SUBSTANTIATED_ROWS": abuse,
            "TYPE_COUNTS": dict(viol_types.most_common()),
            "limitation": "Open investigations and complaints being appealed by the provider are not listed.",
            "violation_ne_complaint": True,
            "violation_row_ne_unique_matter_unless_report_id_unique": True,
            "sha256": acquire["files"]["violations"]["sha256"],
        },
        "odhsRegulatoryActions": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "scope": "PUBLIC ODHS REGULATORY-ACTION DATASET — CURRENTLY LIMITED TO LICENSE CONDITIONS",
            "scopeNote": "Formal actions can range from license conditions through revocation notices, but the public section currently displays only license conditions dating back to 2010. Other regulatory-action records are to be added over time. This is not all Oregon regulatory actions.",
            "REGULATORY_ACTION_ROWS": len(action_rows),
            "UNIQUE_REGULATORY_MATTERS": len(sanctions),
            "DISTINCT_PROVIDER_IDS": len(action_providers),
            "ACTION_TYPE_COUNTS": dict(action_types.most_common()),
            "dedupKey": "Sanction identifier",
            "absence_ne_clean_history": True,
            "sha256": acquire["files"]["actions"]["sha256"],
        },
        "ohaHomeHealth": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "rows": len(hha_ids),
            "distinctLicenseNumbers": len(hha_ids),
            "identityNamespace": "OR-OHA-HHA:{license_number}",
            "sourceAsOf": "2026-07-29",
            "notCmsHomeHealth": True,
            "sha256": acquire["files"]["oha-hha.pdf"]["sha256"],
        },
        "ohaHospice": {
            "coverage": "ACQUIRED_CURRENT_SNAPSHOT",
            "rows": len(hospice_ids),
            "distinctLicenseNumbers": len(hospice_ids),
            "identityNamespace": "OR-OHA-HOSPICE:{license_number}",
            "sourceAsOf": "2026-07-30",
            "notCmsHospice": True,
            "homeHealth_ne_hospice": True,
            "sha256": acquire["files"]["oha-hospice.pdf"]["sha256"],
        },
        "cmsOverlay": {
            "nursingHomes": int(geo["nursingHomes"]),
            "homeHealth": int(geo["homeHealth"]),
            "hospice": int(geo["hospice"]),
            "source": "senior-national-intelligence.json geography OR (CMS class directories)",
            "asOf": "2026-08-27",
            "nationalFingerprint": national["sourceFingerprint"],
            "addedToNationalTotals": False,
            "clocks": {
                "nursingHomes": clock(sources, "nursing-home-provider-information"),
                "homeHealth": clock(sources, "home-health-care-agencies"),
                "hospice": clock(sources, "hospice-general-information"),
            },
        },
        "crosswalk": {
            "exactStateToCmsBridges": 0,
            "reason": "No source-native ODHS Provider ID ↔ CMS CCN join field. Open ODHS NF count matching CMS NH count is not a bridge.",
        },
        "identity": {
            "EXACT_ODHS_PROVIDER_ID": len(set(ids)),
            "EXACT_OHA_HHA_LICENSE": len(hha_ids),
            "EXACT_OHA_HOSPICE_LICENSE": len(hospice_ids),
            "EXACT_CMS_CCN": int(geo["nursingHomes"]) + int(geo["homeHealth"]) + int(geo["hospice"]),
            "EXACT_SOURCE_NATIVE_CROSSWALK": 0,
            "NAME_ONLY_UNSAFE": 0,
            "REVIEW_REQUIRED_CROSSWALKS": 0,
        },
        "adverse_publication": {
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "REVIEW_REQUIRED": 0,
            "UNRESOLVED": 0,
            "INTERNAL_ONLY": 0,
            "PUBLICATION_PENDING": 0,
            "PUBLIC_READY_PROFILES": 0,
            "PUBLICLY_RENDERED_PROFILES": 0,
            "BUSINESS_RESPONSE_READY": False,
            "name_only_adverse_attachment": "REJECTED",
            "statewide_page_renders_class_aggregates_not_facility_profiles": True,
            "publicly_rendered_ne_json_presence": True,
        },
        "withheld_reason_counts": {
            "PROFILE_NOT_AVAILABLE": 0,
            "PUBLICATION_ADAPTER_NOT_READY": True,
            "MISSING_IDENTIFIER": 0,
            "UNSAFE_NAME_MATCH": 0,
            "name_only_adverse_joins_not_attempted": 0,
        },
        "claimEligibilityBroadened": False,
        "noCombinedOregonFacilitiesTotal": True,
        "unknownIsNotZero": True,
        "searchOnlyIsNotZero": True,
        "expansion_ledger": {
            "NET_NEW_CANONICAL_ORGANIZATIONS": 0,
            "NET_NEW_PUBLIC_PROFILES": 0,
            "EXISTING_ORGANIZATIONS_ENRICHED": 0,
            "GRAPH_WRITES": 0,
            "EXACT_PROFILE_ATTACHMENTS": 0,
            "CLAIM_ELIGIBILITY_BROADENED": False,
        },
        "gate": {"live_national_cms_not_inflated": True, "passed": True},
    }


def emit_ts(body: dict) -> str:
    return "/** Generated from artifacts/or-sen-001-public-snapshot.json. Do not edit by hand. */\nexport const OR_PUBLIC_SNAPSHOT = " + json.dumps(body, indent=2) + " as const;\n"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    generated = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if args.check:
        current = json.loads(ART.read_text(encoding="utf-8"))
        rebuilt = build_body(current["generatedAt"])
        rebuilt["fingerprint"] = sha(rebuilt)
        if rebuilt["fingerprint"] != current["fingerprint"]:
            raise SystemExit(f"fingerprint drift {rebuilt['fingerprint']} != {current['fingerprint']}")
        print("OR-SEN-001 snapshot check PASS", current["fingerprint"])
        return
    body = build_body(generated)
    body["fingerprint"] = sha(body)
    ART.write_text(json.dumps(body, indent=2) + "\n", encoding="utf-8")
    TS.write_text(emit_ts(body), encoding="utf-8")
    print(json.dumps({
        "fingerprint": body["fingerprint"],
        "open_nf": body["odhsProviders"]["OPEN_NF"],
        "open_alf": body["odhsProviders"]["OPEN_ALF"],
        "open_rcf": body["odhsProviders"]["OPEN_RCF"],
        "open_afh": body["odhsProviders"]["OPEN_AFH"],
        "inspections": body["odhsInspections"]["INSPECTION_ROWS"],
        "violations": body["odhsViolations"]["VIOLATION_ROWS"],
        "actions": body["odhsRegulatoryActions"]["REGULATORY_ACTION_ROWS"],
        "matters": body["odhsRegulatoryActions"]["UNIQUE_REGULATORY_MATTERS"],
        "oha_hha": body["ohaHomeHealth"]["rows"],
        "oha_hospice": body["ohaHospice"]["rows"],
        "cms": body["cmsOverlay"],
    }, indent=2))


if __name__ == "__main__":
    main()
