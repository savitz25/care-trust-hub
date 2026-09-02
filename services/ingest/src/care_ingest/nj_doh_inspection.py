"""NJDOH facility inspection/SOD/POC index adapter.

Uses deterministic public GET URLs keyed by FacID. Does not bypass
CAPTCHA, login, or session tokens. Does not copy CMS deficiencies
into the national spine.
"""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import date
from html.parser import HTMLParser
from typing import Any
from urllib.request import Request, urlopen

from .nj_doh_enforcement import (
    USER_AGENT,
    DocumentMatch,
    IdentityRecord,
    ParsedDocument,
    document_fingerprint,
    event_identity,
    parse_index_date,
)

CERT_URL = "https://healthapps.nj.gov/facilities/fsCertDetails.aspx?item={item}"
COMPLAINT_URL = "https://healthapps.nj.gov/facilities/fsCompDetails.aspx?item={item}"
SURVEY_URL = (
    "https://healthapps.nj.gov/facilities/fssurvey.aspx?survey-id={survey_id}&facid={facid}"
)
SAMPLE_FACIDS = (
    "NJ61520",
    "NJ30707",
    "NJ60A000",
    "0L9278",
    "N2K04D",
    "NJ25316",
)


@dataclass(slots=True)
class InspectionIndexRow:
    facid: str
    inspection_kind: str
    inspection_date: date | None
    date_raw: str
    survey_id: str
    survey_url: str
    page_url: str
    http_status: int
    has_captcha: bool
    login_wall: bool


class InspectionTableParser(HTMLParser):
    def __init__(self, *, facid: str, page_url: str, kind: str) -> None:
        super().__init__()
        self.facid = facid
        self.page_url = page_url
        self.kind = kind
        self._in_td = False
        self._cell = ""
        self._href: str | None = None
        self._row: list[tuple[str, str | None]] = []
        self.rows: list[InspectionIndexRow] = []
        self.has_captcha = False
        self.login_wall = False
        self._all_text = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value for key, value in attrs}
        if tag == "tr":
            self._row = []
        if tag == "td":
            self._in_td = True
            self._cell = ""
            self._href = None
        if tag == "a" and self._in_td and attr.get("href"):
            self._href = attr["href"]

    def handle_endtag(self, tag: str) -> None:
        if tag == "td" and self._in_td:
            self._row.append((re.sub(r"\s+", " ", self._cell).strip(), self._href))
            self._in_td = False
        if tag == "tr" and len(self._row) >= 2:
            date_s, _ = self._row[0]
            ident, href = self._row[1]
            if date_s.lower().startswith("routine") or date_s.lower() in {"id", "date"}:
                self._row = []
                return
            if href and "fssurvey.aspx" in href.lower():
                survey_id = ident.replace(".pdf", "")
                survey_url = href
                if survey_url.startswith("/"):
                    survey_url = "https://healthapps.nj.gov" + survey_url
                elif not survey_url.startswith("http"):
                    survey_url = "https://healthapps.nj.gov/facilities/" + survey_url
                self.rows.append(
                    InspectionIndexRow(
                        facid=self.facid,
                        inspection_kind=self.kind,
                        inspection_date=parse_index_date(date_s),
                        date_raw=date_s,
                        survey_id=survey_id,
                        survey_url=survey_url,
                        page_url=self.page_url,
                        http_status=200,
                        has_captcha=False,
                        login_wall=False,
                    )
                )
            self._row = []

    def handle_data(self, data: str) -> None:
        self._all_text += data
        if self._in_td:
            self._cell += data
        lowered = data.lower()
        if "captcha" in lowered or "recaptcha" in lowered:
            self.has_captcha = True
        if "sign in" in lowered or "log in" in lowered:
            self.login_wall = True


def fetch_html(url: str, timeout: float = 45) -> tuple[int, str, bool, bool]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        status = int(response.getcode() or 0)
        body = response.read().decode("utf-8", errors="replace")
    captcha = bool(re.search(r"captcha|recaptcha", body, re.I))
    login = bool(re.search(r"please (sign|log) in|login required", body, re.I))
    return status, body, captcha, login


def parse_inspection_page(
    html: str, *, facid: str, page_url: str, kind: str
) -> list[InspectionIndexRow]:
    parser = InspectionTableParser(facid=facid, page_url=page_url, kind=kind)
    parser.feed(html)
    for row in parser.rows:
        row.has_captcha = parser.has_captcha
        row.login_wall = parser.login_wall
    return parser.rows


def classify_evidence_track(html: str) -> str:
    if re.search(r"FORM CMS-2567|CENTERS FOR MEDICARE & MEDICAID SERVICES", html, re.I):
        return "CMS_FORM"
    if re.search(r"New Jersey Department of Health", html, re.I):
        return "STATE_FORM"
    return "UNKNOWN"


def inspection_documents(
    rows: list[InspectionIndexRow],
    identities: list[IdentityRecord],
) -> list[ParsedDocument]:
    documents: list[ParsedDocument] = []
    by_id = {item.source_facility_id: item for item in identities}
    for row in rows:
        facid = re.sub(r"[^A-Za-z0-9]", "", row.facid).upper()
        identity = by_id.get(facid)
        if identity is None:
            match = DocumentMatch(
                "UNRESOLVED", "facid", "Inspection FacID is not in the identity spine", None, 0
            )
        else:
            match = DocumentMatch(
                "EXACT",
                "facid",
                "Source record supplies the document and facility identifier",
                facid,
                1,
            )
        canonical = (
            "COMPLAINT_INSPECTION" if row.inspection_kind == "complaint" else "ROUTINE_INSPECTION"
        )
        source_id = f"{row.facid}|{row.survey_id}|{row.inspection_kind}"
        fingerprint = document_fingerprint(
            source_document_id=source_id,
            source_document_url=row.survey_url,
            document_date=row.inspection_date,
            facility_name=row.facid,
            action=canonical,
            content_sha256=None,
        )
        documents.append(
            ParsedDocument(
                source_document_id=source_id,
                source_document_url=row.survey_url,
                document_title=f"{row.inspection_kind} inspection {row.survey_id}",
                document_kind="inspection_index",
                printed_facility_name=None,
                printed_license_number=None,
                printed_source_facility_id=facid,
                printed_street=None,
                printed_city=None,
                printed_county=None,
                printed_zip=None,
                document_date=row.inspection_date,
                effective_date=None,
                end_date=None,
                remedy_type_raw=row.inspection_kind,
                remedy_type_canonical=canonical,
                penalty_amount_cents=None,
                admission_curtailment=None,
                admission_curtailment_start=None,
                admission_curtailment_end=None,
                conditional_license=None,
                conditional_license_start=None,
                conditional_license_end=None,
                legal_citation=None,
                content_sha256=None,
                file_size_bytes=None,
                page_count=None,
                text_extraction_status="not_applicable",
                document_fingerprint=fingerprint,
                extraction_confidence="high" if match.bucket == "EXACT" else "none",
                status_raw="unknown",
                is_final=None,
                evidence_track="UNKNOWN",
                event_identity=event_identity(source_id, row.inspection_date, fingerprint),
                match=match,
                year_section=None,
                raw={
                    "page_url": row.page_url,
                    "date_raw": row.date_raw,
                    "http_status": row.http_status,
                },
            )
        )
    return documents


def probe_inspection_sample(
    facids: list[str] | None = None,
    *,
    timeout: float = 45,
    identities: list[IdentityRecord] | None = None,
) -> tuple[dict[str, Any], list[ParsedDocument]]:
    selected = facids or list(SAMPLE_FACIDS)
    pages: list[dict[str, Any]] = []
    rows: list[InspectionIndexRow] = []
    blocked = False
    blocker = None
    for facid in selected:
        for kind, template in (("routine", CERT_URL), ("complaint", COMPLAINT_URL)):
            url = template.format(item=facid)
            record: dict[str, Any] = {"facid": facid, "kind": kind, "url": url}
            try:
                status, html, captcha, login = fetch_html(url, timeout=timeout)
            except Exception as exc:  # noqa: BLE001
                blocked = True
                blocker = f"{url}: {exc}"
                record["error"] = str(exc)
                pages.append(record)
                continue
            record.update(
                {
                    "http_status": status,
                    "bytes": len(html.encode("utf-8")),
                    "sha256": hashlib.sha256(html.encode("utf-8")).hexdigest(),
                    "has_captcha": captcha,
                    "login_wall": login,
                    "has_survey_link": "fssurvey.aspx" in html.lower(),
                }
            )
            if captcha or login or status in {401, 403}:
                blocked = True
                blocker = f"{url} http={status} captcha={captcha} login={login}"
            parsed = parse_inspection_page(html, facid=facid, page_url=url, kind=kind)
            record["survey_count"] = len(parsed)
            record["survey_ids"] = [item.survey_id for item in parsed]
            rows.extend(parsed)
            pages.append(record)
    documents = inspection_documents(rows, identities or [])
    fields_found = [
        "facid",
        "inspection_kind",
        "inspection_date",
        "survey_id",
        "sod_url",
    ]
    supported = (not blocked) and any(page.get("has_survey_link") for page in pages)
    gate = {
        "supported": supported,
        "blocker": blocker,
        "fields_found": fields_found if supported else [],
        "fields_not_on_index": [
            "deficiency_count",
            "maximum_scope_severity",
            "separate_poc_url",
            "state_only_vs_cms_until_sod_fetched",
        ],
        "sample_facids": selected,
        "pages": pages,
        "inspection_rows": len(rows),
        "documents": len(documents),
        "notes": [
            "Per-facility GET of fsCertDetails.aspx and fsCompDetails.aspx is public and FacID-keyed.",
            "SOD/POC is the same CMS-2567-style page at fssurvey.aspx; there is no separate POC URL.",
            "CMS-form SOD content is not copied into national deficiency_finding.",
            "Bulk harvest of every FacID is available via the same adapter; this gate uses a documented sample.",
        ],
    }
    return gate, documents


def parse_inspection_html_fixture(
    html: str, facid: str, kind: str = "routine"
) -> list[InspectionIndexRow]:
    return parse_inspection_page(
        html,
        facid=facid,
        page_url=CERT_URL.format(item=facid),
        kind=kind,
    )
