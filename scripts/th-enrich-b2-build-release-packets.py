"""Build reviewable TX provider and CA exact-penalty load files; never connects to DB."""

from __future__ import annotations

import csv
import gzip
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "enrichment" / "th-enrich-b2"
OUT = BASE / "release"


def digest(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def staged(name: str):
    with gzip.open(BASE / "staged" / name, "rt", encoding="utf-8") as stream:
        return [json.loads(line) for line in stream]


def write_csv(path: Path, fields: list[str], records: list[dict]):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(records)


def main():
    manifest = {row["source_id"]: row for row in json.loads((BASE / "source-manifest.json").read_text(encoding="utf-8"))}
    ownership = list(csv.DictReader((BASE / "ownership-reconciliation.csv").open(newline="", encoding="utf-8")))
    dispositions = {(r["dataset"], r["native_identifier"]): r for r in ownership}
    source_files = (("tx_icfiid", "tx_icf_iid.jsonl.gz"), ("tx_dahs", "tx_dahs.jsonl.gz"),
                    ("tx_dahs_iss_only", "tx_dahs_iss_only.jsonl.gz"))
    providers, credentials = [], []
    for source_id, filename in source_files:
        source = manifest[source_id]
        for row in staged(filename):
            key = (row["source_class"], row["facility_id"])
            if dispositions[key]["classification"] != "NEW_EXACT":
                raise ValueError(f"TX ownership is not NEW_EXACT: {key}")
            provider = {"provider_class": row["source_class"], "facility_id": row["facility_id"],
                        "source_row": row["source_row"], "official_name": row["facility_name"],
                        "program_type": row["program_type"], "facility_licensed_raw": row["facility_licensed"],
                        "facility_certified_raw": row["facility_certified"], "county": row["county"],
                        "physical_address": row["physical_address"], "city": row["city"], "state": row["state"],
                        "zip": row["zip"], "source_sha256": source["sha256"],
                        "source_url": source["official_source"], "retrieved_at": source["retrieved_at"],
                        "source_as_of": "2026-09-28"}
            provider["record_sha256"] = digest(json.dumps(provider, sort_keys=True, separators=(",", ":")))
            providers.append(provider)
            if row["license_number"]:
                credentials.append({"provider_class": row["source_class"], "facility_id": row["facility_id"],
                                    "credential_type": "HHSC_LICENSE_NUMBER", "credential_number": row["license_number"],
                                    "facility_licensed_raw": row["facility_licensed"],
                                    "active_license_claim": "YES" if row["facility_licensed"] == "YES" else "NO",
                                    "license_effective_date": row["license_effective_date"],
                                    "license_expiration_date": row["license_expiration_date"],
                                    "source_sha256": source["sha256"]})
    assert len(providers) == 1841 and len({r["facility_id"] for r in providers}) == 1841
    assert Counter(r["provider_class"] for r in providers) == {"TX_ICF_IID": 708, "TX_DAHS": 389, "TX_DAHS_ISS_ONLY": 744}
    assert len(credentials) == 1787 and sum(r["active_license_claim"] == "YES" for r in credentials) == 1785
    assert len({r["credential_number"] for r in credentials}) == 1787
    write_csv(OUT / "tx" / "providers.csv", list(providers[0]), providers)
    write_csv(OUT / "tx" / "credentials.csv", list(credentials[0]), credentials)

    bridges = {r["native_identifier"]: r for r in csv.DictReader((BASE / "exact-bridge-reconciliation.csv").open(newline="", encoding="utf-8"))}
    penalties = []
    for row in staged("ca_penalty_evidence.jsonl.gz"):
        bridge = bridges.get(row["FACID"])
        if not bridge:
            continue
        evidence = {"source_row": row["source_row"], "penalty_number": row["PENALTY_NUMBER"],
                    "facid": row["FACID"], "provider_id": bridge["existing_entity_id"],
                    "penalty_issue_date": row["PENALTY_ISSUE_DATE"], "penalty_type": row["PENALTY_TYPE"],
                    "penalty_category": row["PENALTY_CATEGORY"], "amount_due_final": row["TOTAL_AMOUNT_DUE_FINAL"],
                    "source_sha256": manifest["ca_sea_20240730"]["sha256"],
                    "raw_record_json": json.dumps(row, sort_keys=True, separators=(",", ":"))}
        evidence["record_sha256"] = digest(evidence["source_sha256"] + "|" + evidence["penalty_number"] + "|" + evidence["facid"])
        penalties.append(evidence)
    assert len(penalties) == 13149 and len({r["penalty_number"] for r in penalties}) == 13149
    assert len({r["facid"] for r in penalties}) == 1117
    write_csv(OUT / "ca" / "exact_penalties.csv", list(penalties[0]), penalties)
    files = {}
    for path in (OUT / "tx" / "providers.csv", OUT / "tx" / "credentials.csv", OUT / "ca" / "exact_penalties.csv"):
        files[str(path.relative_to(ROOT)).replace("\\", "/")] = {"sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                                                                    "bytes": path.stat().st_size}
    receipt = {"tx": {"providers": 1841, "by_class": dict(Counter(r["provider_class"] for r in providers)),
                      "credential_observations": 1787, "active_license_claims": 1785,
                      "license_number_with_facility_licensed_no": 2, "providers_without_license_number": 54,
                      "public_eligible": False},
               "ca": {"matched_facids": 1117, "penalty_rows": 13149, "excluded_facids": 1593,
                      "excluded_penalty_rows": 7401, "new_facilities": 0, "public_eligible": False},
               "files": files, "production_executed": False}
    (OUT / "release-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
