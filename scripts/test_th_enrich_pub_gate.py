"""Check the two publication-gate release files against their certified source grain."""

import csv
import hashlib
import json
import unittest
from collections import Counter
from pathlib import Path

BASE = Path(__file__).resolve().parents[1] / "data/enrichment/th-enrich-b2/publication-gate"


class PublicationGateFiles(unittest.TestCase):
    def test_florida_status_and_native_key(self):
        with (BASE / "fl_nurse_registry_load.csv").open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), 1356)
        self.assertEqual(len({r["ahca_file_number"] for r in rows}), 1356)
        self.assertEqual(Counter(r["license_status_raw"] for r in rows), {"LICENSED": 1291, "IN REVIEW": 65})
        self.assertEqual({r["closed_on"] for r in rows if r["closed_on"]}, {"2026-03-19", "2026-11-19"})
        self.assertEqual(Counter(r["publication_label"] for r in rows), {"Licensed": 1289, "In review": 65, "Licensed — closed date reported": 2})

    def test_nyc_jurisdiction_status_and_native_key(self):
        with (BASE / "nyc_storage_warehouse_load.csv").open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        self.assertEqual(len(rows), 55)
        self.assertEqual(len({r["license_nbr"] for r in rows}), 55)
        self.assertEqual(Counter(r["license_status"] for r in rows), {"Active": 35, "Surrendered": 12, "Expired": 8})
        self.assertTrue(all(r["publication_label"].startswith("NYC storage warehouse license") for r in rows))

    def test_receipt_matches_release_files(self):
        receipt = json.loads((BASE / "receipt.json").read_text(encoding="utf-8"))
        for name, key in (("fl_nurse_registry_load.csv", "fl_csv_sha256"), ("nyc_storage_warehouse_load.csv", "ny_csv_sha256")):
            self.assertEqual(hashlib.sha256((BASE / name).read_bytes()).hexdigest(), receipt[key])
        self.assertFalse(receipt["production_mutations"])


if __name__ == "__main__":
    unittest.main()
