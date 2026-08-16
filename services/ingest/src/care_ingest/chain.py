"""Validation and normalization of official CMS chain evidence."""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .manifest import ReleaseManifest

CHAIN_KEY = "nursing-home-chain-performance-measures"
CHAIN_VERSION = "cms-chain-v1"
CORE = {
    "Chain",
    "Chain ID",
    "Number of facilities",
    "Number of states and territories with operations",
}


@dataclass(slots=True)
class ChainSummary:
    dataset_key: str
    source_rows: int = 0
    normalized_rows: int = 0
    rejected_rows: int = 0
    unique_chains: int = 0
    duplicate_chains: int = 0
    null_names: int = 0
    invalid_values: int = 0
    contextual_rows: int = 0

    def to_json(self):
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def number(value: str) -> str | None:
    value = value.strip().replace("$", "").replace(",", "").replace("%", "")
    if not value:
        return None
    try:
        return str(Decimal(value))
    except InvalidOperation as exc:
        raise ValueError(f"invalid numeric value {value}") from exc


def normalize_chain_row(row: dict[str, str], line: int, month: str) -> dict[str, Any]:
    if not CORE.issubset(row):
        raise ValueError("chain schema missing required fields")
    chain_id = (row["Chain ID"] or "").strip()
    name = (row["Chain"] or "").strip()
    if not chain_id or not name:
        raise ValueError("missing chain identity")
    facilities = int(number(row["Number of facilities"]) or "-1")
    states = int(number(row["Number of states and territories with operations"]) or "-1")
    if facilities < 0 or states < 0:
        raise ValueError("invalid published counts")
    metrics = {k: number(v or "") for k, v in row.items() if k not in CORE}
    for key, val in metrics.items():
        if val is None:
            continue
        n = Decimal(val)
        if "Percentage" in key or "Percent of" in key:
            if not 0 <= n <= 100:
                raise ValueError(f"invalid percentage {key}")
        if "rating" in key.lower() and not 0 <= n <= 5:
            raise ValueError(f"invalid rating {key}")
    return {
        "chain_id": chain_id,
        "chain_name": name,
        "release_month": month,
        "published_facility_count": facilities,
        "published_state_count": states,
        "metrics": metrics,
        "source_record_locator": f"csv-row:{line}",
        "raw_record": row,
    }


def ingest_chain_source(
    source_file: Path, manifest: ReleaseManifest, data_root: Path, *, write_outputs=True
) -> ChainSummary:
    month = (manifest.source_period or "")[:7] + "-01"
    summary = ChainSummary(manifest.dataset_key)
    seen = set()
    records = []
    with source_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if len(reader.fieldnames or []) != 51:
            raise ValueError("CMS chain schema must contain 51 fields")
        for line, row in enumerate(reader, start=2):
            summary.source_rows += 1
            if (
                not (row.get("Chain ID") or "").strip()
                and (row.get("Chain") or "").strip() == "National"
            ):
                summary.contextual_rows += 1
                continue
            try:
                record = normalize_chain_row(row, line, month)
                if record["chain_id"] in seen:
                    summary.duplicate_chains += 1
                    raise ValueError("duplicate Chain ID")
                seen.add(record["chain_id"])
                records.append(record)
                summary.normalized_rows += 1
            except ValueError:
                summary.rejected_rows += 1
    summary.unique_chains = len(seen)
    if write_outputs:
        release = manifest.source_release_date or manifest.sha256
        dest = data_root / "normalized" / "cms" / manifest.dataset_key / release
        dest.mkdir(parents=True, exist_ok=True)
        with (dest / "records.jsonl").open("w", encoding="utf-8", newline="\n") as out:
            for record in records:
                out.write(json.dumps(record, sort_keys=True) + "\n")
        report = data_root / "reports" / "cms" / manifest.dataset_key / release
        report.mkdir(parents=True, exist_ok=True)
        (report / "summary.json").write_text(summary.to_json(), encoding="utf-8")
    return summary
