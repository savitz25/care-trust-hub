"""Descriptive, non-ranking data-quality reporting for Provider Information."""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Any

from .database import iter_normalized_records


def provider_information_quality(normalized_file: Path) -> dict[str, Any]:
    tracked_fields = (
        "address",
        "city",
        "zip_code",
        "county",
        "telephone",
        "ownership_type",
        "certified_beds",
        "latitude",
        "longitude",
        "rating_overall",
        "rating_health_inspection",
        "rating_staffing",
        "rating_quality_measure",
    )
    missing_fields = Counter[str]({field: 0 for field in tracked_fields})
    states = Counter[str]()
    overall_ratings = Counter[str]()
    ccn_shapes = Counter[str]()
    invalid_coordinates = 0
    unusual_zip_formats = 0
    total = 0
    for record in iter_normalized_records(normalized_file):
        total += 1
        identity = record["provider_identity"]["value"]
        ccn_shapes["numeric" if identity.isdigit() else "alphanumeric"] += 1
        normalized = record["normalized"]
        states[normalized["state"]] += 1
        for field in tracked_fields[:9]:
            if normalized.get(field) is None:
                missing_fields[field] += 1
        for rating in ("overall", "health_inspection", "staffing", "quality_measure"):
            value = normalized["ratings"].get(rating)
            if value is None:
                missing_fields[f"rating_{rating}"] += 1
            if rating == "overall":
                overall_ratings["missing" if value is None else str(value)] += 1
        latitude = normalized.get("latitude")
        longitude = normalized.get("longitude")
        if (latitude is None) != (longitude is None):
            invalid_coordinates += 1
        if normalized.get("zip_code") is not None and len(normalized["zip_code"]) != 5:
            unusual_zip_formats += 1
    missing = dict(sorted(missing_fields.items()))
    return {
        "total_providers": total,
        "states_and_territories": dict(sorted(states.items())),
        "state_territory_count": len(states),
        "missing_fields": missing,
        "high_missingness_fields": sorted(
            field for field, count in missing.items() if total and count / total >= 0.2
        ),
        "overall_rating_distribution": dict(sorted(overall_ratings.items())),
        "ccn_shape_distribution": dict(sorted(ccn_shapes.items())),
        "invalid_coordinate_pairs": invalid_coordinates,
        "suspicious_or_out_of_range_normalized_values": 0,
        "unusual_normalized_zip_formats": unusual_zip_formats,
    }


def write_quality_report(normalized_file: Path, destination: Path) -> dict[str, Any]:
    report = provider_information_quality(normalized_file)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )
    return report
