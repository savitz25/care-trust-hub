"""NJ-SEN-001 NJDOH long-term-care facility identity spine.

Organizes official licensed types. Does not rank facilities.
Does not infer memory care. Does not replace the CMS federal spine.
"""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
import io
import json
import re
import zipfile
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime, timedelta
from typing import Any
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from .state_regulator import CanonicalCmsFacility, normalize_ccn

ADAPTER_VERSION = "nj-doh-ltc-v1"
DATASET_KEY = "nj-doh-all-ltc"
REGULATOR_CODE = "NJ_DOH"
AGENCY = "New Jersey Department of Health"
SOURCE_URL = "https://healthapps.nj.gov/facilities/documents2/All_LTC.xlsx"
LANDING_URL = "https://healthapps.nj.gov/facilities/fssearch.aspx"
ENFORCEMENT_OVERVIEW_URL = "https://www.nj.gov/health/healthfacilities/enforcement_actions.shtml"
PENALTY_LETTERS_URL = (
    "https://www.nj.gov/health/healthfacilities/surveys-insp/enforcement_actions.shtml"
)
REQUIRED_COLUMNS = (
    "FACILITY_TYPE",
    "FacID",
    "LIC#",
    "LICENSED_NAME",
    "ALPHA_NAME",
    "ADDRESS",
    "FAC_CITY",
    "FAC_ST",
    "ZIP",
    "COUNTY",
    "TELEPHONE",
    "ADMIN",
    "LICENSED_OWNER",
    "RunDate",
)

# Official NJDOH values only. Unknown raw values are quarantined, never guessed.
TYPE_MAP: dict[str, tuple[str, bool, str]] = {
    "LONG TERM CARE FACILITY SNF/NF": (
        "NJ_NF_SNF",
        True,
        "Nursing facility / SNF. Not assisted living.",
    ),
    "LONG TERM CARE FACILITY - HOME FOR THE AGED SNF/NF": (
        "NJ_NF_SNF_HOME_FOR_AGED",
        True,
        "Nursing facility / SNF, home for the aged. Not assisted living.",
    ),
    "LONG TERM CARE FACILITY S/NF DP": (
        "NJ_NF_SNF_DP",
        True,
        "Nursing facility S/NF DP. Distinct official subtype.",
    ),
    "HOSPITAL BASED - LONG TERM CARE FACILITY SNF/NF": (
        "NJ_NF_SNF_HOSPITAL",
        True,
        "Hospital-based nursing facility / SNF.",
    ),
    "HOSPITAL BASED - LONG TERM CARE SUB ACUTE FACILITY SNF": (
        "NJ_NF_SNF_SUBACUTE_HOSPITAL",
        True,
        "Hospital-based sub-acute SNF. Distinct official subtype.",
    ),
    "LONG TERM CARE FACILITY": (
        "NJ_LTC_UNSPECIFIED",
        False,
        "Official LTC label without SNF/NF. Do not treat as nursing home.",
    ),
    "LONG TERM CARE FACILITY LTC-PRIV": (
        "NJ_LTC_PRIV",
        False,
        "Official LTC-PRIV label. Not merged into SNF/NF.",
    ),
    "LONG TERM CARE FACILITY - HOME FOR THE AGED LTC-PRIV": (
        "NJ_LTC_PRIV_HOME_FOR_AGED",
        False,
        "Official home-for-the-aged LTC-PRIV. Not SNF/NF.",
    ),
    "ASSISTED LIVING RESIDENCE": (
        "NJ_ALR",
        False,
        "Assisted Living Residence. Not a nursing facility.",
    ),
    "COMPREHENSIVE PERSONAL CARE HOME": (
        "NJ_CPCH",
        False,
        "Comprehensive Personal Care Home. Not ALR and not nursing.",
    ),
    "ASSISTED LIVING PROGRAM": (
        "NJ_ALP",
        False,
        "Assisted Living Program. Not ALR.",
    ),
    "RESIDENTIAL HEALTH CARE in a LONG-TERM CARE FACILITY": (
        "NJ_RHCF_IN_LTC",
        False,
        "Residential Health Care inside an LTC. Not the host nursing license.",
    ),
    "RESIDENTIAL DEMENTIA CARE HOME": (
        "NJ_RDCH",
        False,
        "Official NJDOH Residential Dementia Care Home. Not an inferred memory-care license.",
    ),
    "ADULT DAY HEALTH SERVICES FACILITY": (
        "NJ_ADHS",
        False,
        "Adult Day Health Services. Not nursing or assisted living.",
    ),
    "PEDIATRIC DAY HEALTH SERVICES FACILITY": (
        "NJ_PDHS",
        False,
        "Pediatric Day Health Services. Distinct from adult day.",
    ),
    "ADULT DAY HEALTH SERVICES in a LONG-TERM CARE FACILITY": (
        "NJ_ADHS_IN_LTC",
        False,
        "Adult day co-located in LTC. Separate license from the host LTC.",
    ),
    "HOSPITAL BASED - ADULT DAY HEALTH SERVICES": (
        "NJ_ADHS_HOSPITAL",
        False,
        "Hospital-based adult day. Not nursing.",
    ),
    "ADULT DAY HEALTH SERVICES in an ASSISTED LIVING RESIDENCE": (
        "NJ_ADHS_IN_ALR",
        False,
        "Adult day co-located in ALR. Separate license.",
    ),
    "ALTERNATE FAMILY CARE": (
        "NJ_AFC",
        False,
        "Alternate Family Care. Not adult day and not nursing.",
    ),
}


class NjDohSchemaError(ValueError):
    """Workbook columns drifted from the locked NJ-SEN-001 contract."""


@dataclass(frozen=True, slots=True)
class NjDohFacilityRow:
    source_facility_id: str
    license_number: str
    official_name: str
    alpha_name: str | None
    facility_type_raw: str
    facility_type_canonical: str | None
    cms_nursing_eligible: bool
    street: str | None
    city: str | None
    county: str | None
    state: str | None
    zip_code: str | None
    phone: str | None
    email: str | None
    license_expires_on: date | None
    licensed_beds_slots: int | None
    administrator: str | None
    licensed_owner: str | None
    owner_address: str | None
    owner_entity_type_raw: str | None
    run_date: date | None
    source_record_identifier: str
    record_fingerprint: str
    raw: dict[str, str]


@dataclass(slots=True)
class NjMatch:
    bucket: str
    method: str
    reason: str
    cms_ccn: str | None = None
    candidate_count: int = 0


@dataclass(slots=True)
class NjIngestReport:
    adapter_version: str
    dataset_key: str
    source_url: str
    retrieved_at: str
    source_as_of: str | None
    content_sha256: str
    schema_fingerprint: str
    worksheet_names: list[str]
    source_rows: int
    distinct_source_facility_ids: int
    distinct_license_numbers: int
    rows_by_raw_type: dict[str, int]
    rows_by_canonical_type: dict[str, int]
    unknown_types: dict[str, int]
    quarantined_rows: int
    exact: int
    high_confidence: int
    review_required: int
    conflicts: int
    unresolved: int
    unsafe_rejected: int
    net_new: int
    updated: int
    unchanged: int
    existing_enriched: int
    duplicate_licenses: int
    missing_county: int
    missing_address: int
    missing_license: int
    baseline_only: bool
    dry_run: bool
    mode: str
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def normalize_license_number(value: object | None) -> str | None:
    text = re.sub(r"[^A-Za-z0-9]", "", str(value or "")).upper()
    return text or None


def normalize_address(value: object | None) -> str:
    first = str(value or "").split("\n", 1)[0]
    cleaned = re.sub(r"\.", "", first.lower())
    cleaned = re.sub(
        r"\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|suite|ste|unit)\b",
        " ",
        cleaned,
    )
    return re.sub(r"[^a-z0-9]+", " ", cleaned).strip()


def normalize_name(value: object | None) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())
    cleaned = re.sub(r"\b(llc|inc|corp|co|ltd|the|facility)\b", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def normalize_phone(value: object | None) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    return digits if len(digits) == 10 else None


def excel_serial_date(value: object | None) -> date | None:
    if value is None or str(value).strip() == "":
        return None
    try:
        serial = float(str(value).strip())
    except ValueError:
        text = str(value).strip()
        for fmt in ("%Y-%m-%d", "%m/%d/%Y"):
            try:
                return datetime.strptime(text[:10], fmt).date()
            except ValueError:
                continue
        return None
    if serial < 20000 or serial > 80000:
        return None
    return (datetime(1899, 12, 30) + timedelta(days=serial)).date()


def _int(value: object | None) -> int | None:
    text = str(value or "").strip()
    if not text or text.lower() in {"(blank)", "n/a"}:
        return None
    try:
        number = int(float(text.replace(",", "")))
    except ValueError:
        return None
    return number if number >= 0 else None


def _text(value: object | None) -> str | None:
    text = str(value or "").strip()
    if not text or text.lower() in {"(blank)", "n/a"}:
        return None
    return text


def schema_fingerprint(columns: list[str]) -> str:
    payload = json.dumps(columns, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def map_facility_type(raw: str) -> tuple[str, bool, str] | None:
    return TYPE_MAP.get(raw.strip())


def record_fingerprint(row: dict[str, str]) -> str:
    material = json.dumps(row, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def parse_xlsx(
    payload: bytes, required: tuple[str, ...] | None = None
) -> tuple[list[str], list[dict[str, str]], list[str]]:
    namespace = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        workbook = ElementTree.fromstring(archive.read("xl/workbook.xml"))
        sheet_names = [
            sheet.attrib.get("name") or "Sheet"
            for sheet in workbook.findall("m:sheets/m:sheet", namespace)
        ]
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", namespace):
                shared.append("".join(node.text or "" for node in item.iter() if node.text))
        sheet_name = next(
            name
            for name in archive.namelist()
            if name.startswith("xl/worksheets/sheet") and name.endswith(".xml")
        )
        sheet = ElementTree.fromstring(archive.read(sheet_name))

    def column_index(ref: str) -> int:
        letters = re.match(r"[A-Z]+", ref)
        if not letters:
            return 0
        number = 0
        for char in letters.group():
            number = number * 26 + ord(char) - 64
        return number - 1

    def cell_value(cell: ElementTree.Element) -> str:
        kind = cell.attrib.get("t")
        node = cell.find("m:v", namespace)
        if node is None or node.text is None:
            return ""
        if kind == "s":
            return shared[int(node.text)]
        return node.text

    matrix: list[list[str]] = []
    for row in sheet.findall("m:sheetData/m:row", namespace):
        values: list[str] = []
        for cell in row.findall("m:c", namespace):
            index = column_index(cell.attrib.get("r", "A1"))
            while len(values) <= index:
                values.append("")
            values[index] = cell_value(cell)
        matrix.append(values)
    if not matrix:
        raise NjDohSchemaError("NJDOH workbook has no rows")
    headers = [str(item).strip() for item in matrix[0]]
    missing = [name for name in (required or REQUIRED_COLUMNS) if name not in headers]
    if missing:
        raise NjDohSchemaError(
            "NJDOH workbook schema drifted; missing columns: " + ", ".join(missing)
        )
    records: list[dict[str, str]] = []
    for values in matrix[1:]:
        row = {
            headers[index]: values[index] if index < len(values) else ""
            for index in range(len(headers))
        }
        if any(str(value).strip() for value in row.values()):
            records.append(row)
    return headers, records, sheet_names


def parse_facility_rows(rows: list[dict[str, str]]) -> tuple[list[NjDohFacilityRow], list[dict[str, str]]]:
    parsed: list[NjDohFacilityRow] = []
    quarantined: list[dict[str, str]] = []
    for row in rows:
        raw_type = _text(row.get("FACILITY_TYPE")) or ""
        mapped = map_facility_type(raw_type)
        fac_id = normalize_license_number(row.get("FacID"))
        license = normalize_license_number(row.get("LIC#"))
        name = _text(row.get("LICENSED_NAME"))
        if not fac_id or not license or not name:
            quarantined.append({**row, "_reason": "missing identity fields"})
            continue
        if mapped is None:
            quarantined.append({**row, "_reason": f"unknown facility type: {raw_type}"})
            continue
        canonical, cms_eligible, _note = mapped
        street = _text((row.get("ADDRESS") or "").split("\n", 1)[0])
        parsed.append(
            NjDohFacilityRow(
                source_facility_id=fac_id,
                license_number=license,
                official_name=name,
                alpha_name=_text(row.get("ALPHA_NAME")),
                facility_type_raw=raw_type,
                facility_type_canonical=canonical,
                cms_nursing_eligible=cms_eligible,
                street=street,
                city=_text(row.get("FAC_CITY")),
                county=_text(row.get("COUNTY")),
                state=_text(row.get("FAC_ST")),
                zip_code=re.sub(r"\D", "", str(row.get("ZIP") or ""))[:5] or None,
                phone=normalize_phone(row.get("TELEPHONE")),
                email=_text(row.get("FACEMAIL")),
                license_expires_on=excel_serial_date(row.get("Lic_Expires")),
                licensed_beds_slots=_int(row.get("Lic_Beds_Slots")),
                administrator=_text(row.get("ADMIN")),
                licensed_owner=_text(row.get("LICENSED_OWNER")),
                owner_address=_text(row.get("OWNADDR")),
                owner_entity_type_raw=_text(row.get("OWNDESC")),
                run_date=excel_serial_date(row.get("RunDate")),
                source_record_identifier=fac_id,
                record_fingerprint=record_fingerprint({key: str(row.get(key) or "") for key in sorted(row)}),
                raw={key: str(row.get(key) or "") for key in row},
            )
        )
    return parsed, quarantined


def match_cms(row: NjDohFacilityRow, universe: list[CanonicalCmsFacility]) -> NjMatch:
    in_state = [item for item in universe if item.state.upper() == "NJ"]
    published_ccn = normalize_ccn(row.raw.get("CCN") or row.raw.get("CMS_CCN") or row.raw.get("Medicare"))
    if published_ccn:
        exact = [item for item in in_state if item.cms_ccn == published_ccn]
        if len(exact) == 1:
            return NjMatch("EXACT", "source_ccn", "NJDOH published a CCN present in the CMS universe", published_ccn, 1)
        if len(exact) > 1:
            return NjMatch("CONFLICT", "source_ccn", "Published CCN matched more than one CMS facility", None, len(exact))
        return NjMatch("UNRESOLVED", "source_ccn", "Published CCN is not in the current CMS universe", published_ccn, 0)

    if not row.cms_nursing_eligible:
        return NjMatch(
            "UNRESOLVED",
            "non_cms_class",
            "Official NJDOH type is not a CMS nursing-home class; federal certification is not attached",
            None,
            0,
        )

    name = normalize_name(row.official_name)
    address = normalize_address(row.street)
    phone = row.phone
    name_hits = [item for item in in_state if name and normalize_name(item.name) == name]
    if name_hits and not address:
        return NjMatch("UNSAFE_REJECTED", "name_only", "Name-only matching is never auto-attached", None, len(name_hits))

    high: list[CanonicalCmsFacility] = []
    review: list[CanonicalCmsFacility] = []
    for item in in_state:
        matched: list[str] = []
        if name and normalize_name(item.name) == name:
            matched.append("name")
        if address and normalize_address(item.address) == address:
            matched.append("address")
        if row.city and normalize_name(row.city) == normalize_name(item.city):
            matched.append("city")
        if row.zip_code and (item.zip_code or "")[:5] == row.zip_code:
            matched.append("zip")
        item_phone = normalize_phone(item.phone)
        if phone and item_phone and phone == item_phone:
            matched.append("phone")
        if "name" in matched and "address" in matched:
            high.append(item)
        elif "address" in matched and "phone" in matched:
            high.append(item)
        elif "name" in matched and "city" in matched and "address" not in matched:
            review.append(item)
        elif "address" in matched:
            review.append(item)

    unique_high = {item.cms_ccn: item for item in high}
    if len(unique_high) == 1:
        cms = next(iter(unique_high.values()))
        return NjMatch(
            "HIGH_CONFIDENCE",
            "name_address_or_address_phone",
            "Exact normalized name+address or unique address+telephone within CMS nursing class",
            cms.cms_ccn,
            1,
        )
    if len(unique_high) > 1:
        return NjMatch(
            "CONFLICT",
            "name_address_or_address_phone",
            "Multiple CMS nursing facilities satisfy the same high-confidence evidence",
            None,
            len(unique_high),
        )
    unique_review = {item.cms_ccn: item for item in review}
    if unique_review:
        return NjMatch(
            "REVIEW_REQUIRED",
            "partial_overlap",
            "Name+city or shared campus address is not sufficient to auto-attach CMS identity",
            None,
            len(unique_review),
        )
    return NjMatch("UNRESOLVED", "no_overlap", "No overlapping CMS nursing-home identity evidence", None, 0)


def identity_state_for(match: NjMatch) -> str:
    if match.bucket == "EXACT":
        return "VERIFIED"
    if match.bucket == "HIGH_CONFIDENCE":
        return "PROBABLE"
    if match.bucket in {"REVIEW_REQUIRED", "CONFLICT"}:
        return "REVIEW_REQUIRED"
    if match.bucket == "UNSAFE_REJECTED":
        return "REJECTED"
    return "UNRESOLVED"


def fetch_official_workbook(timeout: float = 120) -> bytes:
    request = Request(SOURCE_URL, headers={"User-Agent": "SeniorTrustHub/NJ-SEN-001 (research ingest)"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - official HTTPS
        return response.read()


def inspect_payload(payload: bytes, retrieved_at: datetime | None = None) -> dict[str, Any]:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    headers, rows, sheets = parse_xlsx(payload)
    parsed, quarantined = parse_facility_rows(rows)
    run_dates = sorted({item.run_date.isoformat() for item in parsed if item.run_date})
    return {
        "source_url": SOURCE_URL,
        "retrieved_at": retrieved.isoformat(),
        "source_as_of": run_dates[0] if len(run_dates) == 1 else None,
        "run_dates": run_dates,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "bytes": len(payload),
        "worksheet_names": sheets,
        "columns": headers,
        "schema_fingerprint": schema_fingerprint(headers),
        "source_rows": len(rows),
        "parsed_rows": len(parsed),
        "quarantined_rows": len(quarantined),
        "distinct_source_facility_ids": len({item.source_facility_id for item in parsed}),
        "distinct_license_numbers": len({item.license_number for item in parsed}),
        "rows_by_raw_type": dict(Counter(item.facility_type_raw for item in parsed)),
        "rows_by_canonical_type": dict(Counter(item.facility_type_canonical for item in parsed)),
        "unknown_types": dict(Counter(item.get("FACILITY_TYPE", "") for item in quarantined)),
        "counties": sorted({item.county or "" for item in parsed if item.county}),
        "adapter_version": ADAPTER_VERSION,
    }


def build_report(
    parsed: list[NjDohFacilityRow],
    quarantined: list[dict[str, str]],
    matches: list[NjMatch],
    *,
    payload_hash: str,
    schema_fp: str,
    sheets: list[str],
    retrieved_at: datetime,
    dry_run: bool,
    net_new: int = 0,
    updated: int = 0,
    unchanged: int = 0,
    existing_enriched: int = 0,
) -> NjIngestReport:
    buckets = Counter(item.bucket for item in matches)
    return NjIngestReport(
        adapter_version=ADAPTER_VERSION,
        dataset_key=DATASET_KEY,
        source_url=SOURCE_URL,
        retrieved_at=retrieved_at.isoformat(),
        source_as_of=next((item.run_date.isoformat() for item in parsed if item.run_date), None),
        content_sha256=payload_hash,
        schema_fingerprint=schema_fp,
        worksheet_names=sheets,
        source_rows=len(parsed) + len(quarantined),
        distinct_source_facility_ids=len({item.source_facility_id for item in parsed}),
        distinct_license_numbers=len({item.license_number for item in parsed}),
        rows_by_raw_type=dict(Counter(item.facility_type_raw for item in parsed)),
        rows_by_canonical_type=dict(Counter(item.facility_type_canonical or "" for item in parsed)),
        unknown_types=dict(
            Counter(str(item.get("FACILITY_TYPE") or "") for item in quarantined if item.get("_reason", "").startswith("unknown"))
        ),
        quarantined_rows=len(quarantined),
        exact=buckets.get("EXACT", 0),
        high_confidence=buckets.get("HIGH_CONFIDENCE", 0),
        review_required=buckets.get("REVIEW_REQUIRED", 0),
        conflicts=buckets.get("CONFLICT", 0),
        unresolved=buckets.get("UNRESOLVED", 0),
        unsafe_rejected=buckets.get("UNSAFE_REJECTED", 0),
        net_new=net_new,
        updated=updated,
        unchanged=unchanged,
        existing_enriched=existing_enriched,
        duplicate_licenses=max(0, len(parsed) - len({item.license_number for item in parsed})),
        missing_county=sum(1 for item in parsed if not item.county),
        missing_address=sum(1 for item in parsed if not item.street),
        missing_license=sum(1 for item in parsed if not item.license_number),
        baseline_only=True,
        dry_run=dry_run,
        mode="dry-run" if dry_run else "execute",
        notes=[
            "First snapshot is baseline-only; no historical alerts are generated.",
            "public_eligible remains false. No /new-jersey page or sitemap changes.",
            "Workbook does not include home health, hospice, PACE, or CCRC licenses.",
            "Workbook does not publish CMS CCN, officers, or inspection/SOD links.",
            "Detail-page acquisition is deferred to NJ-SEN-002 if CAPTCHA/session-bound.",
        ],
    )
