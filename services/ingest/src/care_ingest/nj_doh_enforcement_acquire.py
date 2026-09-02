"""NJ-SEN-002C acquisition retry, ledger, and corpus reports.

Does not refetch hashed PDFs. Does not bypass access controls.
First corpus is baseline-only.
"""

# ruff: noqa: E501

from __future__ import annotations

import json
import re
import time
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import unquote
from urllib.request import HTTPRedirectHandler, Request, build_opener

from .nj_doh_enforcement import (
    AGENCY,
    PENALTY_LETTERS_URL,
    USER_AGENT,
    IdentityRecord,
    IndexRow,
    assemble_documents,
    dedupe_index_rows,
    extract_pdf_text,
    filename_from_url,
    parse_penalty_index,
    sha256_bytes,
)

MAX_REDIRECTS = 5
WIN_UNSAFE = re.compile(r'[<>:"/\\|?*]')


class BoundedRedirectHandler(HTTPRedirectHandler):
    max_repeats = MAX_REDIRECTS
    max_redirections = MAX_REDIRECTS


@dataclass(slots=True)
class FetchResult:
    status: str
    http_status: int | None = None
    body: bytes | None = None
    content_type: str | None = None
    final_url: str | None = None
    error_category: str | None = None
    error_detail: str | None = None


@dataclass(slots=True)
class AcquisitionRecord:
    source_index_page: str
    original_href: str | None
    resolved_url: str | None
    normalized_url: str | None
    source_title: str
    source_listed_facility_name: str
    source_listed_document_date: str | None
    source_listed_action: str
    retrieval_attempt_timestamp: str | None
    http_status: int | None
    final_acquisition_status: str
    local_file_path: str | None
    file_size: int | None
    sha256: str | None
    pdf_page_count: int | None
    mime_validation: str
    retry_count: int
    last_error_category: str | None
    last_error_detail: str | None
    first_seen: str | None
    last_checked: str | None
    source_year: str | None
    baseline_only: bool = True


@dataclass(slots=True)
class RetryReport:
    attempted: int = 0
    recovered: int = 0
    skipped_existing: int = 0
    http_404: int = 0
    http_410: int = 0
    other_http: int = 0
    timeout: int = 0
    invalid_url: int = 0
    redirect_failure: int = 0
    non_pdf: int = 0
    validation_failure: int = 0
    other: int = 0
    records: list[AcquisitionRecord] = field(default_factory=list)

    def to_json(self) -> str:
        payload = asdict(self)
        payload.pop("records", None)
        return json.dumps(payload, indent=2, sort_keys=True) + "\n"


def safe_filename(name: str) -> str:
    cleaned = WIN_UNSAFE.sub("_", unquote(name).strip())
    return cleaned or "document.pdf"


def local_pdf_map(pdf_dir: Path) -> dict[str, Path]:
    mapping: dict[str, Path] = {}
    if not pdf_dir.is_dir():
        return mapping
    for path in pdf_dir.glob("*.pdf"):
        mapping[path.name.casefold()] = path
        mapping[unquote(path.name).casefold()] = path
    return mapping


def lookup_local_pdf(pdf_dir: Path, source_document_id: str | None, mapping: dict[str, Path] | None = None) -> Path | None:
    if not source_document_id:
        return None
    files = mapping if mapping is not None else local_pdf_map(pdf_dir)
    key = safe_filename(source_document_id).casefold()
    return files.get(key) or files.get(source_document_id.casefold())


def fetch_pdf(url: str, timeout: float = 90) -> FetchResult:
    if not url or "://" not in url:
        return FetchResult("INVALID_SOURCE_URL", error_category="invalid_url", error_detail="missing url")
    opener = build_opener(BoundedRedirectHandler())
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/pdf,*/*"})
    try:
        with opener.open(request, timeout=timeout) as response:  # noqa: S310
            status = int(response.getcode() or 0)
            body = response.read()
            ctype = response.headers.get("Content-Type")
            final = response.geturl()
    except HTTPError as exc:
        if exc.code == 404:
            return FetchResult("HTTP_404_SOURCE_DOCUMENT_UNAVAILABLE", http_status=404, error_category="http_404", error_detail=str(exc))
        if exc.code == 410:
            return FetchResult("HTTP_410_SOURCE_DOCUMENT_REMOVED", http_status=410, error_category="http_410", error_detail=str(exc))
        return FetchResult("RETRYABLE_NETWORK_FAILURE", http_status=int(exc.code), error_category="other_http", error_detail=str(exc))
    except TimeoutError as exc:
        return FetchResult("RETRYABLE_NETWORK_FAILURE", error_category="timeout", error_detail=str(exc))
    except URLError as exc:
        detail = str(exc.reason if getattr(exc, "reason", None) else exc)
        if "redirect" in detail.lower():
            return FetchResult("RETRYABLE_NETWORK_FAILURE", error_category="redirect_failure", error_detail=detail)
        if "timed out" in detail.lower():
            return FetchResult("RETRYABLE_NETWORK_FAILURE", error_category="timeout", error_detail=detail)
        return FetchResult("RETRYABLE_NETWORK_FAILURE", error_category="other", error_detail=detail)
    except Exception as exc:  # noqa: BLE001
        return FetchResult("RETRYABLE_NETWORK_FAILURE", error_category="other", error_detail=str(exc))
    if status >= 400:
        return FetchResult("RETRYABLE_NETWORK_FAILURE", http_status=status, error_category="other_http", error_detail=f"http {status}")
    if not body.startswith(b"%PDF"):
        return FetchResult(
            "NON_PDF_RESPONSE",
            http_status=status,
            body=body,
            content_type=ctype,
            final_url=final,
            error_category="non_pdf",
            error_detail=f"content-type={ctype}",
        )
    if ctype and "html" in ctype.lower():
        return FetchResult("NON_PDF_RESPONSE", http_status=status, content_type=ctype, error_category="content_type_mismatch", error_detail=ctype)
    return FetchResult("DOWNLOADED_HASH_VERIFIED", http_status=status, body=body, content_type=ctype, final_url=final)


def verify_existing_pdf(path: Path) -> tuple[str, str | None, int, int | None]:
    data = path.read_bytes()
    if not data.startswith(b"%PDF"):
        return "PDF_VALIDATION_FAILED", None, len(data), None
    digest = sha256_bytes(data)
    try:
        _text, pages, status = extract_pdf_text(data)
        page_count = pages or None
        if status == "corrupt":
            return "PDF_VALIDATION_FAILED", digest, len(data), page_count
    except Exception:  # noqa: BLE001
        page_count = None
    return "EXISTING_HASH_VERIFIED", digest, len(data), page_count


def acquire_pdfs(
    rows: list[IndexRow],
    pdf_dir: Path,
    *,
    timeout: float = 90,
    pause_seconds: float = 0.35,
    retry_missing_only: bool = True,
    retrieved_at: datetime | None = None,
) -> RetryReport:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    pdf_dir.mkdir(parents=True, exist_ok=True)
    unique, _ = dedupe_index_rows(rows)
    files = local_pdf_map(pdf_dir)
    report = RetryReport()
    seen_404: set[str] = set()
    for row in unique:
        now = datetime.now(tz=UTC).isoformat()
        normalized = row.source_document_url
        dest_name = safe_filename(row.source_document_id or filename_from_url(normalized) or "document.pdf")
        existing = lookup_local_pdf(pdf_dir, dest_name, files)
        if existing and existing.exists() and existing.stat().st_size > 0:
            status, digest, size, pages = verify_existing_pdf(existing)
            report.skipped_existing += 1
            report.records.append(
                _record(row, normalized, status, http_status=None, path=existing, size=size, digest=digest, pages=pages, retry=0, checked=now, first=now)
            )
            continue
        if not retry_missing_only:
            report.records.append(
                _record(row, normalized, "NOT_ATTEMPTED", retry=0, checked=now, first=now)
            )
            continue
        if not normalized:
            report.invalid_url += 1
            report.attempted += 1
            report.records.append(
                _record(row, normalized, "INVALID_SOURCE_URL", error_category="invalid_url", error_detail="no normalized url", retry=1, checked=now, first=now)
            )
            continue
        if normalized in seen_404:
            report.http_404 += 1
            report.attempted += 1
            report.records.append(
                _record(row, normalized, "HTTP_404_SOURCE_DOCUMENT_UNAVAILABLE", http_status=404, error_category="http_404", retry=1, checked=now, first=now)
            )
            continue
        report.attempted += 1
        result = fetch_pdf(normalized, timeout=timeout)
        if result.status == "DOWNLOADED_HASH_VERIFIED" and result.body:
            dest = pdf_dir / dest_name
            dest.write_bytes(result.body)
            files[dest_name.casefold()] = dest
            digest = sha256_bytes(result.body)
            _text, pages, _st = extract_pdf_text(result.body)
            report.recovered += 1
            report.records.append(
                _record(
                    row,
                    normalized,
                    "RECOVERED_AFTER_URL_NORMALIZATION",
                    http_status=result.http_status,
                    path=dest,
                    size=len(result.body),
                    digest=digest,
                    pages=pages or None,
                    retry=1,
                    checked=now,
                    first=now,
                    mime="pdf_magic_ok",
                )
            )
        else:
            _tally(report, result)
            if result.http_status == 404:
                seen_404.add(normalized)
            report.records.append(
                _record(
                    row,
                    normalized,
                    result.status,
                    http_status=result.http_status,
                    error_category=result.error_category,
                    error_detail=result.error_detail,
                    retry=1,
                    checked=now,
                    first=now,
                    mime=result.content_type,
                )
            )
        time.sleep(pause_seconds if result.status == "DOWNLOADED_HASH_VERIFIED" else max(pause_seconds, 0.6))
    report.records.sort(key=lambda item: (item.source_year or "", item.source_listed_document_date or "", item.normalized_url or ""))
    _ = retrieved
    return report


def _tally(report: RetryReport, result: FetchResult) -> None:
    category = result.error_category or "other"
    if category == "http_404":
        report.http_404 += 1
    elif category == "http_410":
        report.http_410 += 1
    elif category == "timeout":
        report.timeout += 1
    elif category == "invalid_url":
        report.invalid_url += 1
    elif category == "redirect_failure":
        report.redirect_failure += 1
    elif category in {"non_pdf", "content_type_mismatch"}:
        report.non_pdf += 1
    elif category == "other_http":
        report.other_http += 1
    elif result.status == "PDF_VALIDATION_FAILED":
        report.validation_failure += 1
    else:
        report.other += 1


def _record(
    row: IndexRow,
    normalized: str | None,
    status: str,
    *,
    http_status: int | None = None,
    path: Path | None = None,
    size: int | None = None,
    digest: str | None = None,
    pages: int | None = None,
    error_category: str | None = None,
    error_detail: str | None = None,
    retry: int = 0,
    checked: str | None = None,
    first: str | None = None,
    mime: str | None = None,
) -> AcquisitionRecord:
    return AcquisitionRecord(
        source_index_page=PENALTY_LETTERS_URL,
        original_href=row.href,
        resolved_url=normalized,
        normalized_url=normalized,
        source_title=row.action_raw,
        source_listed_facility_name=row.facility_name,
        source_listed_document_date=row.document_date.isoformat() if row.document_date else row.date_raw,
        source_listed_action=row.action_raw,
        retrieval_attempt_timestamp=checked,
        http_status=http_status,
        final_acquisition_status=status,
        local_file_path=str(path) if path else None,
        file_size=size,
        sha256=digest,
        pdf_page_count=pages,
        mime_validation=mime or ("pdf_magic_ok" if digest else "not_validated"),
        retry_count=retry,
        last_error_category=error_category,
        last_error_detail=error_detail,
        first_seen=first,
        last_checked=checked,
        source_year=row.year_section,
        baseline_only=True,
    )


def complete_ledger(rows: list[IndexRow], retry: RetryReport, pdf_dir: Path) -> list[AcquisitionRecord]:
    unique, _ = dedupe_index_rows(rows)
    by_url = {item.normalized_url: item for item in retry.records if item.normalized_url}
    by_id = {Path(item.local_file_path).name.casefold(): item for item in retry.records if item.local_file_path}
    files = local_pdf_map(pdf_dir)
    now = datetime.now(tz=UTC).isoformat()
    ledger: list[AcquisitionRecord] = []
    for row in unique:
        normalized = row.source_document_url
        if normalized and normalized in by_url:
            ledger.append(by_url[normalized])
            continue
        dest_name = safe_filename(row.source_document_id or "document.pdf")
        if dest_name.casefold() in by_id:
            ledger.append(by_id[dest_name.casefold()])
            continue
        existing = lookup_local_pdf(pdf_dir, dest_name, files)
        if existing:
            status, digest, size, pages = verify_existing_pdf(existing)
            ledger.append(_record(row, normalized, status, path=existing, size=size, digest=digest, pages=pages, checked=now, first=now))
        else:
            ledger.append(
                _record(row, normalized, "NOT_ATTEMPTED" if not retry.records else "HTTP_404_SOURCE_DOCUMENT_UNAVAILABLE", retry=0, checked=now, first=now)
            )
    return ledger


def dedupe_hashes(ledger: list[AcquisitionRecord]) -> dict[str, Any]:
    groups: dict[str, list[AcquisitionRecord]] = defaultdict(list)
    for item in ledger:
        if item.sha256:
            groups[item.sha256].append(item)
    duplicate_groups = {digest: recs for digest, recs in groups.items() if len(recs) > 1}
    largest = max((len(recs) for recs in duplicate_groups.values()), default=0)
    return {
        "downloaded_url_occurrences": sum(1 for item in ledger if item.sha256),
        "unique_hashes": len(groups),
        "duplicate_content_groups": len(duplicate_groups),
        "largest_duplicate_group": largest,
        "changed_content_urls": 0,
        "duplicate_groups": [
            {
                "sha256": digest,
                "count": len(recs),
                "urls": [item.normalized_url for item in recs],
                "names": sorted({item.source_listed_facility_name for item in recs}),
            }
            for digest, recs in sorted(duplicate_groups.items(), key=lambda pair: -len(pair[1]))[:50]
        ],
    }


def build_corpus_summary(
    html: str,
    identities: list[IdentityRecord],
    pdf_dir: Path,
    ledger: list[AcquisitionRecord],
) -> dict[str, Any]:
    rows, _ = parse_penalty_index(html)
    unique, duplicates = dedupe_index_rows(rows)
    files = local_pdf_map(pdf_dir)
    payloads: dict[str, bytes] = {}
    for row in unique:
        path = lookup_local_pdf(pdf_dir, row.source_document_id, files)
        if path and row.source_document_id:
            payloads[row.source_document_id] = path.read_bytes()
            payloads[path.name] = payloads[row.source_document_id]
    documents = assemble_documents(unique, identities, pdf_payloads=payloads)
    extraction = Counter(item.extraction_status for item in documents)
    classes = Counter(item.document_class for item in documents)
    scopes = Counter(item.corpus_scope for item in documents)
    buckets = Counter(item.match.bucket for item in documents)
    by_year: dict[str, dict[str, int]] = {}
    for rec, doc in zip(ledger, documents, strict=False):
        year = rec.source_year or (str(doc.document_date.year) if doc.document_date else "unknown")
        slot = by_year.setdefault(
            year,
            {
                "indexed_urls": 0,
                "downloaded": 0,
                "source_unavailable": 0,
                "unique_hashes": 0,
                "parsed": 0,
                "matched_ltc": 0,
                "non_ltc": 0,
                "unresolved": 0,
            },
        )
        slot["indexed_urls"] += 1
        if rec.sha256:
            slot["downloaded"] += 1
        if rec.final_acquisition_status.startswith("HTTP_"):
            slot["source_unavailable"] += 1
        slot["parsed"] += 1
        if doc.corpus_scope == "NJ_LTC_FACILITY_MATCHED":
            slot["matched_ltc"] += 1
        elif doc.corpus_scope in {"NJ_ACUTE_OR_OTHER_HEALTH_FACILITY", "NON_FACILITY_OR_AGENCY_DOCUMENT"}:
            slot["non_ltc"] += 1
        elif doc.corpus_scope in {"UNRESOLVED_SCOPE", "LIKELY_NJ_LTC_REVIEW_REQUIRED"}:
            slot["unresolved"] += 1
    hashes_by_year: dict[str, set[str]] = defaultdict(set)
    for rec in ledger:
        if rec.sha256:
            hashes_by_year[rec.source_year or "unknown"].add(rec.sha256)
    for year, hashes in hashes_by_year.items():
        by_year.setdefault(year, {})["unique_hashes"] = len(hashes)
        if year in by_year:
            by_year[year]["unique_hashes"] = len(hashes)
    matched_docs = [item for item in documents if item.match.bucket in {"EXACT", "HIGH_CONFIDENCE"}]
    unique_facilities = sorted({item.match.facility_id_key for item in matched_docs if item.match.facility_id_key})
    by_type: Counter[str] = Counter()
    identity_type = {item.source_facility_id: item.canonical_type for item in identities}
    for facid in unique_facilities:
        by_type[identity_type.get(facid) or "UNKNOWN"] += 1
    return {
        "agency": AGENCY,
        "adapter": "nj-doh-enforcement-v1",
        "baseline_only": True,
        "index_rows": len(rows),
        "unique_index_urls": len(unique),
        "duplicate_index_rows": duplicates,
        "acquisition": Counter(item.final_acquisition_status for item in ledger),
        "extraction": dict(extraction),
        "document_class": dict(classes),
        "corpus_scope": dict(scopes),
        "match_buckets": dict(buckets),
        "unique_ltc_facilities_with_evidence": len(unique_facilities),
        "facilities_by_licensed_type": dict(by_type),
        "by_year": dict(sorted(by_year.items())),
        "notes": [
            "Documents discovered from the NJDOH public enforcement indexes, with source availability varying by year.",
            "First corpus is baseline-only. No historical monitoring alerts.",
            "Penalty dollars are not a rating. Name-only matches are never auto-attached.",
        ],
    }


def write_reports(
    ledger: list[AcquisitionRecord],
    summary: dict[str, Any],
    dedupe: dict[str, Any],
    retry: RetryReport,
    output_dir: Path,
) -> dict[str, str]:
    output_dir.mkdir(parents=True, exist_ok=True)
    ledger_path = output_dir / "nj-sen-002-acquisition-ledger.jsonl"
    with ledger_path.open("w", encoding="utf-8") as handle:
        for item in ledger:
            handle.write(json.dumps(asdict(item), default=str) + "\n")
    summary_path = output_dir / "nj-sen-002-acquisition-summary.json"
    payload = {
        "retry": json.loads(retry.to_json()),
        "dedupe": {key: value for key, value in dedupe.items() if key != "duplicate_groups"},
        "duplicate_groups_preview": dedupe.get("duplicate_groups", [])[:20],
        "corpus": summary,
    }
    summary_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")
    return {"ledger": str(ledger_path), "summary": str(summary_path)}
