"""Write NJ-SEN-002R CSV artifacts from the committed acquisition ledger."""

# ruff: noqa: E501

from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from .nj_doh_enforcement import classify_document_class, classify_remedy
from .nj_sen_002_reconcile import load_ledger


def write_reconciliation_and_ocr(ledger_path: Path, out_dir: Path) -> dict[str, int]:
    rows = load_ledger(ledger_path)
    hashes = [row.get("sha256") for row in rows if row.get("sha256")]
    counts = Counter(hashes)
    first: dict[str, int] = {}
    recon: list[dict[str, str]] = []
    ocr: list[dict[str, str]] = []
    for index, row in enumerate(rows, start=1):
        digest = row.get("sha256") or ""
        downloaded = bool(digest)
        if digest and digest not in first:
            first[digest] = index
        action = row.get("source_listed_action") or ""
        classified = classify_document_class(classify_remedy(action))
        year = str(row.get("source_year") or "")
        occ = {
            "source_occurrence_id": f"nj-doh-enforcement-{index:04d}",
            "index_url": row.get("source_index_page") or "",
            "original_href": row.get("original_href") or "",
            "normalized_url": row.get("normalized_url") or "",
            "acquisition_status": row.get("final_acquisition_status") or "",
            "canonical_document_id": digest,
            "content_sha256": digest,
            "duplicate_content_group_id": digest if digest and counts[digest] > 1 else "",
            "canonical_versus_duplicate": (
                "CANONICAL"
                if digest and first.get(digest) == index
                else ("DUPLICATE_CONTENT" if digest else "NO_CONTENT")
            ),
            "extraction_status": "SOURCE_UNAVAILABLE"
            if not downloaded
            else "SEE_CORPUS_SUMMARY_GRAIN",
            "character_count": "",
            "image_only_flag": "",
            "ocr_backlog_flag": "true" if downloaded else "false",
            "raw_source_document_type": action,
            "normalized_document_classification": classified,
            "classification_method": "INDEX_METADATA"
            if classified != "unclassified_regulatory_document"
            else "UNCLASSIFIED",
            "classification_confidence": "index_action",
            "corpus_scope": "SOURCE_DOCUMENT_UNAVAILABLE" if not downloaded else "",
            "facility_match_status": "",
            "njdoh_facid": "",
            "njdoh_license_number": "",
            "internal_facility_id": "",
            "match_method": "",
            "match_confidence": "",
            "public_eligibility": "false",
            "baseline_only": "true",
            "source_year": year,
            "source_listed_facility_name": row.get("source_listed_facility_name") or "",
        }
        recon.append(occ)
        if not downloaded:
            priority = "NO_OCR_NEEDED"
            reason = "Source PDF unavailable; index metadata retained"
        elif classified != "unclassified_regulatory_document":
            priority = "NO_OCR_NEEDED"
            reason = "Index action already classifies the document; OCR is for detail fields only"
        elif year >= "2025":
            priority = "P0_RECENT_MATCHED_UNCLASSIFIED"
            reason = "Recent unclassified index action"
        elif year >= "2024":
            priority = "P1_MATCHED_DETAIL_NEEDED"
            reason = "Recent enough to prefer text-layer or OCR detail"
        else:
            priority = "P2_HISTORICAL"
            reason = "Historical unclassified row"
        ocr.append(
            {
                "source_occurrence_id": occ["source_occurrence_id"],
                "document_year": year,
                "index_classification": classified,
                "facility_name": occ["source_listed_facility_name"],
                "ocr_priority": priority,
                "already_classifiable_from_index": "true"
                if classified != "unclassified_regulatory_document"
                else "false",
                "reason": reason,
                "public_eligibility": "false",
            }
        )
    out_dir.mkdir(parents=True, exist_ok=True)
    recon_path = out_dir / "nj-sen-002-corpus-reconciliation.csv"
    ocr_path = out_dir / "nj-sen-002-ocr-backlog.csv"
    for path, payload in ((recon_path, recon), (ocr_path, ocr)):
        with path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(payload[0].keys()))
            writer.writeheader()
            writer.writerows(payload)
    return {"occurrences": len(recon), "ocr_rows": len(ocr)}
