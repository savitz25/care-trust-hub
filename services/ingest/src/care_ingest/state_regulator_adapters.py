"""Production CA / NY / TX state-regulator parsers. No TULIP or PDF ingestion."""

from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from datetime import date, datetime
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

from .state_regulator import (
    ADAPTER_VERSION,
    StateLicenseRecord,
    StateRegulatorSource,
    get_state_regulator_source,
    normalize_ccn,
    observations_from_license_record,
    resolve_against_canonical_cms,
)

CA_SNF_TYPES = frozenset({"SNF"})
NY_SNF_DESCRIPTIONS = frozenset(
    {
        "Residential Health Care Facility - SNF",
        "NH",
        "Residential Health Care Facility – SNF",
    }
)
REQUIRED_CA_COLUMNS = frozenset({"FACID", "FACNAME", "FAC_TYPE_CODE", "ADDRESS", "CITY"})


def _text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _zip(value: object | None) -> str | None:
    digits = re.sub(r"\D", "", str(value or ""))
    return digits[:5] if len(digits) >= 5 else None


def _int(value: object | None) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(str(value).replace(",", "")))
    except ValueError:
        return None


def _date(value: object | None) -> date | None:
    text = _text(value)
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f", "%m/%d/%Y"):
        try:
            return datetime.strptime(text[:26].replace("Z", ""), fmt.replace(".%f", "")).date()
        except ValueError:
            continue
    if "T" in text:
        try:
            return datetime.fromisoformat(text.replace("Z", "+00:00")).date()
        except ValueError:
            return None
    return None


def _get(row: dict[str, Any], *names: str) -> object | None:
    lower = {str(key).strip().lower(): value for key, value in row.items()}
    for name in names:
        if name.lower() in lower:
            return lower[name.lower()]
    for key, value in lower.items():
        if any(name.lower() == key or name.lower() in key for name in names):
            return value
    return None


class StateSourceFormatError(ValueError):
    """Official source payload is missing required structure."""


def parse_california_records(payload: bytes) -> list[StateLicenseRecord]:
    rows = _json_or_csv_rows(payload)
    if rows and not REQUIRED_CA_COLUMNS.issubset({key.upper() for key in rows[0]}):
        raise StateSourceFormatError("California payload is missing required CDPH columns")
    records: list[StateLicenseRecord] = []
    for row in rows:
        facility_type = (_text(_get(row, "FAC_TYPE_CODE", "FAC_FDR")) or "").upper()
        if facility_type not in CA_SNF_TYPES and "SKILLED NURSING" not in facility_type:
            continue
        records.append(
            StateLicenseRecord(
                state_code="CA",
                source_record_identifier=_text(_get(row, "FACID")) or "",
                facility_name=_text(_get(row, "FACNAME")),
                license_id=_text(_get(row, "LICENSE_NUMBER", "FACID")),
                license_status=_text(
                    _get(row, "LICENSE_STATUS_DESCRIPTION", "FAC_STATUS_TYPE_CODE")
                ),
                license_type=_text(_get(row, "FAC_TYPE_CODE")) or "SNF",
                cms_ccn=normalize_ccn(_get(row, "CCN")),
                address=_text(_get(row, "ADDRESS")),
                city=_text(_get(row, "CITY")),
                zip_code=_zip(_get(row, "ZIP", "ZIP9")),
                phone=_text(_get(row, "CONTACT_PHONE_NUMBER")),
                licensee=_text(_get(row, "BUSINESS_NAME")),
                operator_name=None,
                administrator=_text(_get(row, "FACADMIN")),
                management_company=None,
                capacity=_int(_get(row, "CAPACITY")),
                issue_date=_date(_get(row, "INITIAL_LICENSE_DATE", "LICENSE_EFFECTIVE_DATE")),
                expiration_date=_date(_get(row, "LICENSE_EXPIRATION_DATE")),
                source_url="https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
                raw={str(key): row[key] for key in row if key != "_id"},
            )
        )
    if not records:
        raise StateSourceFormatError("California payload contained no SNF records")
    return [record for record in records if record.source_record_identifier]


def parse_new_york_records(payload: bytes) -> list[StateLicenseRecord]:
    bundle = json.loads(payload.decode("utf-8"))
    if isinstance(bundle, list):
        general, certification = bundle, []
    elif isinstance(bundle, dict):
        general = bundle.get("general") or bundle.get("records") or []
        certification = bundle.get("certification") or []
    else:
        raise StateSourceFormatError("New York payload must be a JSON list or bundle")
    beds: dict[str, int] = {}
    for row in certification:
        if not isinstance(row, dict):
            continue
        if (_text(_get(row, "attribute_type", "Attribute Type")) or "").lower() != "bed":
            continue
        facility_id = _text(_get(row, "fac_id", "Facility ID"))
        measure = _int(_get(row, "measure_value", "Measure Value"))
        if facility_id and measure:
            beds[facility_id] = beds.get(facility_id, 0) + measure
    records: list[StateLicenseRecord] = []
    for row in general:
        if not isinstance(row, dict):
            continue
        description = _text(_get(row, "description", "fac_desc_short", "Description")) or ""
        if description not in NY_SNF_DESCRIPTIONS and "SNF" not in description.upper():
            continue
        facility_id = _text(_get(row, "fac_id", "Facility ID"))
        if not facility_id:
            continue
        records.append(
            StateLicenseRecord(
                state_code="NY",
                source_record_identifier=facility_id,
                facility_name=_text(_get(row, "facility_name", "Facility Name")),
                license_id=_text(_get(row, "opcert_num", "Operating Certificate Number")),
                license_status=None,
                license_type="Residential Health Care Facility - SNF",
                cms_ccn=None,
                address=_text(_get(row, "address1", "Facility Address 1")),
                city=_text(_get(row, "city", "Facility City")),
                zip_code=_zip(_get(row, "fac_zip", "Facility Zip Code")),
                phone=_text(_get(row, "fac_phone", "Facility Phone Number")),
                licensee=_text(_get(row, "cooperator_name", "Cooperator Name")),
                operator_name=_text(_get(row, "operator_name", "Operator Name")),
                administrator=None,
                management_company=None,
                capacity=beds.get(facility_id),
                issue_date=_date(_get(row, "fac_opn_dat", "Facility Open Date")),
                expiration_date=None,
                source_url="https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r",
                raw=row,
            )
        )
    if not records:
        raise StateSourceFormatError("New York payload contained no SNF records")
    return records


def parse_texas_records(payload: bytes) -> list[StateLicenseRecord]:
    if payload[:2] == b"PK":
        rows = _promote_header_row(_xlsx_rows(payload))
    else:
        rows = _json_or_csv_rows(payload)
    if not rows:
        raise StateSourceFormatError("Texas nursing-facility workbook is empty")
    records: list[StateLicenseRecord] = []
    for index, row in enumerate(rows, start=2):
        name = _text(_get(row, "facility name", "provider name"))
        address = _text(_get(row, "physical address", "address", "street"))
        if not name or not address:
            continue
        license_id = _text(
            _get(row, "license no", "license number", "license #", "facility id")
        )
        records.append(
            StateLicenseRecord(
                state_code="TX",
                source_record_identifier=license_id or f"tx-row-{index}",
                facility_name=name,
                license_id=license_id,
                license_status=_text(_get(row, "license status", "status")),
                license_type="Nursing Facility",
                cms_ccn=normalize_ccn(
                    _get(
                        row,
                        "ccn",
                        "cms certification number",
                        "medicare number",
                        "medicare provider number",
                    )
                ),
                address=address,
                city=_text(_get(row, "city", "physical address city")),
                zip_code=_zip(_get(row, "zip", "zip code", "physical address zipcode")),
                phone=_text(_get(row, "phone", "telephone", "facility phone number")),
                licensee=_text(_get(row, "licensee", "legal name", "owner", "owner_")),
                operator_name=_text(_get(row, "operator", "vendor name")),
                administrator=_text(_get(row, "administrator")),
                management_company=_text(_get(row, "management company", "management company_")),
                capacity=_int(
                    _get(
                        row,
                        "beds",
                        "total beds",
                        "licensed beds",
                        "capacity",
                        "total licensed capacity",
                    )
                ),
                issue_date=None,
                expiration_date=_date(_get(row, "expiration", "license expiration")),
                source_url="https://www.hhs.texas.gov/providers/long-term-care-providers/nursing-facilities-nf",
                raw=row,
            )
        )
    if not records:
        raise StateSourceFormatError("Texas workbook contained no nursing-facility rows")
    return records


def _promote_header_row(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    for index, row in enumerate(rows):
        values = [str(value).strip() for value in row.values()]
        lowered = [value.lower() for value in values]
        if any("facility name" in value for value in lowered) and any(
            "address" in value for value in lowered
        ):
            headers = [value or f"column_{position}" for position, value in enumerate(values)]
            remapped: list[dict[str, str]] = []
            for later in rows[index + 1 :]:
                later_values = list(later.values())
                remapped.append(
                    {
                        headers[position]: (
                            later_values[position] if position < len(later_values) else ""
                        )
                        for position in range(len(headers))
                    }
                )
            return remapped
    return rows


def parse_records(source: StateRegulatorSource, payload: bytes) -> list[StateLicenseRecord]:
    if source.state_code == "CA":
        return parse_california_records(payload)
    if source.state_code == "NY":
        return parse_new_york_records(payload)
    if source.state_code == "TX":
        return parse_texas_records(payload)
    raise StateSourceFormatError(f"no production parser for {source.state_code}")


def fetch_official_payload(source: StateRegulatorSource, timeout: float = 90) -> bytes:
    if source.state_code == "CA":
        return _fetch_ckan_all("f0ae5731-fef8-417f-839d-54a0ed3a126e", timeout)
    if source.state_code == "NY":
        general = _fetch_json(
            "https://health.data.ny.gov/resource/vn5v-hh5r.json?"
            + urlencode(
                {
                    "$limit": "50000",
                    "description": "Residential Health Care Facility - SNF",
                }
            ),
            timeout,
        )
        certification = _fetch_json(
            "https://health.data.ny.gov/resource/2g9y-7kqm.json?"
            + urlencode(
                {
                    "$limit": "50000",
                    "description": "Residential Health Care Facility - SNF",
                    "attribute_type": "Bed",
                }
            ),
            timeout,
        )
        return json.dumps({"general": general, "certification": certification}).encode("utf-8")
    if source.state_code == "TX":
        return _fetch_bytes(source.download_or_api_url, timeout)
    raise StateSourceFormatError(f"no production fetch for {source.state_code}")


class OfficialStateAdapter:
    def __init__(self, dataset_key: str):
        self.source = get_state_regulator_source(dataset_key)
        self.adapter_version = ADAPTER_VERSION

    def discover_source(self) -> StateRegulatorSource:
        return self.source

    def parse_records(self, payload: bytes, release_identifier: str) -> list[StateLicenseRecord]:
        del release_identifier
        return parse_records(self.source, payload)

    def emit_observations(self, record, retrieved_at, release_identifier, cms_ccn=None):
        return observations_from_license_record(
            record,
            source=self.source,
            retrieved_at=retrieved_at,
            release_identifier=release_identifier,
            adapter_version=self.adapter_version,
            cms_ccn=cms_ccn,
        )

    def resolve_against_canonical_cms(self, record, cms):
        return resolve_against_canonical_cms(record, cms)


def _json_or_csv_rows(payload: bytes) -> list[dict[str, Any]]:
    text = payload.decode("utf-8-sig")
    stripped = text.lstrip()
    if stripped.startswith("{") or stripped.startswith("["):
        parsed = json.loads(stripped)
        if isinstance(parsed, dict) and "result" in parsed:
            return list(parsed["result"].get("records") or [])
        if isinstance(parsed, dict) and "records" in parsed:
            return list(parsed["records"])
        if isinstance(parsed, list):
            return list(parsed)
        raise StateSourceFormatError("JSON payload is not a record list")
    reader = csv.DictReader(io.StringIO(text))
    return [dict(row) for row in reader]


def _fetch_bytes(url: str, timeout: float) -> bytes:
    request = Request(url, headers={"User-Agent": "SeniorTrustHub/015B (research ingest)"})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310 - official HTTPS/HTTP
        return response.read()


def _fetch_json(url: str, timeout: float) -> Any:
    return json.loads(_fetch_bytes(url, timeout).decode("utf-8"))


def _fetch_ckan_all(resource_id: str, timeout: float) -> bytes:
    records: list[dict[str, Any]] = []
    offset = 0
    page = 32000
    while True:
        url = (
            "https://data.chhs.ca.gov/api/3/action/datastore_search?"
            + urlencode({"resource_id": resource_id, "limit": page, "offset": offset})
        )
        payload = _fetch_json(url, timeout)
        if not payload.get("success"):
            raise StateSourceFormatError("California CKAN request failed")
        batch = payload["result"].get("records") or []
        records.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return json.dumps({"records": records}).encode("utf-8")


def _xlsx_rows(payload: bytes) -> list[dict[str, str]]:
    namespace = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
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
    rows: list[list[str]] = []
    for row in sheet.findall("m:sheetData/m:row", namespace):
        values: list[str] = []
        for cell in row.findall("m:c", namespace):
            kind = cell.get("t")
            raw = cell.findtext("m:v", default="", namespaces=namespace)
            if kind == "s":
                values.append(shared[int(raw)] if raw else "")
            else:
                values.append(raw)
        if any(value.strip() for value in values):
            rows.append(values)
    if not rows:
        return []
    headers = [value.strip() or f"column_{index}" for index, value in enumerate(rows[0])]
    return [
        {headers[index]: row[index] if index < len(row) else "" for index in range(len(headers))}
        for row in rows[1:]
    ]
