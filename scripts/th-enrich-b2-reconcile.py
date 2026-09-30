"""Rebuild the B2 R1 read-only reconciliation from staged files and captured owned IDs."""

from __future__ import annotations

import collections
import csv
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "data" / "enrichment" / "th-enrich-b2"
STAGED = BASE / "staged"
FIELDS = ["dataset", "source_row", "native_identifier", "staged_rows", "existing_source_system",
          "existing_native_identifier", "exact_match", "existing_entity_id", "genuinely_new_candidate",
          "classification", "collision", "reason"]


def read_gzip(name: str):
    with gzip.open(STAGED / name, "rt", encoding="utf-8") as stream:
        yield from (json.loads(line) for line in stream)


def write_csv(name: str, fields: list[str], rows: list[dict]):
    with (BASE / name).open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main():
    owned_ca = {r["facid"]: r for r in csv.DictReader((BASE / "owned-ca-facid-bridge.csv").open(newline="", encoding="utf-8"))}
    ownership, bridges = [], []
    for filename in ("tx_icf_iid.jsonl.gz", "tx_dahs.jsonl.gz", "tx_dahs_iss_only.jsonl.gz"):
        for row in read_gzip(filename):
            ownership.append(dict(dataset=row["source_class"], source_row=row["source_row"],
                                  native_identifier=row["facility_id"], staged_rows=1,
                                  existing_source_system="", existing_native_identifier="",
                                  exact_match="NO", existing_entity_id="", genuinely_new_candidate="YES",
                                  classification="NEW_EXACT", collision="NO",
                                  reason="No same-class owned Senior source; exact Facility ID and nonblank license comparisons to TX ALF/NF returned zero on 2026-09-30."))
    penalties = list(read_gzip("ca_penalty_evidence.jsonl.gz"))
    counts = collections.Counter(row["FACID"] for row in penalties)
    for facid in sorted(counts):
        owned = owned_ca.get(facid)
        provider_id = owned["provider_id"] if owned else ""
        collision = int(owned["provider_count"]) > 1 if owned else False
        classification = "AMBIGUOUS" if collision else "ALREADY_OWNED_EXACT" if provider_id else "UNRESOLVED"
        ownership.append(dict(dataset="CA_PENALTY_EVIDENCE", source_row="", native_identifier=facid,
                              staged_rows=counts[facid], existing_source_system="ca-cdph-healthcare-facility-locations" if owned else "",
                              existing_native_identifier=facid if owned else "", exact_match="YES" if provider_id and not collision else "NO",
                              existing_entity_id=provider_id if not collision else "", genuinely_new_candidate="NO",
                              classification=classification, collision="YES" if collision else "NO",
                              reason="Exact FACID in production state observation" if provider_id else
                                     "FACID in owned observation but no linked provider" if owned else
                                     "FACID absent from owned row-level state observations"))
        if provider_id and not collision:
            bridges.append(dict(dataset="CA_PENALTY_EVIDENCE", native_identifier=facid,
                                existing_source_system="ca-cdph-healthcare-facility-locations", existing_native_identifier=facid,
                                existing_entity_id=provider_id, match_method="EXACT_FACID", attached_evidence_rows=counts[facid]))
    orders = list(read_gzip("il_legacy_orders.jsonl.gz"))
    docket_counts = collections.Counter(row["order_id"] for row in orders)
    for source_row, row in enumerate(orders, 1):
        ownership.append(dict(dataset="IL_LEGACY_MOTOR_CARRIER_ORDER", source_row=source_row,
                              native_identifier=row["order_id"], staged_rows=1,
                              existing_source_system="", existing_native_identifier="", exact_match="UNKNOWN",
                              existing_entity_id="", genuinely_new_candidate="NO", classification="UNRESOLVED",
                              collision="DUPLICATE_SOURCE_DOCKET" if docket_counts[row["order_id"]] > 1 else "NO",
                              reason="Move production identity access timed out; docket number is not proven equal to ILCC, federal MC, or USDOT."))
    write_csv("ownership-reconciliation.csv", FIELDS, ownership)
    write_csv("exact-bridge-reconciliation.csv",
              ["dataset", "native_identifier", "existing_source_system", "existing_native_identifier",
               "existing_entity_id", "match_method", "attached_evidence_rows"], bridges)
    by_class = collections.defaultdict(collections.Counter)
    for row in ownership:
        by_class[row["dataset"]][row["classification"]] += 1
    summary = {k: dict(v) for k, v in by_class.items()}
    summary["CA_PENALTY_EVIDENCE"]["ATTACHED_ROWS"] = sum(int(r["attached_evidence_rows"]) for r in bridges)
    summary["CA_PENALTY_EVIDENCE"]["UNATTACHED_ROWS"] = len(penalties) - summary["CA_PENALTY_EVIDENCE"]["ATTACHED_ROWS"]
    (BASE / "ownership-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
