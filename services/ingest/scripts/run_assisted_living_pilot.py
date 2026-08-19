from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlencode

from care_ingest.assisted_living_pilot import (
    NY_CERT_URL,
    NY_HFIS_URL,
    _fetch,
    parse_california_rcfe,
    parse_new_york_acf,
    parse_texas_alf,
    publication_eligible,
)

ROOT = Path(__file__).resolve().parents[3]


def main() -> None:
    retrieved = datetime.now(UTC).isoformat()
    ca = (ROOT / "data/raw/assisted-living/ca-rcfe.csv").read_text(encoding="utf-8-sig")
    tx = (ROOT / "data/raw/assisted-living/tx-alf.xlsx").read_bytes()
    query = urlencode(
        {
            "$where": "description in('Adult Home','Enriched Housing Program')",
            "$limit": "50000",
        }
    )
    adult = json.loads(_fetch(f"{NY_HFIS_URL}?{query}"))
    certs = json.loads(_fetch(f"{NY_CERT_URL}?{query}"))
    first = [
        parse_california_rcfe(ca, retrieved_at=retrieved),
        parse_new_york_acf(adult, certs, retrieved_at=retrieved),
        parse_texas_alf(tx, retrieved_at=retrieved),
    ]
    second = [
        parse_california_rcfe(ca, retrieved_at=retrieved),
        parse_new_york_acf(adult, certs, retrieved_at=retrieved),
        parse_texas_alf(tx, retrieved_at=retrieved),
    ]
    idempotent = all(
        [item.get("external_key") for item in left.records]
        == [item.get("external_key") for item in right.records]
        for left, right in zip(first, second, strict=True)
    )
    report = {
        "retrieved_at": retrieved,
        "google_places_requests": 0,
        "idempotent": idempotent,
        "states": {item.state: item.coverage() for item in first},
        "totals": {
            "canonical_providers": sum(len(item.records) for item in first),
            "publication_eligible": sum(
                1 for item in first for record in item.records if publication_eligible(record)
            ),
        },
    }
    out = ROOT / "docs/task-021b-coverage.json"
    out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
