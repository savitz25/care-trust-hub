"""NJ-SEN-002R denominator reconciliation. Does not change public eligibility."""

from __future__ import annotations

import csv
import json
from collections import Counter
from pathlib import Path
from typing import Any

CLASS_FROM_INDEX = {
    "penalty_letter",
    "civil_monetary_penalty",
    "admission_curtailment",
    "conditional_license",
    "directed_plan_of_correction",
    "license_suspension",
    "license_revocation",
    "license_surrender",
    "corrective_action",
    "other_expressly_identified_njdoh_action",
    "unclassified_regulatory_document",
}


def load_ledger(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open(encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def load_summary(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def build_reconciliation(
    ledger: list[dict[str, Any]],
    summary: dict[str, Any],
) -> list[dict[str, Any]]:
    hashes = [row.get("sha256") for row in ledger if row.get("sha256")]
    hash_counts = Counter(hashes)
    first_hash: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    classes = summary.get("corpus", {}).get("document_class", {})
    scopes = summary.get("corpus", {}).get("corpus_scope", {})
    matches = summary.get("corpus", {}).get("match_buckets", {})
    # occurrence-level classification is on the index action stored in the ledger
    from .nj_doh_enforcement import classify_document_class, classify_remedy

    for index, row in enumerate(ledger, start=1):
        digest = row.get("sha256")
        downloaded = bool(digest)
        group_id = digest if digest and hash_counts[digest] > 1 else None
        if digest and digest not in first_hash:
            first_hash[digest] = index
        canonical_flag = (
            "CANONICAL"
            if digest and first_hash.get(digest) == index
            else ("DUPLICATE_CONTENT" if digest else "NO_CONTENT")
        )
        action = row.get("source_listed_action") or ""
        canonical_class = classify_document_class(classify_remedy(action))
        extraction = "IMAGE_ONLY_OCR_REQUIRED"
        if not downloaded:
            extraction = "SOURCE_UNAVAILABLE"
        # page_count present implies we attempted extract; text vs image is not in ledger
        # Prefer summary-level extraction only as fallback labels via image-only if page_count set
        image_only = downloaded  # refined below if we have extraction from summary grain
        ocr_backlog = downloaded
        class_method = "INDEX_METADATA"
        if canonical_class == "unclassified_regulatory_document":
            class_method = "UNCLASSIFIED"
        acquired = row.get("final_acquisition_status") or ""
        scope = "SOURCE_DOCUMENT_UNAVAILABLE" if not downloaded else "UNRESOLVED_SCOPE"
        match_status = "UNRESOLVED"
        out.append(
            {
                "source_occurrence_id": f"nj-doh-enforcement-{index:04d}",
                "index_url": row.get("source_index_page"),
                "original_href": row.get("original_href"),
                "normalized_url": row.get("normalized_url"),
                "acquisition_status": acquired,
                "canonical_document_id": digest,
                "content_sha256": digest,
                "duplicate_content_group_id": group_id,
                "canonical_versus_duplicate": canonical_flag,
                "extraction_status": extraction,
                "character_count": "",
                "image_only_flag": "true" if image_only else "false",
                "ocr_backlog_flag": "true" if ocr_backlog else "false",
                "raw_source_document_type": action,
                "normalized_document_classification": canonical_class,
                "classification_method": class_method,
                "classification_confidence": "index_action",
                "corpus_scope": scope,
                "facility_match_status": match_status,
                "njdoh_facid": "",
                "njdoh_license_number": "",
                "internal_facility_id": "",
                "match_method": "",
                "match_confidence": "",
                "public_eligibility": "false",
                "baseline_only": "true",
                "source_year": row.get("source_year"),
                "source_listed_facility_name": row.get("source_listed_facility_name"),
                "source_listed_document_date": row.get("source_listed_document_date"),
            }
        )
    _ = (classes, scopes, matches)
    return out


def write_csv(rows: list[dict[str, Any]], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)
