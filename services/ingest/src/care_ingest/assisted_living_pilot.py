"""Pilot-state assisted-living adapters. Separate from CMS SNF identity."""

from __future__ import annotations

import csv
import hashlib
import io
import json
import re
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen
from xml.etree import ElementTree

ADAPTER_VERSION = "assisted-living-adapter-v1"
NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

CA_RCFE_URL = (
    "https://data.chhs.ca.gov/dataset/46ffcbdf-4874-4cc1-92c2-fb715e3ad014/"
    "resource/744d1583-f9eb-45b6-b0f8-b9a9dab936a6/download/tmpacjmwy9v.csv"
)
NY_HFIS_URL = "https://health.data.ny.gov/resource/vn5v-hh5r.json"
NY_CERT_URL = "https://health.data.ny.gov/resource/2g9y-7kqm.json"
TX_ALF_URL = "https://apps.hhs.texas.gov/providers/directories/al.xlsx"

NY_ACF_DESCRIPTIONS = frozenset({"Adult Home", "Enriched Housing Program"})
NY_MEMORY_ATTRIBUTES = frozenset(
    {
        "Special Needs Assisted Living Residence (SNALR)",
        "Dementia",
    }
)

RESOLUTION_VERIFIED = "VERIFIED"
RESOLUTION_REVIEW = "REVIEW_REQUIRED"
RESOLUTION_UNRESOLVED = "UNRESOLVED"


def _text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _upper_id(value: object | None) -> str | None:
    text = _text(value)
    if not text:
        return None
    return re.sub(r"\s+", "", text).upper()


def _int(value: object | None) -> int | None:
    text = _text(value)
    if not text:
        return None
    try:
        return int(float(text.replace(",", "")))
    except ValueError:
        return None


def _zip(value: object | None) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[:5] if len(digits) >= 5 else None


def _fingerprint(*parts: str) -> str:
    return hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()


def assisted_living_key(state: str, regulator: str, facility_id: str) -> str:
    ident = _upper_id(facility_id)
    if not ident:
        raise ValueError("source facility ID is required")
    return f"{state}:{regulator}:{ident}"


def resolve_identity(
    state: str | None,
    regulator: str | None,
    facility_id: str | None,
    name: str | None,
    license_id: str | None = None,
) -> tuple[str, str, str | None]:
    if not state or not regulator:
        return RESOLUTION_UNRESOLVED, "Missing issuing state or regulator.", None
    if not _upper_id(facility_id) and not _upper_id(license_id):
        if name:
            return (
                RESOLUTION_REVIEW,
                "Name without a state facility or license ID is not a publishable identity.",
                None,
            )
        return RESOLUTION_UNRESOLVED, "No authoritative state identifier.", None
    if not _upper_id(facility_id):
        return (
            RESOLUTION_REVIEW,
            "License ID is present but the source facility ID is missing.",
            None,
        )
    key = assisted_living_key(state, regulator, facility_id or "")
    if not name:
        return RESOLUTION_REVIEW, "Authoritative ID without an official name needs review.", key
    return (
        RESOLUTION_VERIFIED,
        "State, regulator, official facility ID, and official name are present.",
        key,
    )


def classify_memory(
    *,
    explicit: str | None = None,
    special_unit: bool | None = None,
    endorsement: str | None = None,
    facility_name: str | None = None,
) -> str:
    if _text(explicit):
        return "explicit_memory_or_dementia_license"
    if special_unit is True:
        return "secured_or_special_care_unit"
    if _text(endorsement):
        return "specialty_endorsement"
    if facility_name and re.search(
        r"\b(memory|dementia|alzheimer|alzheimer's)\b", facility_name, re.I
    ):
        return "not_reported"
    if special_unit is False:
        return "general_assisted_living_only"
    return "not_reported"


def consumer_category(official_type: str, memory: str) -> str:
    if memory == "explicit_memory_or_dementia_license":
        return "memory_supportive"
    lowered = official_type.lower()
    if "personal care home" in lowered:
        return "personal_care_home"
    if "adult care home" in lowered or "adult home" in lowered:
        return "adult_care_home"
    if "residential care" in lowered or "enriched housing" in lowered or lowered.startswith("rcfe"):
        return "residential_care"
    return "assisted_living"


def publication_eligible(record: dict[str, Any]) -> bool:
    if record.get("identity_state") != RESOLUTION_VERIFIED:
        return False
    if not record.get("official_name") or not record.get("consumer_category"):
        return False
    if not record.get("retrieved_at"):
        return False
    has_place = bool(record.get("official_street")) and (
        bool(record.get("official_city")) or bool(record.get("official_zip"))
    )
    return has_place


@dataclass
class IngestResult:
    state: str
    raw_rows: int
    records: list[dict[str, Any]] = field(default_factory=list)

    def coverage(self) -> dict[str, Any]:
        records = self.records
        identities = Counter(item["identity_state"] for item in records)
        memory = Counter(item["memory_designation"] for item in records)
        statuses = Counter((item.get("license_status") or "missing") for item in records)
        return {
            "state": self.state,
            "raw_source_records": self.raw_rows,
            "canonical_providers": len(records),
            "verified": identities.get(RESOLUTION_VERIFIED, 0),
            "review_required": identities.get(RESOLUTION_REVIEW, 0),
            "unresolved": identities.get(RESOLUTION_UNRESOLVED, 0),
            "active": sum(
                1
                for item in records
                if (item.get("license_status") or "").upper()
                in {"LICENSED", "ACTIVE", "YES", "OPEN"}
            ),
            "closed_or_inactive": sum(
                1
                for item in records
                if (item.get("license_status") or "").upper()
                in {"CLOSED", "INACTIVE", "EXPIRED", "SUSPENDED"}
            ),
            "licenses": sum(1 for item in records if item.get("license_id")),
            "capacities": sum(1 for item in records if item.get("licensed_capacity") is not None),
            "licensees": sum(1 for item in records if item.get("licensee")),
            "operators": sum(1 for item in records if item.get("operator")),
            "administrators": sum(1 for item in records if item.get("administrator")),
            "management_companies": sum(1 for item in records if item.get("management_company")),
            "owners": sum(1 for item in records if item.get("owner")),
            "explicit_memory": memory.get("explicit_memory_or_dementia_license", 0)
            + memory.get("specialty_endorsement", 0)
            + memory.get("secured_or_special_care_unit", 0),
            "memory_designations": dict(memory),
            "status_values": dict(statuses),
            "publication_eligible": sum(1 for item in records if publication_eligible(item)),
            "inspection_enforcement_events": sum(len(item.get("events") or []) for item in records),
        }


def parse_california_rcfe(text: str, *, retrieved_at: str) -> IngestResult:
    reader = csv.DictReader(io.StringIO(text))
    rows = list(reader)
    by_id: dict[str, dict[str, Any]] = {}
    extras: list[dict[str, Any]] = []
    for row in rows:
        facility_id = _upper_id(row.get("facility_number"))
        name = _text(row.get("facility_name"))
        official_type = (
            _text(row.get("facility_type")) or "Residential Care Facility for the Elderly"
        )
        identity, reason, key = resolve_identity("CA", "CA_CDSS_CCL", facility_id, name)
        memory = classify_memory(facility_name=name)
        record = {
            "state_code": "CA",
            "regulator_code": "CA_CDSS_CCL",
            "regulator_name": (
                "California Department of Social Services, Community Care Licensing Division"
            ),
            "source_facility_id": facility_id,
            "license_id": facility_id,
            "external_key": key,
            "identity_state": identity,
            "identity_reason": reason,
            "official_name": name,
            "official_street": _text(row.get("facility_address")),
            "official_city": _text(row.get("facility_city")),
            "official_zip": _zip(row.get("facility_zip")),
            "phone": _text(row.get("facility_telephone_number")),
            "official_type": official_type,
            "consumer_category": consumer_category(official_type, memory),
            "license_status": _text(row.get("facility_status")),
            "licensed_capacity": _int(row.get("facility_capacity")),
            "licensee": _text(row.get("licensee")),
            "operator": None,
            "management_company": None,
            "administrator": _text(row.get("facility_administrator")),
            "owner": None,
            "memory_designation": memory,
            "effective_date": _text(row.get("license_first_date")),
            "source_locator": "chhs:ccl-facilities:rcfe",
            "retrieved_at": retrieved_at,
            "source_fingerprint": _fingerprint(facility_id or "", name or "", official_type),
            "events": [],
        }
        if facility_id:
            by_id[facility_id] = record
        else:
            extras.append(record)
    return IngestResult(state="CA", raw_rows=len(rows), records=[*by_id.values(), *extras])


def parse_new_york_acf(
    general: list[dict[str, Any]],
    certifications: list[dict[str, Any]],
    *,
    retrieved_at: str,
) -> IngestResult:
    certs_by_id: dict[str, list[dict[str, Any]]] = {}
    for row in certifications:
        fac_id = _upper_id(row.get("fac_id"))
        if not fac_id:
            continue
        certs_by_id.setdefault(fac_id, []).append(row)
    acf_rows = [row for row in general if _text(row.get("description")) in NY_ACF_DESCRIPTIONS]
    records: list[dict[str, Any]] = []
    for row in acf_rows:
        facility_id = _upper_id(row.get("fac_id"))
        name = _text(row.get("facility_name"))
        official_type = _text(row.get("description")) or "Adult Care Facility"
        certs = certs_by_id.get(facility_id or "", [])
        memory_attr = next(
            (
                _text(item.get("attribute_value"))
                for item in certs
                if _text(item.get("attribute_value")) in NY_MEMORY_ATTRIBUTES
            ),
            None,
        )
        memory = classify_memory(explicit=memory_attr, facility_name=name)
        identity, reason, key = resolve_identity(
            "NY",
            "NY_DOH_ACF",
            facility_id,
            name,
            _text(row.get("opcert_num")),
        )
        records.append(
            {
                "state_code": "NY",
                "regulator_code": "NY_DOH_ACF",
                "regulator_name": "New York State Department of Health",
                "source_facility_id": facility_id,
                "license_id": _text(row.get("opcert_num")),
                "external_key": key,
                "identity_state": identity,
                "identity_reason": reason,
                "official_name": name,
                "official_street": _text(row.get("address1")),
                "official_city": _text(row.get("city")),
                "official_zip": _zip(row.get("fac_zip")),
                "phone": _text(row.get("fac_phone")),
                "official_type": official_type,
                "consumer_category": consumer_category(official_type, memory),
                "license_status": None,
                "licensed_capacity": _int(
                    next(
                        (
                            item.get("measure_value")
                            for item in certs
                            if _text(item.get("attribute_value")) == "Overall Capacity (AH/EHP)"
                        ),
                        None,
                    )
                ),
                "licensee": None,
                "operator": _text(row.get("operator_name")),
                "management_company": None,
                "administrator": None,
                "owner": None,
                "memory_designation": memory,
                "effective_date": _text(row.get("fac_opn_dat")),
                "source_locator": f"health.data.ny.gov:vn5v-hh5r:{facility_id}",
                "retrieved_at": retrieved_at,
                "source_fingerprint": _fingerprint(facility_id or "", name or "", official_type),
                "events": [],
            }
        )
    return IngestResult(state="NY", raw_rows=len(acf_rows), records=records)


def _xlsx_rows(payload: bytes) -> list[list[str | None]]:
    archive = zipfile.ZipFile(io.BytesIO(payload))
    strings: list[str] = []
    if "xl/sharedStrings.xml" in archive.namelist():
        root = ElementTree.fromstring(archive.read("xl/sharedStrings.xml"))
        for item in root:
            strings.append(
                "".join(
                    node.text or ""
                    for node in item.iter(
                        "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t"
                    )
                )
            )
    sheet = ElementTree.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    rows: list[list[str | None]] = []
    for row in sheet.findall("m:sheetData/m:row", NS):
        cells: dict[int, str | None] = {}
        for cell in row.findall("m:c", NS):
            ref = cell.get("r") or "A"
            col = 0
            for char in ref:
                if char.isalpha():
                    col = col * 26 + (ord(char.upper()) - 64)
            value_node = cell.find("m:v", NS)
            if value_node is None or value_node.text is None:
                cells[col - 1] = None
                continue
            if cell.get("t") == "s":
                cells[col - 1] = strings[int(value_node.text)]
            else:
                cells[col - 1] = value_node.text
        width = max(cells) + 1 if cells else 0
        rows.append([cells.get(index) for index in range(width)])
    return rows


def parse_texas_records(rows: list[dict[str, Any]], *, retrieved_at: str) -> IngestResult:
    records: list[dict[str, Any]] = []
    for row in rows:
        facility_id = _upper_id(row.get("Facility ID"))
        name = _text(row.get("Facility Name"))
        service = _text(row.get("Service Type")) or "Assisted Living Facility"
        official_type = f"Assisted Living Facility {service}".strip()
        certificate = _text(row.get("Alzheimer Certificate No"))
        memory = classify_memory(endorsement=certificate, facility_name=name)
        identity, reason, key = resolve_identity(
            "TX",
            "TX_HHSC_ALF",
            facility_id,
            name,
            _text(row.get("License No")),
        )
        licensed_flag = (_text(row.get("Facility Licensed")) or "").upper()
        records.append(
            {
                "state_code": "TX",
                "regulator_code": "TX_HHSC_ALF",
                "regulator_name": "Texas Health and Human Services Commission",
                "source_facility_id": facility_id,
                "license_id": _text(row.get("License No")),
                "external_key": key,
                "identity_state": identity,
                "identity_reason": reason,
                "official_name": name,
                "official_street": _text(row.get("Physical Address")),
                "official_city": _text(row.get("Physical Address CITY")),
                "official_zip": _zip(row.get("Physical Address Zipcode")),
                "phone": _text(row.get("Facility Phone Number")),
                "official_type": official_type,
                "consumer_category": consumer_category(official_type, memory),
                "license_status": "LICENSED" if licensed_flag == "YES" else licensed_flag or None,
                "licensed_capacity": _int(row.get("Total Licensed Capacity")),
                "licensee": None,
                "operator": None,
                "management_company": _text(row.get("Management Company_")),
                "administrator": _text(row.get("Administrator")),
                "owner": _text(row.get("Owner_")),
                "memory_designation": memory,
                "effective_date": _text(row.get("License Effective Date")),
                "source_locator": "hhsc:al.xlsx",
                "retrieved_at": retrieved_at,
                "source_fingerprint": _fingerprint(facility_id or "", name or "", official_type),
                "events": [],
            }
        )
    unique: dict[str, dict[str, Any]] = {}
    for record in records:
        key = (
            record.get("external_key")
            or record.get("source_facility_id")
            or record["official_name"]
        )
        unique[str(key)] = record
    return IngestResult(state="TX", raw_rows=len(rows), records=list(unique.values()))


def parse_texas_alf(payload: bytes, *, retrieved_at: str) -> IngestResult:
    grid = _xlsx_rows(payload)
    header_index = next(
        (index for index, row in enumerate(grid) if row and row[0] == "Facility Name"),
        None,
    )
    if header_index is None:
        raise ValueError("Texas ALF directory is missing the Facility Name header")
    header = [re.sub(r"\s+", " ", (cell or "")).strip() for cell in grid[header_index]]
    mapped: list[dict[str, Any]] = []
    for values in grid[header_index + 1 :]:
        if not any(values):
            continue
        mapped.append(
            {
                header[index]: values[index] if index < len(values) else None
                for index in range(len(header))
            }
        )
    return parse_texas_records(mapped, retrieved_at=retrieved_at)


def _fetch(url: str, timeout: int = 120) -> bytes:
    request = Request(url, headers={"User-Agent": "SeniorTrustHub-021B/1.0"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - official HTTPS regulators
        return response.read()


def ingest_pilot_states(
    *,
    ca_csv: str | None = None,
    ny_general: list[dict[str, Any]] | None = None,
    ny_certs: list[dict[str, Any]] | None = None,
    tx_xlsx: bytes | None = None,
    tx_rows: list[dict[str, Any]] | None = None,
    retrieved_at: str | None = None,
    live: bool = False,
) -> dict[str, Any]:
    retrieved = retrieved_at or datetime.now(UTC).isoformat()
    if live:
        ca_csv = _fetch(CA_RCFE_URL).decode("utf-8-sig", errors="replace")
        where = "description in('Adult Home','Enriched Housing Program')"
        adult = json.loads(_fetch(f"{NY_HFIS_URL}?$where={where}&$limit=50000"))
        certs = json.loads(_fetch(f"{NY_CERT_URL}?$where={where}&$limit=50000"))
        ny_general = adult
        ny_certs = certs
        tx_xlsx = _fetch(TX_ALF_URL)
    if ca_csv is None or ny_general is None or ny_certs is None:
        raise ValueError("pilot ingest requires CA and NY payloads or live=True")
    if tx_rows is None and tx_xlsx is None:
        raise ValueError("pilot ingest requires Texas rows or workbook")
    texas = (
        parse_texas_records(tx_rows, retrieved_at=retrieved)
        if tx_rows is not None
        else parse_texas_alf(tx_xlsx or b"", retrieved_at=retrieved)
    )
    first = [
        parse_california_rcfe(ca_csv, retrieved_at=retrieved),
        parse_new_york_acf(ny_general, ny_certs, retrieved_at=retrieved),
        texas,
    ]
    second = [
        parse_california_rcfe(ca_csv, retrieved_at=retrieved),
        parse_new_york_acf(ny_general, ny_certs, retrieved_at=retrieved),
        parse_texas_records(tx_rows, retrieved_at=retrieved)
        if tx_rows is not None
        else parse_texas_alf(tx_xlsx or b"", retrieved_at=retrieved),
    ]
    idempotent = all(
        [item.get("external_key") for item in left.records]
        == [item.get("external_key") for item in right.records]
        and len(left.records) == len(right.records)
        for left, right in zip(first, second, strict=True)
    )
    return {
        "adapter_version": ADAPTER_VERSION,
        "retrieved_at": retrieved,
        "google_places_requests": 0,
        "idempotent": idempotent,
        "states": {item.state: item.coverage() for item in first},
        "totals": {
            "canonical_providers": sum(len(item.records) for item in first),
            "publication_eligible": sum(
                1 for item in first for record in item.records if publication_eligible(record)
            ),
        },
        "qa_samples": {
            item.state: [record["external_key"] for record in item.records[:30]] for item in first
        },
        "enforcement_deferred": {
            "CA": "CCLD inspection PDFs/Transparency comments are not a single ID-linked extract.",
            "NY": "Surveillance/enforcement not ingested beyond HFIS identity in this pilot.",
            "TX": "Closures workbook and TULIP surveys deferred; active-license directory only.",
        },
    }


def write_coverage(path: Path, report: dict[str, Any]) -> None:
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
