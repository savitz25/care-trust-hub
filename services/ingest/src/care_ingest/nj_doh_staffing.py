"""NJDOH quarterly nursing-home staffing ratios.

Residents per one staff member (1RN:#Res). Not CMS PBJ.
Not attached to ALR/CPCH/ALP/adult day/AFC/RDCH/PACE.
"""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from html.parser import HTMLParser
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.request import Request, urlopen

from .nj_doh_enforcement import IdentityRecord, match_document
from .nj_doh_ltc import TYPE_MAP

ADAPTER_VERSION = "nj-doh-staffing-v1"
DATASET_KEY = "nj-doh-nh-staffing"
REGULATOR_CODE = "NJ_DOH"
AGENCY = "New Jersey Department of Health"
SOURCE_URL = "https://healthapps.nj.gov/nhstaffing/public/selectreport.aspx"
USER_AGENT = "SeniorTrustHub/NJ-SEN-003 (research ingest; public records)"
NURSING_TYPES = {canonical for canonical, cms, _note in TYPE_MAP.values() if cms}
SHIFTS = ("day", "evening", "night")
STAFF = ("RN", "LPN", "CNA")
MISSING_CODES = {"M", "NS", "-"}


@dataclass(slots=True)
class StaffingCell:
    raw: str
    numeric: float | None
    missing_code: str | None


@dataclass(slots=True)
class StaffingFacilityRow:
    source_facility_id: str | None
    source_facility_name: str
    is_statewide: bool
    statewide_label: str | None
    day_census: StaffingCell
    evening_census: StaffingCell
    night_census: StaffingCell
    ratios: dict[tuple[str, str], StaffingCell]
    year: int
    quarter: str


@dataclass(slots=True)
class StaffingReport:
    adapter_version: str
    dataset_key: str
    year: int
    quarter: str
    source_rows: int
    distinct_facilities: int
    statewide_rows: int
    exact: int
    high_confidence: int
    review_required: int
    conflicts: int
    unresolved: int
    unsafe_rejected: int
    missing_values: int
    content_sha256: str
    baseline_only: bool
    dry_run: bool
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


class StaffingTableParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.title = ""
        self._in_title = False
        self._in_td = False
        self._cell = ""
        self._href: str | None = None
        self._row: list[tuple[str, str | None]] = []
        self.rows: list[list[tuple[str, str | None]]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = dict(attrs)
        if tag == "span" and attr.get("id") == "lblTitle":
            self._in_title = True
        if tag == "tr" and (attr.get("id") or "").startswith("Repeater1_"):
            self._row = []
        if tag == "td":
            self._in_td = True
            self._cell = ""
            self._href = None
        if tag == "a" and self._in_td and attr.get("href"):
            self._href = attr["href"]

    def handle_endtag(self, tag: str) -> None:
        if tag == "span" and self._in_title:
            self._in_title = False
        if tag == "td" and self._in_td:
            self._row.append((re.sub(r"\s+", " ", self._cell).strip(), self._href))
            self._in_td = False
        if tag == "tr" and self._row:
            self.rows.append(self._row)
            self._row = []

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title += data
        if self._in_td:
            self._cell += data


def parse_ratio(raw: str) -> StaffingCell:
    text = (raw or "").strip()
    if text.upper() in MISSING_CODES or text == "NS":
        return StaffingCell(text, None, text.upper() if text != "-" else "-")
    try:
        return StaffingCell(text, float(text), None)
    except ValueError:
        return StaffingCell(text, None, "UNPARSEABLE")


def parse_title_period(title: str) -> tuple[int, str]:
    match = re.search(r"(First|Second|Third|Fourth) Quarter of the Year (\d{4})", title, re.I)
    mapping = {"first": "Q1", "second": "Q2", "third": "Q3", "fourth": "Q4"}
    if not match:
        raise ValueError(f"staffing report title missing period: {title!r}")
    return int(match.group(2)), mapping[match.group(1).lower()]


def parse_staffing_html(
    html: str, *, year: int | None = None, quarter: str | None = None
) -> list[StaffingFacilityRow]:
    parser = StaffingTableParser()
    parser.feed(html)
    parsed_year, parsed_quarter = (
        parse_title_period(parser.title) if parser.title.strip() else (year, quarter)
    )
    if parsed_year is None or parsed_quarter is None:
        raise ValueError("staffing HTML has no quarter title")
    out: list[StaffingFacilityRow] = []
    for cells in parser.rows:
        if len(cells) < 13:
            continue
        name, href = cells[0]
        if not name or name.lower().startswith("facility name"):
            continue
        facid = None
        if href:
            query = parse_qs(urlparse(href).query)
            item = (query.get("item") or [None])[0]
            if item:
                facid = re.sub(r"[^A-Za-z0-9]", "", item).upper()
        statewide = "statewide" in name.lower()
        values = [parse_ratio(cell[0]) for cell in cells[1:13]]
        ratios: dict[tuple[str, str], StaffingCell] = {}
        for shift_index, shift in enumerate(SHIFTS):
            base = shift_index * 4
            for staff_index, staff in enumerate(STAFF):
                ratios[(shift, staff)] = values[base + 1 + staff_index]
        out.append(
            StaffingFacilityRow(
                source_facility_id=None if statewide else facid,
                source_facility_name=name.strip(),
                is_statewide=statewide,
                statewide_label=name.strip() if statewide else None,
                day_census=values[0],
                evening_census=values[4],
                night_census=values[8],
                ratios=ratios,
                year=parsed_year,
                quarter=parsed_quarter,
            )
        )
    return out


def match_staffing_row(row: StaffingFacilityRow, identities: list[IdentityRecord]) -> Any:
    from .nj_doh_enforcement import DocumentMatch

    if row.is_statewide:
        return DocumentMatch(
            "UNRESOLVED", "statewide_comparator", "Statewide comparator is not a facility", None, 0
        )
    if row.source_facility_id:
        hits = [item for item in identities if item.source_facility_id == row.source_facility_id]
        if len(hits) == 1:
            if hits[0].canonical_type and hits[0].canonical_type not in NURSING_TYPES:
                return DocumentMatch(
                    "UNSAFE_REJECTED",
                    "non_nursing_class",
                    "NJDOH staffing is not attached to non-nursing licensed classes",
                    None,
                    1,
                )
            return DocumentMatch(
                "EXACT",
                "facid",
                "Exact NJDOH FacID from staffing report link",
                hits[0].source_facility_id,
                1,
            )
        if len(hits) > 1:
            return DocumentMatch(
                "CONFLICT", "facid", "FacID matched more than one identity", None, len(hits)
            )
    return match_document(
        printed_license=None,
        printed_facid=None,
        printed_name=row.source_facility_name,
        printed_street=None,
        printed_city=None,
        identities=identities,
    )


def fetch_form(timeout: float = 60) -> bytes:
    request = Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        return response.read()


def hidden_value(html: str, name: str) -> str:
    match = re.search(rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    if not match:
        match = re.search(rf'id="{re.escape(name)}"[^>]*value="([^"]*)"', html)
    return match.group(1) if match else ""


def post_staffing_report(html: str, year: str, quarter: str, timeout: float = 180) -> bytes:
    boxes = re.findall(r'name="(rptFacnames\$ctl\d+\$chkFac)"', html)
    fields = {
        "__VIEWSTATE": hidden_value(html, "__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": hidden_value(html, "__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": hidden_value(html, "__EVENTVALIDATION"),
        "ddlYear": year,
        "ddlQuarter": quarter,
        "btnContinue": "Continue",
    }
    for name in boxes:
        fields[name] = "on"
    body = urlencode(fields).encode("utf-8")
    request = Request(
        SOURCE_URL,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://healthapps.nj.gov",
            "Referer": SOURCE_URL,
        },
        method="POST",
    )
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        return response.read()


def build_staffing_report(
    rows: list[StaffingFacilityRow],
    identities: list[IdentityRecord],
    *,
    html: str,
    dry_run: bool,
) -> StaffingReport:
    facility_rows = [row for row in rows if not row.is_statewide]
    matches = [match_staffing_row(row, identities) for row in facility_rows]
    buckets = Counter(item.bucket for item in matches)
    missing = 0
    for row in facility_rows:
        for cell in row.ratios.values():
            if cell.missing_code:
                missing += 1
    year = rows[0].year if rows else 0
    quarter = rows[0].quarter if rows else ""
    return StaffingReport(
        adapter_version=ADAPTER_VERSION,
        dataset_key=DATASET_KEY,
        year=year,
        quarter=quarter,
        source_rows=len(facility_rows),
        distinct_facilities=len(
            {row.source_facility_id or row.source_facility_name for row in facility_rows}
        ),
        statewide_rows=sum(1 for row in rows if row.is_statewide),
        exact=buckets.get("EXACT", 0),
        high_confidence=buckets.get("HIGH_CONFIDENCE", 0),
        review_required=buckets.get("REVIEW_REQUIRED", 0),
        conflicts=buckets.get("CONFLICT", 0),
        unresolved=buckets.get("UNRESOLVED", 0),
        unsafe_rejected=buckets.get("UNSAFE_REJECTED", 0),
        missing_values=missing,
        content_sha256=hashlib.sha256(html.encode("utf-8")).hexdigest(),
        baseline_only=True,
        dry_run=dry_run,
        notes=[
            "Ratios are residents per one staff member (1RN:#Res). They are not inverted to hours per resident day.",
            "M/NS/- are missing or not-staffed codes, not zero staffing.",
            "Statewide 8-hour and 12-hour rows are comparators, not facilities.",
            "NJDOH staffing is not CMS PBJ and is not attached to ALR/CPCH/ALP/PACE.",
            "First snapshot is baseline-only.",
        ],
    )


def schema_fingerprint(html: str) -> str:
    headers = re.findall(r"<th[^>]*>(.*?)</th>", html, re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", " ".join(headers))
    text = re.sub(r"\s+", " ", text).strip().lower()
    return hashlib.sha256(text.encode("utf-8")).hexdigest()
