"""Offline integrity checks for the immutable B2 staging packet."""

import gzip
import hashlib
import json
import csv
import unittest
from pathlib import Path
from openpyxl import load_workbook

BASE = Path(__file__).resolve().parents[1] / "data" / "enrichment" / "th-enrich-b2"
ROOT = BASE.parents[2]


class PacketIntegrity(unittest.TestCase):
    def test_manifest_checksums(self):
        for source in json.loads((BASE / "source-manifest.json").read_text()):
            path = ROOT / source["filename"]
            self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), source["sha256"])

    def test_class_grain_and_denominator(self):
        audit = json.loads((BASE / "audit.json").read_text())
        for key, filename in (("tx_icfiid", "tx_icf_iid"), ("tx_dahs", "tx_dahs"),
                              ("tx_dahs_iss_only", "tx_dahs_iss_only")):
            with gzip.open(BASE / "staged" / f"{filename}.jsonl.gz", "rt", encoding="utf-8") as stream:
                rows = [json.loads(line) for line in stream]
            self.assertEqual(len(rows), audit[key]["parsed_rows"])
            self.assertEqual(len({r["facility_id"] for r in rows}), len(rows))
            self.assertEqual({r["source_class"] for r in rows}, {audit[key]["class"]})
        self.assertIn("zero new facilities", audit["ca_sea_20240730"]["denominator_treatment"])
        self.assertIn("zero current movers", audit["il_mcis_legacy"]["denominator_treatment"])

    def test_reconciliation_conserves_source_rows(self):
        with (BASE / "ownership-reconciliation.csv").open(newline="", encoding="utf-8") as stream:
            rows = list(csv.DictReader(stream))
        with (BASE / "exact-bridge-reconciliation.csv").open(newline="", encoding="utf-8") as stream:
            bridges = list(csv.DictReader(stream))
        counts = {name: sum(row["dataset"] == name for row in rows) for name in
                  ("TX_ICF_IID", "TX_DAHS", "TX_DAHS_ISS_ONLY", "CA_PENALTY_EVIDENCE", "IL_LEGACY_MOTOR_CARRIER_ORDER")}
        self.assertEqual(counts, {"TX_ICF_IID": 708, "TX_DAHS": 389, "TX_DAHS_ISS_ONLY": 744,
                                  "CA_PENALTY_EVIDENCE": 2710, "IL_LEGACY_MOTOR_CARRIER_ORDER": 257})
        self.assertEqual(len(bridges), 1117)
        self.assertEqual(sum(int(row["attached_evidence_rows"]) for row in bridges), 13149)
        self.assertEqual(sum(int(row["staged_rows"]) for row in rows if row["dataset"] == "CA_PENALTY_EVIDENCE"), 20550)

    def test_texas_worksheet_structure_explains_counts(self):
        for filename, expected in (("ICFIID.xlsx", 708), ("DAHS.xlsx", 389), ("dahs_issonly.xlsx", 744)):
            sheet = load_workbook(BASE / "raw" / filename, read_only=True, data_only=True).active
            rows = list(sheet.values)
            self.assertEqual(len(rows), expected + 2)
            self.assertEqual(rows[1][1], "Facility ID")
            self.assertTrue(all(any(value is not None and str(value).strip() for value in row) for row in rows[2:]))
            self.assertEqual(len({str(row[1]) for row in rows[2:]}), expected)

    def test_release_packets_exclude_unmatched_evidence_and_preserve_classes(self):
        release = BASE / "release"
        with (release / "tx" / "providers.csv").open(newline="", encoding="utf-8") as stream:
            providers = list(csv.DictReader(stream))
        with (release / "tx" / "credentials.csv").open(newline="", encoding="utf-8") as stream:
            credentials = list(csv.DictReader(stream))
        with (release / "ca" / "exact_penalties.csv").open(newline="", encoding="utf-8") as stream:
            penalties = list(csv.DictReader(stream))
        with (BASE / "exact-bridge-reconciliation.csv").open(newline="", encoding="utf-8") as stream:
            exact_facids = {row["native_identifier"] for row in csv.DictReader(stream)}
        self.assertEqual(len(providers), 1841)
        self.assertEqual(len({row["facility_id"] for row in providers}), 1841)
        self.assertEqual(len(credentials), 1787)
        self.assertEqual(sum(row["active_license_claim"] == "YES" for row in credentials), 1785)
        self.assertEqual(len(penalties), 13149)
        self.assertEqual({row["facid"] for row in penalties}, exact_facids)
        self.assertEqual(len({row["penalty_number"] for row in penalties}), 13149)

    def test_new_official_subsets_have_native_ids(self):
        with (BASE / "staged" / "ny_storage_warehouse.csv").open(newline="", encoding="utf-8") as stream:
            warehouses = list(csv.DictReader(stream))
        self.assertEqual(len(warehouses), 55)
        self.assertEqual(len({row["license_nbr"] for row in warehouses}), 55)
        self.assertEqual(sum(row["license_status"] == "Active" for row in warehouses), 35)
        for filename, expected, label in (("fl_adult_day_care.csv", 473, "FL_ADULT_DAY_CARE"),
                                          ("fl_nurse_registry.csv", 1356, "FL_NURSE_REGISTRY")):
            with (BASE / "staged" / filename).open(newline="", encoding="utf-8") as stream:
                rows = list(csv.DictReader(stream))
            self.assertEqual(len(rows), expected)
            self.assertEqual(len({row["ahca_file_number"] for row in rows}), expected)
            self.assertEqual({row["source_class"] for row in rows}, {label})


if __name__ == "__main__":
    unittest.main()
