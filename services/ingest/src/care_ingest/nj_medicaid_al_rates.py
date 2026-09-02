"""New Jersey Medicaid assisted-living listed provider rates.

A listed row is participation/rate evidence as of the schedule date.
Default unlisted rates never create participation.
Rates are not consumer prices.
"""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import date, datetime

from .nj_doh_enforcement import DocumentMatch, IdentityRecord, match_document

ADAPTER_VERSION = "nj-medicaid-al-rates-v1"
DATASET_KEY = "nj-medicaid-al-rate-schedule"
PROGRAM_CODE = "NJ_MEDICAID_AL"
OFFICIAL_SFY_2026_URL = "https://www.njmmis.com/downloadDocuments/SFY_2026_Assisted_Living_Rates.pdf"
AGENCY = "New Jersey Division of Medical Assistance and Health Services"

RATE_LINE_RE = re.compile(r"^(.+?)\s+\$(\d+(?:\.\d{2})?)\s*$")
DEFAULT_RE = re.compile(
    r"Assisted Living Programs \(ALP\) not listed will receive a rate of \$(\d+\.\d{2}).*"
    r"Assisted Living Residences \(ALR\) not listed will receive a rate of \$(\d+\.\d{2}).*"
    r"Comprehensive Personal Care Homes \(CPCH\) not listed will receive a rate of \$(\d+\.\d{2})",
    re.I | re.S,
)


@dataclass(slots=True)
class RateRow:
    provider_name: str
    subtype: str
    daily_rate: float
    rate_raw: str
    fiscal_year: str
    effective_on: date | None
    source_page: int


@dataclass(slots=True)
class RateSchedule:
    fiscal_year: str
    effective_on: date | None
    updated_on: date | None
    official_url: str
    source_class: str
    default_alp: float | None
    default_alr: float | None
    default_cpch: float | None
    rows: list[RateRow]
    page_count: int
    content_sha256: str
    notes: list[str] = field(default_factory=list)


@dataclass(slots=True)
class RateReport:
    adapter_version: str
    dataset_key: str
    fiscal_year: str
    official_source_found: bool
    source_class: str
    listed_providers: int
    alr: int
    cpch: int
    alp: int
    unknown_subtype: int
    exact: int
    high_confidence: int
    review_required: int
    conflicts: int
    unresolved: int
    unsafe_rejected: int
    rate_min: float | None
    rate_max: float | None
    default_unlisted_participation_invented: bool
    content_sha256: str
    baseline_only: bool
    dry_run: bool
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def extract_pdf_text(payload: bytes) -> tuple[str, int]:
    import io

    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(payload))
    pages = [(page.extract_text() or "") for page in reader.pages]
    return "\n".join(f"\n---PAGE {index}---\n{text}" for index, text in enumerate(pages, start=1)), len(pages)


def parse_named_date(text: str) -> date | None:
    match = re.search(
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})",
        text,
        re.I,
    )
    if not match:
        return None
    return datetime.strptime(match.group(0), "%B %d, %Y").date()


def infer_subtype(name: str) -> str:
    upper = name.upper()
    if re.search(r",\s*ALP\b|\bALP\b|ASSISTED LIVING PROGRAM", upper):
        return "ALP"
    if re.search(r",\s*CPCH\b|\bCPCH\b|COMPREHENSIVE PERSONAL CARE", upper):
        return "CPCH"
    if re.search(r",\s*ALR\b|\bALR\b|ASSISTED LIVING RESIDENCE", upper):
        return "ALR"
    return "UNKNOWN_NOT_PRINTED"


def parse_rate_text(text: str, *, official_url: str, source_class: str = "OFFICIAL", sha256: str = "", page_count: int = 1) -> RateSchedule:
    fy = "SFY_UNKNOWN"
    fy_match = re.search(r"SFY\s+(\d{4})", text)
    if fy_match:
        fy = f"SFY_{fy_match.group(1)}"
    effective = None
    if match := re.search(r"Effective\s+([A-Za-z]+ \d{1,2}, \d{4})", text):
        effective = parse_named_date(match.group(1))
    updated = parse_named_date(text)
    defaults = DEFAULT_RE.search(text.replace("\n", " "))
    rows: list[RateRow] = []
    current_page = 1
    for line in text.splitlines():
        if line.startswith("---PAGE "):
            current_page = int(re.search(r"\d+", line).group())  # type: ignore[union-attr]
            continue
        hit = RATE_LINE_RE.match(line.strip())
        if not hit:
            continue
        name = hit.group(1).strip()
        if name.lower() in {"provider name sfy 2026 rate", "provider name"}:
            continue
        if "assisted living provider rates" in name.lower():
            continue
        rate = float(hit.group(2))
        rows.append(
            RateRow(
                provider_name=name,
                subtype=infer_subtype(name),
                daily_rate=rate,
                rate_raw=f"${hit.group(2)}",
                fiscal_year=fy,
                effective_on=effective,
                source_page=current_page,
            )
        )
    notes = [
        "Listed providers are Medicaid reimbursement-rate evidence as of the schedule date.",
        "A listed rate is not a consumer price, private-pay room rate, or quality score.",
        "Default rates for unlisted ALP/ALR/CPCH do not create participation rows.",
        "Absence from the schedule is not labeled non-participating.",
    ]
    return RateSchedule(
        fiscal_year=fy,
        effective_on=effective,
        updated_on=updated,
        official_url=official_url,
        source_class=source_class,
        default_alp=float(defaults.group(1)) if defaults else None,
        default_alr=float(defaults.group(2)) if defaults else None,
        default_cpch=float(defaults.group(3)) if defaults else None,
        rows=rows,
        page_count=page_count,
        content_sha256=sha256,
        notes=notes,
    )


def parse_rate_pdf(payload: bytes, *, official_url: str, source_class: str = "OFFICIAL") -> RateSchedule:
    text, page_count = extract_pdf_text(payload)
    return parse_rate_text(
        text,
        official_url=official_url,
        source_class=source_class,
        sha256=hashlib.sha256(payload).hexdigest(),
        page_count=page_count,
    )


def match_rate_row(row: RateRow, identities: list[IdentityRecord]) -> DocumentMatch:
    al_types = {"NJ_ALR", "NJ_CPCH", "NJ_ALP"}
    subset = [item for item in identities if item.canonical_type in al_types] or identities
    return match_document(
        printed_license=None,
        printed_facid=None,
        printed_name=row.provider_name,
        printed_street=None,
        printed_city=None,
        identities=subset,
    )


def build_rate_report(schedule: RateSchedule, matches: list[DocumentMatch], *, dry_run: bool) -> RateReport:
    buckets = Counter(item.bucket for item in matches)
    subtypes = Counter(row.subtype for row in schedule.rows)
    rates = [row.daily_rate for row in schedule.rows]
    return RateReport(
        adapter_version=ADAPTER_VERSION,
        dataset_key=DATASET_KEY,
        fiscal_year=schedule.fiscal_year,
        official_source_found=schedule.source_class == "OFFICIAL",
        source_class=schedule.source_class,
        listed_providers=len(schedule.rows),
        alr=subtypes.get("ALR", 0),
        cpch=subtypes.get("CPCH", 0),
        alp=subtypes.get("ALP", 0),
        unknown_subtype=subtypes.get("UNKNOWN_NOT_PRINTED", 0),
        exact=buckets.get("EXACT", 0),
        high_confidence=buckets.get("HIGH_CONFIDENCE", 0),
        review_required=buckets.get("REVIEW_REQUIRED", 0),
        conflicts=buckets.get("CONFLICT", 0),
        unresolved=buckets.get("UNRESOLVED", 0),
        unsafe_rejected=buckets.get("UNSAFE_REJECTED", 0),
        rate_min=min(rates) if rates else None,
        rate_max=max(rates) if rates else None,
        default_unlisted_participation_invented=False,
        content_sha256=schedule.content_sha256,
        baseline_only=True,
        dry_run=dry_run,
        notes=schedule.notes,
    )
