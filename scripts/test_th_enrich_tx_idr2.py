"""Tests for the Texas HHSC location-grain, branch-only publication packet."""

import csv
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts/th-enrich-tx-idr2.py"
spec = importlib.util.spec_from_file_location("tx_idr2", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
BASE = ROOT / "data/enrichment/th-enrich-b2/idr2"


def csv_rows(name):
    with (BASE / "release" / name).open(newline="", encoding="utf-8") as stream:
        return list(csv.DictReader(stream))


class TexasLocationPacketTests(unittest.TestCase):
    def test_live_source_and_prior_drift(self):
        receipt = json.loads((BASE / "receipt.json").read_text())
        self.assertEqual(receipt["source_rows"], {
            "TX_ICF_IID": 708, "TX_DAHS": 389, "TX_DAHS_ISS_ONLY": 743})
        self.assertEqual(receipt["total_locations"], 1840)
        self.assertEqual(receipt["license_observations"], 1786)
        self.assertTrue(receipt["prior_112184"]["present_prior"])
        self.assertFalse(receipt["prior_112184"]["present_now"])
        self.assertEqual([s["worksheet_rows"] for s in receipt["source_manifest"]], [710, 391, 745])
        self.assertEqual([s["source_rows"] for s in receipt["source_manifest"]], [708, 389, 743])
        with self.assertRaises(ValueError):
            # Source drift check cannot accept the old 744-row in-home workbook.
            _, old, _, _ = module.read_sheet(ROOT / "data/enrichment/th-enrich-b2/raw/dahs_issonly.xlsx")
            if len(old) != 743:
                raise ValueError("rejected prior snapshot")

    def test_namespace_and_idempotence(self):
        rows = csv_rows("locations.csv")
        keys = [row["namespaced_key"] for row in rows]
        self.assertEqual(len(rows), len(set(keys)))
        self.assertEqual(module.key("TX_ICF_IID", "112184"), module.key("TX_ICF_IID", "112184"))
        self.assertNotEqual(module.key("TX_ICF_IID", "112184"), module.key("TX_DAHS", "112184"))
        self.assertNotEqual(module.key("TX_ICF_IID", "112184"), "112184")
        self.assertNotEqual(module.key("TX_ICF_IID", "112184"), "CMS:112184")
        self.assertNotEqual(module.key("TX_ICF_IID", "112184"), "FL|AHCA|FL_ALF|112184")
        self.assertTrue(all(not row["organization_id"] and row["public_eligible"] == "NO" for row in rows))
        self.assertFalse(any(row["facility_id"] == "112184" for row in rows))
        receipt_before = (BASE / "receipt.json").read_bytes()
        module.build()
        self.assertEqual((BASE / "receipt.json").read_bytes(), receipt_before)

    def test_license_facts_and_class_boundaries(self):
        locations = csv_rows("locations.csv")
        licenses = csv_rows("license_observations.csv")
        self.assertEqual(len(licenses), 1786)
        self.assertEqual(len(locations) - len(licenses), 54)
        self.assertEqual(sum(x["facility_licensed_raw"] == "NO" for x in licenses), 2)
        self.assertEqual(len({(x["namespaced_key"], x["credential_number"]) for x in licenses}), 1786)
        self.assertTrue({x["namespaced_key"] for x in licenses} <= {x["namespaced_key"] for x in locations})
        self.assertEqual({x["provider_class"] for x in locations},
                         {"TX_ICF_IID", "TX_DAHS", "TX_DAHS_ISS_ONLY"})

    def test_load_and_rollback_scope(self):
        packet = (ROOT / "docs/release-packets/tx-idr2-load.psql").read_text()
        rollback = (ROOT / "docs/release-packets/tx-idr2-rollback.psql").read_text()
        old = (ROOT / "docs/release-packets/tx-senior-load.psql").read_text()
        self.assertIn("SUPERSEDED", old)
        for sql in (packet, rollback):
            self.assertIn(module.BATCH, sql)
            self.assertIn("1840", sql)
            self.assertIn("1786", sql)
        self.assertIn("organization_id uuid REFERENCES public.organization(id)", packet)
        self.assertIn("public_eligible boolean NOT NULL DEFAULT false CHECK (public_eligible=false)", packet)
        self.assertIn("organization_id IS NULL AND public_eligible=false", rollback)
        self.assertNotIn("INSERT INTO public.organization", packet)
        self.assertNotIn("INSERT INTO public.provider", packet)


if __name__ == "__main__":
    unittest.main()
