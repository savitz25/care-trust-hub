"""Summarize license identifiers and clocks from Delaware DHSS public directory pages."""

from __future__ import annotations

import csv
import re
from collections import Counter
from datetime import date, datetime
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "delaware-sen-001" / "raw"
OUT = ROOT / "data" / "delaware-sen-001" / "derived" / "directory-observations.csv"
SNAPSHOT_DATE = date(2026, 10, 12)
SOURCES = (
    ("Nursing facilities", "nursing-homes.html"),
    ("Assisted living", "assisted-living.html"),
    ("Adult day care", "adult-day.html"),
    ("Home health agencies - aides only", "home-health-aides-only.html"),
    ("Home health agencies - skilled", "home-health-skilled.html"),
    ("Hospice", "hospice.html"),
    ("Personal assistance services agencies", "personal-assistance-agencies.html"),
)


class TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def extract_text(path: Path) -> str:
    parser = TextExtractor()
    parser.feed(path.read_text(encoding="utf-8", errors="replace"))
    return re.sub(r"\s+", " ", " ".join(parser.parts))


def summarize(path: Path) -> tuple[int, int, int, int, Counter[str]]:
    text = extract_text(path)
    ids = re.findall(r"License\s*(?:ID|#)\s*[|:]?\s*([A-Z0-9-]+)", text, re.IGNORECASE)
    dated_rows = re.findall(
        r"License\s*(?:ID|#)\s*([A-Z0-9-]+)\s+Licensure Expiration Date\s+"
        r"(\d{1,2}/\d{1,2}/\d{4})",
        text,
        re.IGNORECASE,
    )
    expired = sum(
        datetime.strptime(expiry, "%m/%d/%Y").date() <= SNAPSHOT_DATE
        for _, expiry in dated_rows
    )
    repeated = Counter(ids)
    return len(ids), len(set(ids)), len(dated_rows), expired, repeated


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = []
    repeated_rows = []
    for label, filename in SOURCES:
        observations, unique_ids, dated_rows, expired, repeated = summarize(RAW / filename)
        rows.append((label, observations, unique_ids, dated_rows, expired))
        for license_id, count in sorted(repeated.items()):
            if count > 1:
                repeated_rows.append((label, license_id, count))

    with OUT.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(
            [
                "source_class",
                "directory_observations",
                "distinct_license_ids",
                "rows_with_expiration_date",
                "listed_expiration_on_or_before_snapshot",
            ]
        )
        writer.writerows(rows)

    duplicate_path = OUT.with_name("repeated-license-identifiers.csv")
    with duplicate_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["source_class", "license_id", "directory_observations"])
        writer.writerows(repeated_rows)

    print(f"class-specific summaries written={len(rows)}; no cross-class total is produced")


if __name__ == "__main__":
    main()
