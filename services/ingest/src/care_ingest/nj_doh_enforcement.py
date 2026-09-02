"""NJ-SEN-002 NJDOH penalty letters and state enforcement documents.

Organizes official enforcement evidence. Does not rank facilities.
Does not treat a posted letter as a final order, CMS event, or closure
unless the source expressly says so.
"""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from html.parser import HTMLParser
from pathlib import Path
from typing import Any
from urllib.parse import quote, unquote, urljoin, urlparse
from urllib.request import Request, urlopen

from .nj_doh_ltc import (
    NjDohFacilityRow,
    normalize_address,
    normalize_license_number,
    normalize_name,
)

ADAPTER_VERSION = "nj-doh-enforcement-v1"
DATASET_KEY = "nj-doh-penalty-letters"
INSPECTION_DATASET_KEY = "nj-doh-inspection-index"
REGULATOR_CODE = "NJ_DOH"
AGENCY = "New Jersey Department of Health"
STATE_CODE = "NJ"
OVERVIEW_URL = "https://www.nj.gov/health/healthfacilities/enforcement_actions.shtml"
PENALTY_LETTERS_URL = (
    "https://www.nj.gov/health/healthfacilities/surveys-insp/enforcement_actions.shtml"
)
FACILITY_SEARCH_URL = "https://healthapps.nj.gov/facilities/fssearch.aspx"
PDF_BASE = "https://www.nj.gov"
USER_AGENT = "SeniorTrustHub/NJ-SEN-002 (research ingest; public records)"

REMEDY_RULES: tuple[tuple[str, str], ...] = (
    (r"rescission|rescinding", "RESCISSION"),
    (r"nurse aide|cna certification|cma program|medication aide", "PERSON_OR_PROGRAM_CREDENTIAL"),
    (r"intent to summar(?:y|ily) suspend", "NOTICE_OF_INTENT_TO_SUSPEND"),
    (r"lifting.*summary suspension|lifting of summary suspension", "ORDER_LIFTING_SUSPENSION"),
    (r"summary suspension", "LICENSE_SUSPENSION"),
    (r"license suspension|suspension of license", "LICENSE_SUSPENSION"),
    (r"revocation of lie?cense|revocation order|\brevocation\b", "LICENSE_REVOCATION"),
    (r"license surrender|surrender of license", "LICENSE_SURRENDER"),
    (r"conditional license", "CONDITIONAL_LICENSE"),
    (r"lifting.*emergency closure|lifting emergency closure", "ORDER_LIFTING_EMERGENCY_CLOSURE"),
    (r"emergency closure", "EMERGENCY_CLOSURE"),
    (r"lifting.*cease", "ORDER_LIFTING_CEASE_AND_DESIST"),
    (r"cease\s*(?:and|&)\s*desist", "CEASE_AND_DESIST"),
    (r"revised information requirement", "INFORMATION_REQUIREMENT_ORDER"),
    (r"information requirement", "INFORMATION_REQUIREMENT_ORDER"),
    (
        r"lifting.*curtailment.*directed plan|lifting.*dpoc.*curtailment|"
        r"lifting.*curtailment.*dpoc",
        "ORDER_LIFTING_CURTAILMENT_AND_DPOC",
    ),
    (r"lifting.*directed plan|lifting dpoc|partially lifting directed", "ORDER_LIFTING_DPOC"),
    (r"lifting.*curtailment|lifting of admissions curtailment", "ORDER_LIFTING_CURTAILMENT"),
    (
        r"curtailment.*directed plan|directed plan.*curtailment|curtailment and dpoc",
        "ADMISSION_CURTAILMENT_AND_DPOC",
    ),
    (r"curtailment", "ADMISSION_CURTAILMENT"),
    (
        r"amended directed plan|notice of directed plan|directed plan of correction",
        "DIRECTED_PLAN_OF_CORRECTION",
    ),
    (r"corrected revised notice of assessment", "REVISED_NOTICE_OF_ASSESSMENT_OF_PENALTIES"),
    (r"revised notice of assessment", "REVISED_NOTICE_OF_ASSESSMENT_OF_PENALTIES"),
    (r"amended notice of assessment", "AMENDED_NOTICE_OF_ASSESSMENT_OF_PENALTIES"),
    (r"corrected notice of assessment", "CORRECTED_NOTICE_OF_ASSESSMENT_OF_PENALTIES"),
    (
        r"notice of assessment of penalties|noitce of assessment",
        "NOTICE_OF_ASSESSMENT_OF_PENALTIES",
    ),
    (r"civil monetary penalty|\bpenalty\b", "CIVIL_MONETARY_PENALTY"),
    (r"corrective action", "CORRECTIVE_ACTION"),
)

FACID_RE = re.compile(
    r"(?:NJ\s*Facility\s*ID\s*#?\s*|Facility\s*ID\s*#\s*)(NJ\s*[A-Z0-9]+|[A-Z0-9]+)",
    re.I,
)
LICENSE_RE = re.compile(
    r"License\s*(?:No\.?|Number|#)\s*[:.]?\s*([A-Z0-9\-]+)",
    re.I,
)
TOTAL_PENALTY_RE = re.compile(
    r"(?:assessing(?:\s+a)?(?:\s+total)?(?:\s+civil\s+monetary)?\s+penalty|"
    r"total\s+(?:civil\s+monetary\s+)?penalty|"
    r"civil\s+monetary\s+penalty)\s+of\s+\$([\d,]+(?:\.\d{2})?)",
    re.I,
)
MONEY_RE = re.compile(r"\$[\d,]+(?:\.\d{2})?")
CITATION_RE = re.compile(r"N\.J\.(?:S\.A\.|A\.C\.)\s*[0-9A-Za-z:\-.]+(?:\s*\([^\)]+\))?")
CITY_STATE_ZIP_RE = re.compile(
    r"^([A-Za-z][A-Za-z .'-]+),\s*(?:New Jersey|NJ)\s+(\d{5})(?:-\d{4})?$",
    re.I,
)
DATE_IN_TEXT_RE = re.compile(
    r"\b(January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2},\s+\d{4}\b",
    re.I,
)
CURTAIL_RANGE_RE = re.compile(
    r"(?:beginning|from|effective)\s+"
    r"((?:January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2},\s+\d{4})"
    r"(?:\s+(?:through|until|to)\s+"
    r"((?:January|February|March|April|May|June|July|August|September|October|"
    r"November|December)\s+\d{1,2},\s+\d{4}))?",
    re.I,
)


@dataclass(slots=True)
class IdentityRecord:
    source_facility_id: str
    license_number: str
    official_name: str
    alpha_name: str | None
    street: str | None
    city: str | None
    county: str | None
    zip_code: str | None
    licensed_owner: str | None
    canonical_type: str | None


@dataclass(slots=True)
class IndexRow:
    year_section: str | None
    date_raw: str
    document_date: date | None
    facility_name: str
    action_raw: str
    href: str | None
    source_document_url: str | None
    source_document_id: str | None


@dataclass(slots=True)
class DocumentMatch:
    bucket: str
    method: str
    reason: str
    facility_id_key: str | None = None
    candidate_count: int = 0


@dataclass(slots=True)
class ParsedDocument:
    source_document_id: str
    source_document_url: str
    document_title: str
    document_kind: str
    printed_facility_name: str | None
    printed_license_number: str | None
    printed_source_facility_id: str | None
    printed_street: str | None
    printed_city: str | None
    printed_county: str | None
    printed_zip: str | None
    document_date: date | None
    effective_date: date | None
    end_date: date | None
    remedy_type_raw: str
    remedy_type_canonical: str
    penalty_amount_cents: int | None
    admission_curtailment: bool | None
    admission_curtailment_start: date | None
    admission_curtailment_end: date | None
    conditional_license: bool | None
    conditional_license_start: date | None
    conditional_license_end: date | None
    legal_citation: str | None
    content_sha256: str | None
    file_size_bytes: int | None
    page_count: int | None
    text_extraction_status: str
    document_fingerprint: str
    extraction_confidence: str
    status_raw: str
    is_final: bool | None
    evidence_track: str
    event_identity: str
    match: DocumentMatch
    year_section: str | None
    raw: dict[str, Any]


@dataclass(slots=True)
class EnforcementReport:
    adapter_version: str
    dataset_key: str
    source_url: str
    retrieved_at: str
    source_as_of: str | None
    content_sha256: str
    schema_fingerprint: str
    index_rows: int
    parsed_documents: int
    duplicate_index_rows: int
    rejected_rows: int
    dirty_dates: int
    pdfs_downloaded: int
    pdfs_skipped: int
    text_extracted: int
    no_text_layer: int
    not_downloaded: int
    exact: int
    high_confidence: int
    review_required: int
    conflicts: int
    unresolved: int
    unsafe_rejected: int
    penalty_letters: int
    admission_curtailments: int
    conditional_licenses: int
    other_remedies: int
    by_canonical: dict[str, int]
    baseline_only: bool
    dry_run: bool
    mode: str
    inspection_gate: dict[str, Any] = field(default_factory=dict)
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True, default=str) + "\n"


class PenaltyTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.year: str | None = None
        self._in_title = False
        self._in_td = False
        self._title = ""
        self._cell = ""
        self._href: str | None = None
        self._row: list[tuple[str, str | None]] = []
        self.rows: list[IndexRow] = []
        self.page_modified: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value for key, value in attrs}
        if tag == "meta" and (attr.get("name") or "").lower() in {"modified", "revised"}:
            self.page_modified = attr.get("content") or self.page_modified
        if tag == "div" and attr.get("class") == "sectionTitle":
            self._in_title = True
            self._title = ""
        if tag == "tr":
            self._row = []
        if tag == "td":
            self._in_td = True
            self._cell = ""
            self._href = None
        if tag == "a" and self._in_td and attr.get("href"):
            self._href = attr["href"]

    def handle_endtag(self, tag: str) -> None:
        if tag == "div" and self._in_title:
            text = self._title.strip()
            if re.fullmatch(r"\d{4}", text):
                self.year = text
            self._in_title = False
        if tag == "td" and self._in_td:
            self._row.append((re.sub(r"\s+", " ", self._cell).strip(), self._href))
            self._in_td = False
        if tag == "tr" and len(self._row) >= 3:
            date_s, _ = self._row[0]
            name, href = self._row[1]
            action, _ = self._row[2]
            if date_s.lower() == "date" or not name:
                self._row = []
                return
            url = normalize_pdf_url(href) if href else None
            doc_id = filename_from_url(url) if url else None
            self.rows.append(
                IndexRow(
                    year_section=self.year,
                    date_raw=date_s,
                    document_date=parse_index_date(date_s),
                    facility_name=name,
                    action_raw=action,
                    href=href,
                    source_document_url=url,
                    source_document_id=doc_id,
                )
            )
            self._row = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title += data
        if self._in_td:
            self._cell += data


def fetch_bytes(url: str, timeout: float = 120) -> tuple[int, bytes, str | None]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - official HTTPS
        return int(response.getcode() or 0), response.read(), response.headers.get("Content-Type")


def normalize_pdf_url(href: str | None) -> str | None:
    if not href:
        return None
    text = href.strip()
    if not text:
        return None
    if text.startswith("http://"):
        text = "https://" + text[len("http://") :]
    if text.startswith("/"):
        text = PDF_BASE + text
    elif not text.startswith("https://"):
        text = urljoin(PDF_BASE + "/health/healthfacilities/surveys-insp/", text)
    parsed = urlparse(text)
    path = unquote(parsed.path).strip()
    path = quote(path, safe="/-_.()")
    return parsed._replace(path=path, query="", fragment="").geturl()


def filename_from_url(url: str | None) -> str | None:
    if not url:
        return None
    name = unquote(urlparse(url).path.rsplit("/", 1)[-1]).strip()
    return name or None


def parse_index_date(value: str | None) -> date | None:
    text = (value or "").strip()
    match = re.fullmatch(r"(\d{1,2})/(\d{1,2})/(\d{4})", text)
    if not match:
        return None
    month, day, year = (int(part) for part in match.groups())
    try:
        return date(year, month, day)
    except ValueError:
        return None


def parse_named_date(value: str | None) -> date | None:
    text = (value or "").strip()
    for fmt in ("%B %d, %Y", "%b %d, %Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def normalize_licensed_name(value: object | None) -> str:
    cleaned = re.sub(r"\s*\([A-Z0-9]+\)$", "", str(value or "").strip(), flags=re.I)
    return normalize_name(cleaned)


def classify_remedy(action: str) -> str:
    text = re.sub(r"\s+", " ", action or "").strip().lower()
    if not text:
        return "OTHER_ENFORCEMENT_REMEDY"
    for pattern, canonical in REMEDY_RULES:
        if re.search(pattern, text):
            return canonical
    return "OTHER_ENFORCEMENT_REMEDY"


def dollars_to_cents(value: str) -> int | None:
    cleaned = value.replace("$", "").replace(",", "").strip()
    try:
        amount = float(cleaned)
    except ValueError:
        return None
    if amount < 0:
        return None
    return int(round(amount * 100))


def parse_penalty_amount(text: str) -> int | None:
    hits = TOTAL_PENALTY_RE.findall(text or "")
    if hits:
        return dollars_to_cents(hits[-1])
    return None


def document_status(canonical: str, text: str) -> tuple[str, bool | None]:
    lowered = f"{canonical} {text}".lower()
    if re.search(r"\bfinal order\b|\bfinal agency decision\b", lowered):
        return "unknown", True
    if canonical.startswith("ORDER_LIFTING") or canonical == "RESCISSION":
        return "resolved", None
    return "unknown", None


def extract_pdf_fields(text: str) -> dict[str, Any]:
    compact = re.sub(r"[ \t]+", " ", text or "")
    fac_match = FACID_RE.search(compact)
    license_match = LICENSE_RE.search(compact)
    citations = [item.strip() for item in CITATION_RE.findall(compact)]
    street = None
    city = None
    zip_code = None
    for line in (text or "").splitlines():
        cleaned = re.sub(r"\s+", " ", line).strip()
        city_match = CITY_STATE_ZIP_RE.match(cleaned)
        if city_match:
            city = city_match.group(1).strip()
            zip_code = city_match.group(2)
            continue
    lines = [re.sub(r"\s+", " ", line).strip() for line in (text or "").splitlines()]
    lines = [line for line in lines if line]
    if city:
        for index, line in enumerate(lines):
            if CITY_STATE_ZIP_RE.match(line) and index > 0:
                previous = lines[index - 1]
                if not re.search(
                    r"administrator|dear |department of health|po box", previous, re.I
                ):
                    street = previous
                    break
    start = end = None
    range_match = CURTAIL_RANGE_RE.search(compact)
    if range_match:
        start = parse_named_date(range_match.group(1))
        end = parse_named_date(range_match.group(2)) if range_match.group(2) else None
    return {
        "printed_source_facility_id": normalize_license_number(fac_match.group(1))
        if fac_match
        else None,
        "printed_license_number": normalize_license_number(license_match.group(1))
        if license_match
        else None,
        "printed_street": street,
        "printed_city": city,
        "printed_zip": zip_code,
        "legal_citation": "; ".join(dict.fromkeys(citations)) or None,
        "penalty_amount_cents": parse_penalty_amount(compact),
        "curtail_start": start,
        "curtail_end": end,
        "mentions_final_order": bool(re.search(r"\bfinal order\b", compact, re.I)),
        "named_dates": [item.group(0) for item in DATE_IN_TEXT_RE.finditer(compact)][:12],
    }


def extract_pdf_text(payload: bytes) -> tuple[str, int, str]:
    try:
        from pypdf import PdfReader
    except ImportError:
        return "", 0, "failed"
    try:
        reader = PdfReader(io_bytes(payload))
        pages = list(reader.pages)
        text = "\n".join((page.extract_text() or "") for page in pages)
        if re.sub(r"\s+", "", text) == "":
            return "", len(pages), "no_text_layer"
        return text, len(pages), "extracted"
    except Exception:  # noqa: BLE001 - scanned/corrupt PDFs must not abort the corpus
        return "", 0, "failed"


def io_bytes(payload: bytes):
    import io

    return io.BytesIO(payload)


def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def document_fingerprint(
    *,
    source_document_id: str,
    source_document_url: str,
    document_date: date | None,
    facility_name: str,
    action: str,
    content_sha256: str | None,
) -> str:
    material = {
        "id": source_document_id,
        "url": source_document_url,
        "date": document_date.isoformat() if document_date else None,
        "name": normalize_name(facility_name),
        "action": re.sub(r"\s+", " ", action).strip().lower(),
        "content_sha256": content_sha256,
    }
    payload = json.dumps(material, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def event_identity(source_document_id: str, document_date: date | None, fingerprint: str) -> str:
    if source_document_id:
        dated = document_date.isoformat() if document_date else "undated"
        return f"{source_document_id}|{dated}"
    return fingerprint


def identity_from_ltc(row: NjDohFacilityRow) -> IdentityRecord:
    return IdentityRecord(
        source_facility_id=row.source_facility_id,
        license_number=row.license_number,
        official_name=row.official_name,
        alpha_name=row.alpha_name,
        street=row.street,
        city=row.city,
        county=row.county,
        zip_code=row.zip_code,
        licensed_owner=row.licensed_owner,
        canonical_type=row.facility_type_canonical,
    )


def match_document(
    *,
    printed_license: str | None,
    printed_facid: str | None,
    printed_name: str | None,
    printed_street: str | None,
    printed_city: str | None,
    identities: list[IdentityRecord],
) -> DocumentMatch:
    license_key = normalize_license_number(printed_license)
    facid_key = normalize_license_number(printed_facid)
    name = normalize_licensed_name(printed_name)
    street = normalize_address(printed_street)
    city = normalize_name(printed_city)

    if license_key:
        hits = [item for item in identities if item.license_number == license_key]
        if len(hits) == 1:
            return DocumentMatch(
                "EXACT",
                "license_number",
                "Exact NJDOH license number",
                hits[0].source_facility_id,
                1,
            )
        if len(hits) > 1:
            return DocumentMatch(
                "CONFLICT",
                "license_number",
                "License number matched more than one identity",
                None,
                len(hits),
            )
    if facid_key:
        hits = [item for item in identities if item.source_facility_id == facid_key]
        if len(hits) == 1:
            return DocumentMatch(
                "EXACT", "facid", "Exact NJDOH FacID", hits[0].source_facility_id, 1
            )
        if len(hits) > 1:
            return DocumentMatch(
                "CONFLICT", "facid", "FacID matched more than one identity", None, len(hits)
            )
        if license_key and facid_key and license_key != facid_key:
            license_hits = [item for item in identities if item.license_number == license_key]
            facid_hits = [item for item in identities if item.source_facility_id == facid_key]
            if (
                license_hits
                and facid_hits
                and license_hits[0].source_facility_id != facid_hits[0].source_facility_id
            ):
                return DocumentMatch(
                    "CONFLICT",
                    "license_vs_facid",
                    "Printed license number and FacID resolve to different facilities",
                    None,
                    2,
                )

    if name and street:
        hits = [
            item
            for item in identities
            if normalize_licensed_name(item.official_name) == name
            and normalize_address(item.street) == street
        ]
        if len(hits) == 1:
            return DocumentMatch(
                "HIGH_CONFIDENCE",
                "name_address",
                "Exact normalized licensed name plus exact normalized address",
                hits[0].source_facility_id,
                1,
            )
        if len(hits) > 1:
            return DocumentMatch(
                "REVIEW_REQUIRED",
                "campus_name_address",
                "Name plus address matched a campus with multiple separately licensed facilities",
                None,
                len(hits),
            )

    if name and city:
        hits = [
            item
            for item in identities
            if normalize_licensed_name(item.official_name) == name and normalize_name(item.city) == city
        ]
        if len(hits) == 1:
            return DocumentMatch(
                "HIGH_CONFIDENCE",
                "name_city_unique",
                "Exact licensed name plus city with a unique match",
                hits[0].source_facility_id,
                1,
            )
        if len(hits) > 1:
            return DocumentMatch(
                "REVIEW_REQUIRED",
                "name_city_multiple",
                "Name plus city matched more than one candidate",
                None,
                len(hits),
            )

    if name:
        alias_hits = [
            item
            for item in identities
            if item.alpha_name
            and normalize_licensed_name(item.alpha_name) == name
            and normalize_licensed_name(item.official_name) != name
        ]
        if len(alias_hits) == 1:
            return DocumentMatch(
                "HIGH_CONFIDENCE",
                "documented_alias",
                "Documented deterministic alias already held in state_facility_identity",
                alias_hits[0].source_facility_id,
                1,
            )
        owner_hits = [
            item
            for item in identities
            if item.licensed_owner and normalize_name(item.licensed_owner) == name
        ]
        if owner_hits and not any(
            normalize_licensed_name(item.official_name) == name for item in identities
        ):
            return DocumentMatch(
                "REVIEW_REQUIRED",
                "owner_company",
                "Document names an owner company rather than a licensed site; not attached to the portfolio",
                None,
                len(owner_hits),
            )
        name_hits = [item for item in identities if normalize_licensed_name(item.official_name) == name]
        if name_hits:
            return DocumentMatch(
                "UNSAFE_REJECTED",
                "name_only",
                "Name-only matching is never auto-attached",
                None,
                len(name_hits),
            )
    return DocumentMatch(
        "UNRESOLVED",
        "no_overlap",
        "Official document preserved without a facility attachment",
        None,
        0,
    )


def parse_penalty_index(html: str) -> tuple[list[IndexRow], str | None]:
    parser = PenaltyTableParser()
    parser.feed(html)
    return parser.rows, parser.page_modified


def dedupe_index_rows(rows: list[IndexRow]) -> tuple[list[IndexRow], int]:
    seen: set[str] = set()
    unique: list[IndexRow] = []
    duplicates = 0
    for row in rows:
        key = (row.source_document_url or row.source_document_id or "") + "|" + (row.date_raw or "")
        if row.source_document_url:
            key = row.source_document_url
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        unique.append(row)
    return unique, duplicates


def assemble_documents(
    rows: list[IndexRow],
    identities: list[IdentityRecord],
    *,
    pdf_payloads: dict[str, bytes] | None = None,
    extracted_text: dict[str, str] | None = None,
) -> list[ParsedDocument]:
    payloads = pdf_payloads or {}
    injected = extracted_text or {}
    unique_rows, _duplicates = dedupe_index_rows(rows)
    documents: list[ParsedDocument] = []
    for row in unique_rows:
        if not row.source_document_id or not row.source_document_url:
            continue
        canonical = classify_remedy(row.action_raw)
        payload = payloads.get(row.source_document_id)
        text = injected.get(row.source_document_id, "")
        page_count = None
        content_sha = None
        file_size = None
        extract_status = "not_downloaded"
        if payload is not None:
            content_sha = sha256_bytes(payload)
            file_size = len(payload)
            if row.source_document_id not in injected:
                text, page_count, extract_status = extract_pdf_text(payload)
            else:
                extract_status = "extracted" if text.strip() else "no_text_layer"
        elif text.strip():
            extract_status = "extracted"
        fields = (
            extract_pdf_fields(text)
            if text.strip()
            else {
                "printed_source_facility_id": None,
                "printed_license_number": None,
                "printed_street": None,
                "printed_city": None,
                "printed_zip": None,
                "legal_citation": None,
                "penalty_amount_cents": None,
                "curtail_start": None,
                "curtail_end": None,
                "mentions_final_order": False,
                "named_dates": [],
            }
        )
        status_raw, is_final = document_status(canonical, text)
        if fields.get("mentions_final_order"):
            is_final = True
        curtail = (
            canonical
            in {
                "ADMISSION_CURTAILMENT",
                "ADMISSION_CURTAILMENT_AND_DPOC",
            }
            or None
        )
        if canonical.startswith("ORDER_LIFTING_CURTAILMENT"):
            curtail = False
        conditional = canonical == "CONDITIONAL_LICENSE" or None
        match = match_document(
            printed_license=fields.get("printed_license_number"),
            printed_facid=fields.get("printed_source_facility_id"),
            printed_name=row.facility_name,
            printed_street=fields.get("printed_street"),
            printed_city=fields.get("printed_city"),
            identities=identities,
        )
        if extract_status == "extracted" and fields.get("printed_source_facility_id"):
            confidence = "high"
        elif extract_status == "extracted" and (
            fields.get("printed_street") or fields.get("penalty_amount_cents")
        ):
            confidence = "medium"
        elif extract_status == "extracted":
            confidence = "low"
        else:
            confidence = "none"
        fingerprint = document_fingerprint(
            source_document_id=row.source_document_id,
            source_document_url=row.source_document_url,
            document_date=row.document_date,
            facility_name=row.facility_name,
            action=row.action_raw,
            content_sha256=content_sha,
        )
        documents.append(
            ParsedDocument(
                source_document_id=row.source_document_id,
                source_document_url=row.source_document_url,
                document_title=row.action_raw,
                document_kind="penalty_letter",
                printed_facility_name=row.facility_name,
                printed_license_number=fields.get("printed_license_number"),
                printed_source_facility_id=fields.get("printed_source_facility_id"),
                printed_street=fields.get("printed_street"),
                printed_city=fields.get("printed_city"),
                printed_county=None,
                printed_zip=fields.get("printed_zip"),
                document_date=row.document_date,
                effective_date=None,
                end_date=None,
                remedy_type_raw=row.action_raw,
                remedy_type_canonical=canonical,
                penalty_amount_cents=fields.get("penalty_amount_cents"),
                admission_curtailment=curtail,
                admission_curtailment_start=fields.get("curtail_start") if curtail else None,
                admission_curtailment_end=fields.get("curtail_end") if curtail else None,
                conditional_license=conditional,
                conditional_license_start=None,
                conditional_license_end=None,
                legal_citation=fields.get("legal_citation"),
                content_sha256=content_sha,
                file_size_bytes=file_size,
                page_count=page_count,
                text_extraction_status=extract_status,
                document_fingerprint=fingerprint,
                extraction_confidence=confidence,
                status_raw=status_raw,
                is_final=is_final,
                evidence_track="STATE_FORM",
                event_identity=event_identity(
                    row.source_document_id, row.document_date, fingerprint
                ),
                match=match,
                year_section=row.year_section,
                raw={
                    "date_raw": row.date_raw,
                    "year_section": row.year_section,
                    "named_dates": fields.get("named_dates") or [],
                },
            )
        )
    return documents


def inspect_index(html: str, *, retrieved_at: datetime | None = None) -> dict[str, Any]:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    rows, modified = parse_penalty_index(html)
    unique, duplicates = dedupe_index_rows(rows)
    dates = [row.document_date.isoformat() for row in unique if row.document_date]
    actions = Counter(row.action_raw for row in unique)
    canonical = Counter(classify_remedy(row.action_raw) for row in unique)
    return {
        "source_url": PENALTY_LETTERS_URL,
        "retrieved_at": retrieved.isoformat(),
        "page_modified": modified,
        "http_status": 200,
        "sha256": sha256_bytes(html.encode("utf-8")),
        "bytes": len(html.encode("utf-8")),
        "adapter_version": ADAPTER_VERSION,
        "index_rows": len(rows),
        "unique_documents": len(unique),
        "duplicate_index_rows": duplicates,
        "year_sections": sorted({row.year_section for row in unique if row.year_section}),
        "earliest": min(dates) if dates else None,
        "latest": max(dates) if dates else None,
        "dirty_dates": sum(1 for row in unique if row.document_date is None),
        "unique_facility_names": len({row.facility_name for row in unique}),
        "by_raw_action": dict(actions.most_common()),
        "by_canonical": dict(canonical.most_common()),
        "historical_documents_reachable": bool(unique)
        and "2016" in {row.year_section for row in unique},
        "pagination": "single page, year section headings 2016-2026",
        "notes": [
            "Index supplies Date, Facility Name, Enforcement Action, and PDF href.",
            "Index does not print license number, FacID, or address.",
            "Name-only index rows are not auto-attached.",
        ],
    }


def build_report(
    documents: list[ParsedDocument],
    *,
    html: str,
    retrieved_at: datetime,
    dry_run: bool,
    baseline_only: bool,
    duplicate_index_rows: int,
    rejected_rows: int,
    pdfs_downloaded: int,
    pdfs_skipped: int,
    inspection_gate: dict[str, Any] | None = None,
) -> EnforcementReport:
    buckets = Counter(item.match.bucket for item in documents)
    extract = Counter(item.text_extraction_status for item in documents)
    canonical = Counter(item.remedy_type_canonical for item in documents)
    dates = [item.document_date for item in documents if item.document_date]
    penalty_like = {
        "NOTICE_OF_ASSESSMENT_OF_PENALTIES",
        "REVISED_NOTICE_OF_ASSESSMENT_OF_PENALTIES",
        "AMENDED_NOTICE_OF_ASSESSMENT_OF_PENALTIES",
        "CORRECTED_NOTICE_OF_ASSESSMENT_OF_PENALTIES",
        "CIVIL_MONETARY_PENALTY",
    }
    curtail_like = {
        "ADMISSION_CURTAILMENT",
        "ADMISSION_CURTAILMENT_AND_DPOC",
        "ORDER_LIFTING_CURTAILMENT",
        "ORDER_LIFTING_CURTAILMENT_AND_DPOC",
    }
    return EnforcementReport(
        adapter_version=ADAPTER_VERSION,
        dataset_key=DATASET_KEY,
        source_url=PENALTY_LETTERS_URL,
        retrieved_at=retrieved_at.isoformat(),
        source_as_of=max(dates).isoformat() if dates else None,
        content_sha256=sha256_bytes(html.encode("utf-8")),
        schema_fingerprint=sha256_bytes(b"date|facility_name|enforcement_action|pdf_href"),
        index_rows=len(documents) + duplicate_index_rows + rejected_rows,
        parsed_documents=len(documents),
        duplicate_index_rows=duplicate_index_rows,
        rejected_rows=rejected_rows,
        dirty_dates=sum(1 for item in documents if item.document_date is None),
        pdfs_downloaded=pdfs_downloaded,
        pdfs_skipped=pdfs_skipped,
        text_extracted=extract.get("extracted", 0),
        no_text_layer=extract.get("no_text_layer", 0),
        not_downloaded=extract.get("not_downloaded", 0),
        exact=buckets.get("EXACT", 0),
        high_confidence=buckets.get("HIGH_CONFIDENCE", 0),
        review_required=buckets.get("REVIEW_REQUIRED", 0),
        conflicts=buckets.get("CONFLICT", 0),
        unresolved=buckets.get("UNRESOLVED", 0),
        unsafe_rejected=buckets.get("UNSAFE_REJECTED", 0),
        penalty_letters=sum(1 for item in documents if item.remedy_type_canonical in penalty_like),
        admission_curtailments=sum(
            1 for item in documents if item.remedy_type_canonical in curtail_like
        ),
        conditional_licenses=sum(
            1 for item in documents if item.remedy_type_canonical == "CONDITIONAL_LICENSE"
        ),
        other_remedies=sum(
            1
            for item in documents
            if item.remedy_type_canonical
            not in penalty_like | curtail_like | {"CONDITIONAL_LICENSE"}
        ),
        by_canonical=dict(canonical),
        baseline_only=baseline_only,
        dry_run=dry_run,
        mode="dry-run" if dry_run else "execute",
        inspection_gate=inspection_gate or {},
        notes=[
            "First snapshot is baseline-only; index reordering does not create events.",
            "public_eligible remains false. No /new-jersey page or sitemap changes.",
            "Penalty dollars are stored as cents and are not a rating.",
            "A posted letter is not inferred to be a final order, CMS event, harm finding, or closure.",
            "Unmatched official documents are retained with a nullable facility foreign key.",
        ],
    )


def load_local_pdfs(pdf_dir: Path) -> dict[str, bytes]:
    if not pdf_dir.is_dir():
        return {}
    payloads: dict[str, bytes] = {}
    for path in pdf_dir.glob("*.pdf"):
        payloads[path.name] = path.read_bytes()
    return payloads


def incremental_download_pdfs(
    rows: list[IndexRow],
    pdf_dir: Path,
    *,
    timeout: float = 90,
    limit: int | None = None,
    pause_seconds: float = 0.35,
) -> tuple[int, int, int]:
    import time

    pdf_dir.mkdir(parents=True, exist_ok=True)
    unique, _ = dedupe_index_rows(rows)
    downloaded = skipped = failed = 0
    count = 0
    for row in unique:
        if not row.source_document_url or not row.source_document_id:
            continue
        dest = pdf_dir / row.source_document_id
        if dest.exists() and dest.stat().st_size > 0:
            skipped += 1
            continue
        if limit is not None and count >= limit:
            break
        try:
            _status, body, _ctype = fetch_bytes(row.source_document_url, timeout=timeout)
            dest.write_bytes(body)
            downloaded += 1
            count += 1
            time.sleep(pause_seconds)
        except Exception:  # noqa: BLE001
            failed += 1
            time.sleep(max(pause_seconds, 1.0))
    return downloaded, skipped, failed
