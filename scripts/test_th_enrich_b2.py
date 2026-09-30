"""Offline integrity checks for the immutable B2 staging packet."""

import gzip
import hashlib
import json
import unittest
from pathlib import Path

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


if __name__ == "__main__":
    unittest.main()
