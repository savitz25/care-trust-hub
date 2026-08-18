"""Official CA/NY/TX state enforcement and inspection events. VERIFIED identity only."""

# ruff: noqa: E501

from __future__ import annotations

import csv
import io
import json
import re
import zipfile
from dataclasses import asdict, dataclass
from datetime import date, datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree

import psycopg
from psycopg.types.json import Jsonb

DERIVATION_VERSION = "facility-history-state-v1"
CA_RESOURCE = "7c885969-3349-427f-8696-fba4374cd7f8"
NY_PROFILE_ZIP = (
    "https://health.data.ny.gov/api/views/dypu-nabu/files/"
    "db4e3972-b909-4dd2-8854-dabdda927663?download=true"
)
TX_CLOSURES_URL = "https://apps.hhs.texas.gov/providers/directories/Closures/nf_closures.xlsx"

REGULATORS = {
    "CA": "California Department of Public Health",
    "NY": "New York State Department of Health",
    "TX": "Texas Health and Human Services Commission",
}
SOURCE_LABELS = {
    "CA": "California Department of Public Health",
    "NY": "New York State Department of Health",
    "TX": "Texas HHSC",
}


@dataclass(slots=True)
class ParsedStateEvent:
    state_code: str
    license_id: str
    event_type: str
    event_date: date
    event_key: str
    detail: str | None = None
    amount: str | None = None
    class_assessed: str | None = None
    death_related: bool = False
    survey_type: str | None = None


@dataclass(slots=True)
class StateEnforcementReport:
    state_code: str
    parsed: int
    linked_verified: int
    unresolved: int
    inserted: int
    published: int
    possible_duplicates: int
    earliest: str | None
    latest: str | None
    cms_unique_ccns: int
    existing_history_events: int

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _fetch(url: str, timeout: float = 180) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; SeniorTrustHub/017)",
            "Accept": "*/*",
        },
    )
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        return response.read()


def _fetch_ckan(resource_id: str, timeout: float = 180) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    offset = 0
    page = 32000
    while True:
        url = "https://data.chhs.ca.gov/api/3/action/datastore_search?" + urlencode(
            {"resource_id": resource_id, "limit": page, "offset": offset}
        )
        payload = json.loads(_fetch(url, timeout).decode("utf-8"))
        batch = (payload.get("result") or {}).get("records") or []
        records.extend(batch)
        if len(batch) < page:
            break
        offset += page
    return records


def _text(value: object | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _date(value: object | None) -> date | None:
    text = _text(value)
    if not text:
        return None
    if re.fullmatch(r"\d{4,6}", text):
        serial = int(text)
        if serial > 20000:
            return date(1899, 12, 30) + timedelta(days=serial)
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%m/%d/%Y", "%m/%d/%Y %H:%M:%S"):
        try:
            return datetime.strptime(text[:19], fmt).date()
        except ValueError:
            continue
    return None


def _money(value: object | None) -> str | None:
    text = _text(value)
    if not text:
        return None
    cleaned = text.replace("$", "").replace(",", "")
    try:
        amount = float(cleaned)
    except ValueError:
        return None
    if amount <= 0:
        return None
    return f"${amount:,.0f}" if amount.is_integer() else f"${amount:,.2f}"


def _norm_license(value: str) -> str:
    return re.sub(r"\s+", "", value).casefold()


def _norm_loose(value: str) -> str:
    return _norm_license(value).lstrip("0") or "0"


def parse_california_events(records: list[dict[str, Any]]) -> list[ParsedStateEvent]:
    events: list[ParsedStateEvent] = []
    for row in records:
        if str(row.get("FAC_TYPE_CODE") or "").upper() != "SNF":
            continue
        license_id = _text(row.get("FACID"))
        issued = _date(row.get("PENALTY_ISSUE_DATE")) or _date(row.get("VIOLATION_FROM_DATE"))
        key = _text(row.get("PENALTY_NUMBER"))
        if not license_id or not issued or not key:
            continue
        amount = _money(row.get("TOTAL_AMOUNT_DUE_FINAL") or row.get("TOTAL_AMOUNT_INITIAL"))
        class_assessed = _text(row.get("CLASS_ASSESSED_FINAL") or row.get("CLASS_ASSESSED_INITIAL"))
        death = str(row.get("DEATH_RELATED") or "").upper() == "Y"
        penalty_type = (_text(row.get("PENALTY_TYPE")) or "").lower()
        event_type = "STATE_FINE" if amount else "STATE_ENFORCEMENT_ACTION"
        if "suspen" in penalty_type:
            event_type = "STATE_LICENSE_SUSPENSION"
        detail = _text(row.get("PENALTY_DETAIL") or row.get("PENALTY_CATEGORY"))
        events.append(
            ParsedStateEvent(
                "CA",
                license_id,
                event_type,
                issued,
                key,
                detail=detail,
                amount=amount,
                class_assessed=class_assessed,
                death_related=death,
            )
        )
    return events


def parse_new_york_profile(payload: bytes) -> list[ParsedStateEvent]:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        facilities = list(
            csv.DictReader(io.StringIO(archive.read("Facility_Info.csv").decode("utf-8-sig")))
        )
        surveys = list(csv.DictReader(io.StringIO(archive.read("Surveys.csv").decode("utf-8-sig"))))
        enforcements = list(
            csv.DictReader(io.StringIO(archive.read("ENFORCEMENTS.csv").decode("utf-8-sig")))
        )
    cert_by_facility: dict[str, str] = {}
    for row in facilities:
        facility_id = _text(row.get("FACILITY_ID"))
        cert = _text(row.get("CERTIFICATION_NUMBER"))
        if facility_id and cert:
            cert_by_facility[_norm_loose(facility_id)] = cert
    events: list[ParsedStateEvent] = []
    for row in surveys:
        facility_id = _text(row.get("FACILITY_ID"))
        survey_id = _text(row.get("SURVEY_ID"))
        survey_date = _date(row.get("INITIAL_SURVEY_DATE"))
        cert = cert_by_facility.get(_norm_loose(facility_id or ""))
        if not facility_id or not survey_id or not survey_date or not cert:
            continue
        survey_type = _text(row.get("SURVEY_TYPE")) or "SURVEY"
        event_type = (
            "STATE_COMPLAINT_INSPECTION"
            if "COMPLAINT" in survey_type.upper()
            else "STATE_INSPECTION"
        )
        events.append(
            ParsedStateEvent(
                "NY",
                cert,
                event_type,
                survey_date,
                survey_id,
                detail=survey_type,
                survey_type=survey_type,
            )
        )
    for row in enforcements:
        if _text(row.get("MANUAL_EXCLUDE")):
            continue
        facility_id = _text(row.get("FACILITY_ID"))
        key = _text(row.get("STIP_NUMBER"))
        event_date = _date(row.get("STIP_DATE")) or _date(row.get("SURVEY_DATE"))
        cert = cert_by_facility.get(_norm_loose(facility_id or ""))
        if not facility_id or not key or not event_date or not cert:
            continue
        events.append(
            ParsedStateEvent(
                "NY",
                cert,
                "STATE_FINE",
                event_date,
                key,
                detail=_text(row.get("DEFICIENCY CATEGORY")),
                amount=_money(row.get("FINE_ASSESSED")),
            )
        )
    return events


def _xlsx_matrix(payload: bytes) -> list[list[str]]:
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
    matrix: list[list[str]] = []
    for row in sheet.findall("m:sheetData/m:row", namespace):
        values: list[str] = []
        for cell in row.findall("m:c", namespace):
            kind = cell.get("t")
            raw = cell.findtext("m:v", default="", namespaces=namespace)
            values.append(shared[int(raw)] if kind == "s" and raw else raw)
        if any(value.strip() for value in values):
            matrix.append(values)
    return matrix


def parse_texas_closures(payload: bytes) -> list[ParsedStateEvent]:
    matrix = _xlsx_matrix(payload)
    header_index = next(
        (
            index
            for index, row in enumerate(matrix)
            if any("facility id" in value.lower() for value in row)
        ),
        None,
    )
    if header_index is None:
        return []
    headers = [
        value.strip() or f"column_{index}" for index, value in enumerate(matrix[header_index])
    ]
    raw_rows = [
        {headers[index]: row[index] if index < len(row) else "" for index in range(len(headers))}
        for row in matrix[header_index + 1 :]
    ]
    events: list[ParsedStateEvent] = []
    for row in raw_rows:
        license_id = _text(row.get("Facility ID") or row.get("FacilityID"))
        closed = _date(row.get("Date of Closure") or row.get("Closure Date"))
        program = (_text(row.get("Program") or row.get("Service Type")) or "").lower()
        if not license_id or not closed:
            continue
        if program and "nurs" not in program and "snf" not in program:
            continue
        events.append(
            ParsedStateEvent(
                "TX",
                license_id,
                "STATE_CLOSURE",
                closed,
                f"{license_id}:{closed.isoformat()}",
            )
        )
    return events


def _presentation(event: ParsedStateEvent) -> tuple[str, str, str]:
    regulator = REGULATORS[event.state_code]
    date_label = event.event_date.isoformat()
    if event.event_type == "STATE_FINE":
        amount = f" of {event.amount}" if event.amount else ""
        return (
            "State fine recorded",
            f"{regulator} recorded a state fine{amount} on {date_label}.",
            "HIGH",
        )
    if event.event_type in {"STATE_CLOSURE", "STATE_CLOSURE_ACTION"}:
        return (
            "State facility closure recorded",
            f"{regulator} recorded a nursing-facility closure on {date_label}.",
            "HIGH",
        )
    if event.event_type in {"STATE_COMPLAINT_INSPECTION", "STATE_COMPLAINT"}:
        return (
            "State complaint inspection recorded",
            f"{regulator} recorded a complaint-related inspection on {date_label}.",
            "MEDIUM",
        )
    if event.event_type == "STATE_INSPECTION":
        return (
            "State inspection completed",
            f"{regulator} recorded a state inspection on {date_label}.",
            "LOW",
        )
    if event.event_type == "STATE_LICENSE_SUSPENSION":
        return (
            "State license action recorded",
            f"{regulator} recorded a license restriction or suspension on {date_label}.",
            "HIGH",
        )
    high = event.death_related or (event.class_assessed or "").upper() in {"A", "AA"}
    detail = f" {event.detail}." if event.detail else ""
    return (
        "State regulatory action recorded",
        f"{regulator} recorded an enforcement action on {date_label}.{detail}",
        "HIGH" if high else "MEDIUM",
    )


def _verified_license_map(
    connection: psycopg.Connection[Any], state_code: str
) -> dict[str, tuple[str, str]]:
    mapping: dict[str, tuple[str, str]] = {}
    rows = connection.execute(
        """
        SELECT fei.provider_id, fei.identifier_value
        FROM facility_external_identifier fei
        WHERE fei.namespace = %s
          AND fei.identifier_type = 'LICENSE_ID'
          AND fei.verification_state = 'VERIFIED'
        """,
        (f"STATE_{state_code}",),
    ).fetchall()
    if not rows:
        rows = connection.execute(
            """
            SELECT c.provider_id, c.claim_value #>> '{}'
            FROM facility_claim c
            WHERE c.claim_type = 'STATE_LICENSE_ID'
              AND c.resolution_state = 'VERIFIED'
              AND c.effective_to IS NULL
              AND c.resolver_reference LIKE %s
            """,
            (f"system:state-regulator-v1:{state_code.lower()}-%",),
        ).fetchall()
    for provider_id, license_id in rows:
        if not license_id:
            continue
        mapping[_norm_license(str(license_id))] = (str(provider_id), str(license_id))
        mapping[_norm_loose(str(license_id))] = (str(provider_id), str(license_id))
    return mapping


def _cms_inspection_dates(
    connection: psycopg.Connection[Any], provider_ids: set[str]
) -> set[tuple[str, date]]:
    if not provider_ids:
        return set()
    rows = connection.execute(
        """
        SELECT provider_id, event_date
        FROM facility_history_event
        WHERE event_type = 'INSPECTION_COMPLETED'
          AND provider_id = ANY(%s)
        """,
        (list(provider_ids),),
    ).fetchall()
    return {(str(provider_id), event_date) for provider_id, event_date in rows}


def ingest_state_enforcement(
    database_url: str,
    state_code: str,
    *,
    payload: bytes | None = None,
    records: list[dict[str, Any]] | None = None,
    timeout: float = 180,
) -> StateEnforcementReport:
    state = state_code.upper()
    if state == "CA":
        parsed = parse_california_events(
            records if records is not None else _fetch_ckan(CA_RESOURCE, timeout)
        )
    elif state == "NY":
        parsed = parse_new_york_profile(
            payload if payload is not None else _fetch(NY_PROFILE_ZIP, timeout)
        )
    elif state == "TX":
        parsed = parse_texas_closures(
            payload if payload is not None else _fetch(TX_CLOSURES_URL, timeout)
        )
    else:
        raise ValueError("only CA, NY, and TX are supported")

    with psycopg.connect(database_url) as connection:
        licenses = _verified_license_map(connection, state)
        cms_dates = _cms_inspection_dates(
            connection,
            {provider_id for provider_id, _ in licenses.values()},
        )
        existing_history = connection.execute(
            "SELECT count(*) FROM facility_history_event"
        ).fetchone()
        cms_ccns = connection.execute(
            """
            SELECT count(*) FROM (
              SELECT DISTINCT identifier_value FROM provider_identifier
              WHERE issuer='CMS' AND identifier_type='CCN' AND valid_to IS NULL
            ) t
            """
        ).fetchone()
        inserted = 0
        published = 0
        unresolved = 0
        duplicates = 0
        dates: list[date] = []
        rows: list[tuple[Any, ...]] = []
        dataset_key = {
            "CA": "ca-cdph-state-enforcement-actions",
            "NY": "ny-doh-nursing-home-profile",
            "TX": "tx-hhsc-nf-closures",
        }[state]
        before = connection.execute(
            """
            SELECT count(*) FROM facility_history_event
            WHERE derivation_version = %s AND state_code = %s
            """,
            (DERIVATION_VERSION, state),
        ).fetchone()[0]
        for event in parsed:
            match = licenses.get(_norm_license(event.license_id)) or licenses.get(
                _norm_loose(event.license_id)
            )
            if not match:
                unresolved += 1
                continue
            provider_id, canonical_license = match
            relationship = "STATE_ONLY"
            publish = True
            if event.event_type in {"STATE_INSPECTION", "STATE_COMPLAINT_INSPECTION"}:
                if (provider_id, event.event_date) in cms_dates:
                    relationship = "POSSIBLE_DUPLICATE"
                    publish = False
                    duplicates += 1
            title, summary, importance = _presentation(event)
            fingerprint = (
                f"{DERIVATION_VERSION}|{state}|{event.event_type}|"
                f"{_norm_license(canonical_license)}|{event.event_key}|{event.event_date.isoformat()}"
            )
            rows.append(
                (
                    provider_id,
                    event.event_type,
                    event.event_date,
                    importance,
                    title,
                    summary,
                    event.amount,
                    dataset_key,
                    f"{state.lower()}:{event.event_key}",
                    event.event_key,
                    fingerprint,
                    DERIVATION_VERSION,
                    publish,
                    Jsonb(
                        {
                            "detail": event.detail,
                            "surveyType": event.survey_type,
                            "classAssessed": event.class_assessed,
                        }
                    ),
                    REGULATORS[state],
                    state,
                    canonical_license,
                    relationship,
                    SOURCE_LABELS[state],
                )
            )
            if publish:
                published += 1
            dates.append(event.event_date)
        if rows:
            with connection.cursor() as cursor:
                cursor.executemany(
                    """
                    INSERT INTO facility_history_event (
                      provider_id, event_type, event_family, event_date, date_precision, date_basis,
                      importance, title, summary, previous_value, new_value, evidence_href,
                      source_dataset_key, source_record_locator, source_event_key, fingerprint,
                      derivation_version, publication_eligible, payload, regulator, state_code,
                      state_license_id, federal_relationship, source_label
                    ) VALUES (
                      %s,%s,'state',%s,'day','occurred',%s,%s,%s,NULL,%s,'#state-license',
                      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
                    )
                    ON CONFLICT (fingerprint) DO NOTHING
                    """,
                    rows,
                )
        after = connection.execute(
            """
            SELECT count(*) FROM facility_history_event
            WHERE derivation_version = %s AND state_code = %s
            """,
            (DERIVATION_VERSION, state),
        ).fetchone()[0]
        inserted = after - before
        connection.commit()
    return StateEnforcementReport(
        state_code=state,
        parsed=len(parsed),
        linked_verified=len(parsed) - unresolved,
        unresolved=unresolved,
        inserted=inserted,
        published=published,
        possible_duplicates=duplicates,
        earliest=min(dates).isoformat() if dates else None,
        latest=max(dates).isoformat() if dates else None,
        cms_unique_ccns=cms_ccns[0] if cms_ccns else 0,
        existing_history_events=existing_history[0] if existing_history else 0,
    )


def ingest_all_state_enforcement(database_url: str, timeout: float = 180) -> dict[str, Any]:
    reports = {
        state: ingest_state_enforcement(database_url, state, timeout=timeout)
        for state in ("CA", "NY", "TX")
    }
    return {state: asdict(report) for state, report in reports.items()}
