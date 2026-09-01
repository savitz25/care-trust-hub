"""MDS quality-measure normalization. Individual measures are not CMS star ratings."""

from __future__ import annotations

import csv
import json
from dataclasses import asdict, dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from .manifest import ReleaseManifest
from .ownership import normalize_cms_ccn
from .provider_information import CCN_PATTERN, SchemaDriftError

MDS_KEY = "nursing-home-mds-quality-measures"
TRANSFORMATION_VERSION = "mds-quality-measures-v1"
STAR_RATING_CLAIM = False

REQUIRED_COLUMNS = frozenset(
    {
        "CMS Certification Number (CCN)",
        "Measure Code",
        "Measure Description",
        "Resident type",
        "Q1 Measure Score",
        "Q2 Measure Score",
        "Q3 Measure Score",
        "Q4 Measure Score",
        "Four Quarter Average Score",
        "Used in Quality Measure Five Star Rating",
        "Measure Period",
        "Processing Date",
    }
)

PERIODS = (
    ("Q1", "Q1 Measure Score", "Footnote for Q1 Measure Score"),
    ("Q2", "Q2 Measure Score", "Footnote for Q2 Measure Score"),
    ("Q3", "Q3 Measure Score", "Footnote for Q3 Measure Score"),
    ("Q4", "Q4 Measure Score", "Footnote for Q4 Measure Score"),
    (
        "FOUR_QUARTER_AVERAGE",
        "Four Quarter Average Score",
        "Footnote for Four Quarter Average Score",
    ),
)


@dataclass(slots=True)
class MdsSummary:
    dataset_key: str
    release: str | None
    checksum: str
    transformation_version: str
    rows_read: int = 0
    observation_rows: int = 0
    rejected_rows: int = 0
    distinct_measures: int = 0
    distinct_ccns: int = 0
    suppressed_observations: int = 0
    warnings: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _text(value: str | None) -> str | None:
    value = value.strip() if value else ""
    return value or None


def parse_score(value: str | None) -> tuple[Decimal | None, str | None, bool]:
    text = _text(value)
    if text is None:
        return None, None, True
    try:
        return Decimal(text), text, False
    except InvalidOperation:
        return None, text, True


def is_star_rating_observation(period_component: str, measure_code: str) -> bool:
    return False


def normalize_mds_row(
    row: dict[str, str], row_number: int, manifest: ReleaseManifest
) -> dict[str, Any]:
    ccn = normalize_cms_ccn(_text(row.get("CMS Certification Number (CCN)")) or "")
    if not CCN_PATTERN.fullmatch(ccn):
        raise ValueError(f"invalid CMS CCN: {ccn!r}")
    measure_code = _text(row.get("Measure Code"))
    official_name = _text(row.get("Measure Description"))
    stay_type = _text(row.get("Resident type"))
    if not measure_code or not official_name:
        raise ValueError("missing Measure Code or Measure Description")
    if stay_type not in {"Long Stay", "Short Stay"}:
        raise ValueError(f"invalid Resident type: {stay_type!r}")
    used = _text(row.get("Used in Quality Measure Five Star Rating"))
    used_in_five_star = True if used == "Y" else False if used == "N" else None
    observations = []
    for component, score_field, footnote_field in PERIODS:
        score, score_text, suppressed = parse_score(row.get(score_field))
        observations.append(
            {
                "ccn": ccn,
                "measure_code": measure_code,
                "official_name": official_name,
                "stay_type": stay_type,
                "period_component": component,
                "measure_period": _text(row.get("Measure Period")),
                "score": format(score, "f") if score is not None else None,
                "score_text": score_text,
                "suppressed": suppressed,
                "footnote": _text(row.get(footnote_field)),
                "used_in_five_star_rating": used_in_five_star,
                "is_cms_star_rating": is_star_rating_observation(component, measure_code),
                "source_record_locator": (
                    f"csv-row:{row_number}:ccn:{ccn}:measure:{measure_code}:{component}"
                ),
            }
        )
    return {
        "ccn": ccn,
        "measure_code": measure_code,
        "official_name": official_name,
        "stay_type": stay_type,
        "used_in_five_star_rating": used_in_five_star,
        "source_release": {
            "dataset_key": manifest.dataset_key,
            "release_date": manifest.source_release_date,
            "sha256": manifest.sha256,
            "transformation_version": TRANSFORMATION_VERSION,
        },
        "observations": observations,
        "raw": dict(row),
        "source_record_locator": f"csv-row:{row_number}:ccn:{ccn}:measure:{measure_code}",
    }


def ingest_mds_source(
    source_file: Path,
    manifest: ReleaseManifest,
    data_root: Path,
    write_outputs: bool = True,
) -> MdsSummary:
    if manifest.dataset_key != MDS_KEY:
        raise ValueError("MDS ingest requires nursing-home-mds-quality-measures")
    with source_file.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = set(reader.fieldnames or [])
        missing = REQUIRED_COLUMNS - columns
        if missing:
            raise SchemaDriftError(f"MDS required columns missing: {sorted(missing)}")
        summary = MdsSummary(
            MDS_KEY,
            manifest.source_release_date,
            manifest.sha256,
            TRANSFORMATION_VERSION,
        )
        measures: set[str] = set()
        ccns: set[str] = set()
        records: list[dict[str, Any]] = []
        for row_number, row in enumerate(reader, start=2):
            summary.rows_read += 1
            try:
                record = normalize_mds_row(row, row_number, manifest)
            except ValueError as error:
                summary.rejected_rows += 1
                summary.warnings.append(f"row {row_number}: {error}")
                continue
            measures.add(record["measure_code"])
            ccns.add(record["ccn"])
            summary.observation_rows += len(record["observations"])
            summary.suppressed_observations += sum(
                1 for item in record["observations"] if item["suppressed"]
            )
            records.append(record)
        summary.distinct_measures = len(measures)
        summary.distinct_ccns = len(ccns)
    if write_outputs:
        destination = (
            data_root / "normalized" / "cms" / MDS_KEY / (manifest.source_release_date or "unknown")
        )
        destination.mkdir(parents=True, exist_ok=True)
        with (destination / "records.jsonl").open("w", encoding="utf-8") as handle:
            for record in records:
                handle.write(json.dumps(record, sort_keys=True) + "\n")
        release_dir = manifest.source_release_date or "unknown"
        report = data_root / "reports" / "cms" / MDS_KEY / release_dir
        report.mkdir(parents=True, exist_ok=True)
        (report / "summary.json").write_text(summary.to_json(), encoding="utf-8")
    return summary
