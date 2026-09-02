"""NJ-SEN-004 NJDOH All_Acute facility identity spine.

Preserves every official acute-care type. Does not rank facilities.
Does not replace CMS Home Health or Hospice spines.
Does not infer service area from office location.
"""

# ruff: noqa: E501

from __future__ import annotations

import hashlib
import json
import re
from collections import Counter
from dataclasses import asdict, dataclass, field
from datetime import UTC, date, datetime
from typing import Any
from urllib.request import Request, urlopen

from .nj_doh_enforcement import IdentityRecord, normalize_licensed_name
from .nj_doh_ltc import (
    NjDohSchemaError,
    excel_serial_date,
    normalize_address,
    normalize_license_number,
    normalize_name,
    normalize_phone,
    parse_xlsx,
    record_fingerprint,
    schema_fingerprint,
)
from .state_regulator import CanonicalCmsFacility, normalize_ccn

ADAPTER_VERSION = "nj-doh-acute-v1"
DATASET_KEY = "nj-doh-all-acute"
REGULATOR_CODE = "NJ_DOH"
AGENCY = "New Jersey Department of Health"
SOURCE_URL = "https://healthapps.nj.gov/facilities/documents2/All_Acute.xlsx"
LANDING_URL = "https://healthapps.nj.gov/facilities/acSearch.aspx"
SEARCH_URL = "https://healthapps.nj.gov/facilities/acSetSearch.aspx?by=name"
USER_AGENT = "SeniorTrustHub/NJ-SEN-004 (research ingest; public records)"
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
NJ_COUNTIES = {
    "ATLANTIC",
    "BERGEN",
    "BURLINGTON",
    "CAMDEN",
    "CAPE MAY",
    "CUMBERLAND",
    "ESSEX",
    "GLOUCESTER",
    "HUDSON",
    "HUNTERDON",
    "MERCER",
    "MIDDLESEX",
    "MONMOUTH",
    "MORRIS",
    "OCEAN",
    "PASSAIC",
    "SALEM",
    "SOMERSET",
    "SUSSEX",
    "UNION",
    "WARREN",
}
DETAIL_URL_CANDIDATES = (
    "https://healthapps.nj.gov/facilities/acFacDetails.aspx?item={item}",
    "https://healthapps.nj.gov/facilities/acShowFacility.aspx?item={item}",
    "https://healthapps.nj.gov/facilities/fsFacDetails.aspx?item={item}",
)


@dataclass(frozen=True, slots=True)
class AcuteTypeSpec:
    canonical: str
    cms_crosswalk_class: str
    senior_relevant: bool
    state_intelligence_eligible: bool
    notes: str


# Official workbook values only. Unknown raw values are quarantined, never mapped to OTHER.
TYPE_MAP: dict[str, AcuteTypeSpec] = {
    "HOME HEALTH AGENCY": AcuteTypeSpec(
        "NJ_HHA", "home_health", True, True, "Home Health Agency. Not hospice."
    ),
    "HOSPICE CARE PROGRAM": AcuteTypeSpec(
        "NJ_HOSPICE_PROGRAM", "hospice", True, True, "Hospice Care Program. Not a branch or inpatient unit."
    ),
    "HOSPICE CARE BRANCH": AcuteTypeSpec(
        "NJ_HOSPICE_BRANCH", "hospice", True, True, "Hospice Care Branch. Does not inherit a parent CCN without official evidence."
    ),
    "HOSPICE CARE - INPATIENT": AcuteTypeSpec(
        "NJ_HOSPICE_INPATIENT", "hospice", True, True, "Hospice Care – Inpatient. Not a nursing home."
    ),
    "GENERAL ACUTE CARE HOSPITAL": AcuteTypeSpec(
        "NJ_HOSPITAL_GENERAL_ACUTE", "none", False, True, "General Acute Care Hospital. Not a nursing facility."
    ),
    "COMPREHENSIVE REHABILITATION HOSPITAL": AcuteTypeSpec(
        "NJ_HOSPITAL_COMP_REHAB", "none", True, True, "Comprehensive Rehabilitation Hospital. Not a nursing facility."
    ),
    "CHILDREN REHABILITATION HOSPITAL": AcuteTypeSpec(
        "NJ_HOSPITAL_CHILD_REHAB", "none", False, True, "Children Rehabilitation Hospital. Distinct official subtype."
    ),
    "PSYCHIATRIC HOSPITAL": AcuteTypeSpec(
        "NJ_HOSPITAL_PSYCH", "none", False, True, "Psychiatric Hospital. Not a nursing facility."
    ),
    "SPECIAL HOSPITAL": AcuteTypeSpec(
        "NJ_HOSPITAL_SPECIAL", "none", False, True, "Special Hospital. Distinct official label."
    ),
    "SPECIAL HOSPITAL HOSP-LT": AcuteTypeSpec(
        "NJ_HOSPITAL_SPECIAL_LT", "none", True, True, "Special Hospital HOSP-LT. Not merged into comprehensive rehab or nursing."
    ),
    "SPECIAL HOSPITAL HOSP-ACU": AcuteTypeSpec(
        "NJ_HOSPITAL_SPECIAL_ACU", "none", False, True, "Special Hospital HOSP-ACU. Distinct official subtype."
    ),
    "SPECIAL HOSPITAL - PSYCHIATRIC": AcuteTypeSpec(
        "NJ_HOSPITAL_SPECIAL_PSYCH", "none", False, True, "Special Hospital – Psychiatric. Not merged into Psychiatric Hospital."
    ),
    "HOSPITAL-BASED, OFF-SITE AMBULATORY CARE FACILITY": AcuteTypeSpec(
        "NJ_HOSP_OFFSITE_ACF", "none", False, True, "Hospital-based off-site ambulatory care. Not home health."
    ),
    "HOSPITAL-BASED, OFF-SITE AMBULATORY CARE FACILITY STHSPOFF": AcuteTypeSpec(
        "NJ_HOSP_OFFSITE_ACF_STHSPOFF", "none", False, True, "Hospital-based off-site ACF STHSPOFF. Distinct official subtype."
    ),
    "HOSPITAL-BASED, OFF-SITE AMBULATORY CARE FACILITY CTR ST": AcuteTypeSpec(
        "NJ_HOSP_OFFSITE_ACF_CTR_ST", "none", False, True, "Hospital-based off-site ACF CTR ST. Distinct official subtype."
    ),
    "HOSPITAL-BASED, OFF-SITE AMBULATORY CARE FACILITY CORF": AcuteTypeSpec(
        "NJ_HOSP_OFFSITE_ACF_CORF", "none", False, True, "Hospital-based off-site ACF CORF. Distinct official subtype."
    ),
    "AMBULATORY CARE FACILITY": AcuteTypeSpec(
        "NJ_ACF", "none", False, True, "Freestanding ambulatory care facility. Not home health."
    ),
    "AMBULATORY CARE FACILITY - SATELLITE": AcuteTypeSpec(
        "NJ_ACF_SATELLITE", "none", False, True, "Ambulatory care satellite. Distinct from the parent ACF license."
    ),
    "AMBULATORY SURGICAL CENTER": AcuteTypeSpec(
        "NJ_ASC", "none", False, True, "Ambulatory surgical center."
    ),
    "AMBULATORY SURGICAL CENTER ASC-ST": AcuteTypeSpec(
        "NJ_ASC_ST", "none", False, True, "Ambulatory surgical center ASC-ST. Distinct official subtype."
    ),
    "SURGICAL PRACTICE": AcuteTypeSpec(
        "NJ_SURGICAL_PRACTICE", "none", False, True, "Surgical Practice. Not an ASC."
    ),
    "SURGICAL PRACTICE ASC-P-C": AcuteTypeSpec(
        "NJ_SURGICAL_PRACTICE_ASC_PC", "none", False, True, "Surgical Practice ASC-P-C. Distinct official subtype."
    ),
    "END STAGE RENAL DIALYSIS": AcuteTypeSpec(
        "NJ_ESRD", "none", False, True, "End Stage Renal Dialysis. Not home health."
    ),
    "FEDERALLY QUALIFIED HEALTH CENTERS": AcuteTypeSpec(
        "NJ_FQHC", "none", False, True, "Federally Qualified Health Center."
    ),
    "COMPREHENSIVE OUTPATIENT REHAB": AcuteTypeSpec(
        "NJ_CORF", "none", True, True, "Comprehensive outpatient rehab. Not a hospital and not nursing."
    ),
    "MATERNAL AND CHILD HEALTH CONSORTIUM": AcuteTypeSpec(
        "NJ_MCHC", "none", False, True, "Maternal and Child Health Consortium."
    ),
}

HHA_TYPES = {"NJ_HHA"}
HOSPICE_PROGRAM_TYPES = {"NJ_HOSPICE_PROGRAM"}
HOSPICE_BRANCH_TYPES = {"NJ_HOSPICE_BRANCH"}
HOSPICE_INPATIENT_TYPES = {"NJ_HOSPICE_INPATIENT"}
HOSPICE_TYPES = HOSPICE_PROGRAM_TYPES | HOSPICE_BRANCH_TYPES | HOSPICE_INPATIENT_TYPES


@dataclass(frozen=True, slots=True)
class NjAcuteFacilityRow:
    source_facility_id: str
    license_number: str
    official_name: str
    alpha_name: str | None
    facility_type_raw: str
    facility_type_canonical: str
    cms_crosswalk_class: str
    senior_relevant: bool
    street: str | None
    mailing_street: str | None
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
    latitude: float | None
    longitude: float | None
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
class BranchParentLink:
    branch_facid: str
    program_facid: str | None
    bucket: str
    method: str
    reason: str


@dataclass(slots=True)
class ServiceAreaProbe:
    facid: str
    url: str
    http_status: int | None
    blocked: bool
    barrier: str
    counties_served: list[str] = field(default_factory=list)


@dataclass(slots=True)
class NjAcuteIngestReport:
    adapter_version: str
    dataset_key: str
    landing_url: str
    source_url: str
    retrieved_at: str
    source_as_of: str | None
    content_sha256: str
    file_size_bytes: int
    schema_fingerprint: str
    worksheet_names: list[str]
    source_rows: int
    distinct_source_facility_ids: int
    distinct_license_numbers: int
    rows_by_raw_type: dict[str, int]
    rows_by_canonical_type: dict[str, int]
    home_health_agencies: int
    hospice_programs: int
    hospice_branches: int
    hospice_inpatient: int
    other_acute_classes: int
    unknown_types: dict[str, int]
    quarantined_rows: int
    exact: int
    high_confidence: int
    review_required: int
    conflicts: int
    unresolved: int
    unsafe_rejected: int
    state_only: int
    cms_only: int
    net_new: int
    updated: int
    unchanged: int
    existing_enriched: int
    duplicate_licenses: int
    missing_county: int
    invalid_county: int
    missing_address: int
    expired_before_rundate: int
    geo_anomalies: int
    baseline_only: bool
    public_eligible: bool
    dry_run: bool
    mode: str
    service_area_status: str
    notes: list[str] = field(default_factory=list)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def map_facility_type(raw: str) -> AcuteTypeSpec | None:
    return TYPE_MAP.get((raw or "").strip())


def _text(value: object | None) -> str | None:
    text = str(value or "").strip()
    if not text or text.lower() in {"(blank)", "n/a"}:
        return None
    return text


def _int(value: object | None) -> int | None:
    text = str(value or "").strip()
    if not text or text.lower() in {"(blank)", "n/a"}:
        return None
    try:
        number = int(float(text.replace(",", "")))
    except ValueError:
        return None
    return number if number >= 0 else None


def _coord(value: object | None) -> float | None:
    try:
        number = float(str(value or "").strip())
    except ValueError:
        return None
    if number == 0:
        return None
    return number


def parse_acute_xlsx(payload: bytes) -> tuple[list[str], list[dict[str, str]], list[str]]:
    return parse_xlsx(payload, required=REQUIRED_COLUMNS)


def parse_acute_rows(
    rows: list[dict[str, str]],
) -> tuple[list[NjAcuteFacilityRow], list[dict[str, str]]]:
    parsed: list[NjAcuteFacilityRow] = []
    quarantined: list[dict[str, str]] = []
    seen_ids: set[str] = set()
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
        if fac_id in seen_ids:
            quarantined.append({**row, "_reason": f"duplicate FacID after normalization: {fac_id}"})
            continue
        seen_ids.add(fac_id)
        street = _text((row.get("ADDRESS") or "").split("\n", 1)[0])
        mailing = _text(row.get("FAC_ADDR_2"))
        parsed.append(
            NjAcuteFacilityRow(
                source_facility_id=fac_id,
                license_number=license,
                official_name=name,
                alpha_name=_text(row.get("ALPHA_NAME")),
                facility_type_raw=raw_type,
                facility_type_canonical=mapped.canonical,
                cms_crosswalk_class=mapped.cms_crosswalk_class,
                senior_relevant=mapped.senior_relevant,
                street=street,
                mailing_street=mailing,
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
                latitude=_coord(row.get("LAT")),
                longitude=_coord(row.get("LNG")),
                source_record_identifier=fac_id,
                record_fingerprint=record_fingerprint(
                    {key: str(row.get(key) or "") for key in sorted(row)}
                ),
                raw={key: str(row.get(key) or "") for key in row},
            )
        )
    return parsed, quarantined


def identity_from_acute(row: NjAcuteFacilityRow) -> IdentityRecord:
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
        dataset_key=DATASET_KEY,
        facility_type_raw=row.facility_type_raw,
    )


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


def match_cms_agency(
    row: NjAcuteFacilityRow,
    universe: list[CanonicalCmsFacility],
    *,
    cms_class: str,
) -> NjMatch:
    if row.cms_crosswalk_class != cms_class:
        return NjMatch(
            "UNRESOLVED",
            "non_cms_class",
            f"Official NJDOH type is not a CMS {cms_class} class; federal certification is not attached",
            None,
            0,
        )
    in_state = [item for item in universe if (item.state or "").upper() == "NJ"]
    published = normalize_ccn(
        row.raw.get("CCN") or row.raw.get("CMS_CCN") or row.raw.get("Medicare") or ""
    )
    if published:
        exact = [item for item in in_state if item.cms_ccn == published]
        if len(exact) == 1:
            return NjMatch(
                "EXACT",
                "source_ccn",
                "Official NJ source published a CMS CCN present in the class universe",
                published,
                1,
            )
        if len(exact) > 1:
            return NjMatch(
                "CONFLICT", "source_ccn", "Published CCN matched more than one CMS identity", None, len(exact)
            )
        return NjMatch(
            "UNRESOLVED", "source_ccn", "Published CCN is not in the current CMS class universe", published, 0
        )

    if row.facility_type_canonical == "NJ_HOSPICE_BRANCH":
        return NjMatch(
            "REVIEW_REQUIRED",
            "hospice_branch",
            "A hospice branch does not receive a separate CMS CCN unless an official source supports it",
            None,
            0,
        )

    name = normalize_licensed_name(row.official_name)
    address = normalize_address(row.street)
    phone = row.phone
    name_hits = [item for item in in_state if name and normalize_licensed_name(item.name) == name]
    if name_hits and not address and not phone:
        return NjMatch(
            "UNSAFE_REJECTED", "name_only", "Name-only matching is never auto-attached", None, len(name_hits)
        )

    high: list[CanonicalCmsFacility] = []
    review: list[CanonicalCmsFacility] = []
    for item in in_state:
        matched: list[str] = []
        if name and normalize_licensed_name(item.name) == name:
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
        elif "name" in matched and "phone" in matched and address:
            high.append(item)
        elif "name" in matched and "city" in matched:
            review.append(item)
        elif "name" in matched and "zip" in matched:
            review.append(item)
        elif "address" in matched:
            review.append(item)

    unique_high = {item.cms_ccn: item for item in high}
    if len(unique_high) == 1:
        cms = next(iter(unique_high.values()))
        return NjMatch(
            "HIGH_CONFIDENCE",
            "name_address_or_name_phone_location",
            "Exact normalized name plus exact address, or unique name+telephone+location, within class",
            cms.cms_ccn,
            1,
        )
    if len(unique_high) > 1:
        return NjMatch(
            "CONFLICT",
            "name_address_or_name_phone_location",
            "Multiple CMS identities in the same class satisfy high-confidence evidence",
            None,
            len(unique_high),
        )
    unique_review = {item.cms_ccn: item for item in review}
    if unique_review:
        return NjMatch(
            "REVIEW_REQUIRED",
            "partial_overlap",
            "Name plus city/ZIP or campus address is not sufficient to auto-attach a CMS identity",
            None,
            len(unique_review),
        )
    return NjMatch("UNRESOLVED", "no_overlap", "No overlapping CMS identity evidence in this class", None, 0)


def match_home_health(row: NjAcuteFacilityRow, universe: list[CanonicalCmsFacility]) -> NjMatch:
    if row.facility_type_canonical != "NJ_HHA":
        return NjMatch("UNRESOLVED", "non_cms_class", "Not a Home Health Agency license", None, 0)
    return match_cms_agency(row, universe, cms_class="home_health")


def match_hospice(row: NjAcuteFacilityRow, universe: list[CanonicalCmsFacility]) -> NjMatch:
    if row.facility_type_canonical not in HOSPICE_TYPES:
        return NjMatch("UNRESOLVED", "non_cms_class", "Not a Hospice license", None, 0)
    return match_cms_agency(row, universe, cms_class="hospice")


def branch_parent_links(rows: list[NjAcuteFacilityRow]) -> list[BranchParentLink]:
    programs = [row for row in rows if row.facility_type_canonical == "NJ_HOSPICE_PROGRAM"]
    branches = [row for row in rows if row.facility_type_canonical == "NJ_HOSPICE_BRANCH"]
    links: list[BranchParentLink] = []
    for branch in branches:
        name_hits = [
            item
            for item in programs
            if normalize_name(item.official_name) == normalize_name(branch.official_name)
            or (
                item.licensed_owner
                and branch.licensed_owner
                and normalize_name(item.licensed_owner) == normalize_name(branch.licensed_owner)
                and normalize_name(item.official_name).split(" ")[:2]
                == normalize_name(branch.official_name).split(" ")[:2]
            )
        ]
        if len(name_hits) == 1:
            links.append(
                BranchParentLink(
                    branch.source_facility_id,
                    name_hits[0].source_facility_id,
                    "REVIEW_REQUIRED",
                    "branch_name_or_owner",
                    "Branch/program relationship is review-required unless an official source supplies the parent CMS CCN",
                )
            )
        elif len(name_hits) > 1:
            links.append(
                BranchParentLink(
                    branch.source_facility_id,
                    None,
                    "REVIEW_REQUIRED",
                    "branch_multiple_programs",
                    "Branch name or owner matched more than one hospice program",
                )
            )
        else:
            links.append(
                BranchParentLink(
                    branch.source_facility_id,
                    None,
                    "UNRESOLVED",
                    "branch_parent_unknown",
                    "No official parent program identifier is published in All_Acute",
                )
            )
    return links


def physical_location_areas(rows: list[NjAcuteFacilityRow]) -> list[dict[str, str]]:
    areas: list[dict[str, str]] = []
    for row in rows:
        county = (row.county or "").upper()
        if county in NJ_COUNTIES:
            areas.append(
                {
                    "source_facility_id": row.source_facility_id,
                    "coverage_type": "PHYSICAL_LOCATION",
                    "county": county,
                    "zip_code": row.zip_code or "",
                }
            )
        else:
            areas.append(
                {
                    "source_facility_id": row.source_facility_id,
                    "coverage_type": "SERVICE_AREA_UNKNOWN",
                    "county": row.county or "",
                    "zip_code": row.zip_code or "",
                }
            )
    return areas


def fetch_official_workbook(timeout: float = 120) -> bytes:
    request = Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        return response.read()


def probe_service_area_page(facid: str, timeout: float = 20) -> ServiceAreaProbe:
    last = ServiceAreaProbe(facid, DETAIL_URL_CANDIDATES[0].format(item=facid), None, True, "not_attempted")
    for template in DETAIL_URL_CANDIDATES:
        url = template.format(item=facid)
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=timeout) as response:  # noqa: S310
                status = getattr(response, "status", 200)
                body = response.read().decode("utf-8", errors="replace")
        except Exception as exc:  # noqa: BLE001 - record the barrier
            last = ServiceAreaProbe(facid, url, None, True, f"http_error:{exc.__class__.__name__}")
            continue
        lower = body.lower()
        if "captcha" in lower:
            return ServiceAreaProbe(facid, url, status, True, "CAPTCHA")
        if "login" in lower and "password" in lower:
            return ServiceAreaProbe(facid, url, status, True, "LOGIN")
        if status in {401, 403}:
            return ServiceAreaProbe(facid, url, status, True, f"HTTP_{status}")
        if status >= 400:
            last = ServiceAreaProbe(facid, url, status, True, f"HTTP_{status}")
            continue
        counties = re.findall(
            r"\b(Atlantic|Bergen|Burlington|Camden|Cape May|Cumberland|Essex|Gloucester|Hudson|Hunterdon|Mercer|Middlesex|Monmouth|Morris|Ocean|Passaic|Salem|Somerset|Sussex|Union|Warren)\b",
            body,
            re.I,
        )
        if "counties served" in lower or "service area" in lower:
            return ServiceAreaProbe(
                facid, url, status, False, "acquired", [item.title() for item in dict.fromkeys(counties)]
            )
        last = ServiceAreaProbe(facid, url, status, True, "no_service_area_fields")
    return last


def inspect_payload(payload: bytes, retrieved_at: datetime | None = None) -> dict[str, Any]:
    retrieved = retrieved_at or datetime.now(tz=UTC)
    headers, rows, sheets = parse_acute_xlsx(payload)
    parsed, quarantined = parse_acute_rows(rows)
    run_dates = sorted({item.run_date.isoformat() for item in parsed if item.run_date})
    counties = sorted({(item.county or "").upper() for item in parsed if item.county})
    return {
        "landing_url": LANDING_URL,
        "source_url": SOURCE_URL,
        "retrieved_at": retrieved.isoformat(),
        "source_as_of": run_dates[0] if len(run_dates) == 1 else None,
        "run_dates": run_dates,
        "sha256": hashlib.sha256(payload).hexdigest(),
        "bytes": len(payload),
        "worksheet_names": sheets,
        "columns": headers,
        "column_count": len(headers),
        "schema_fingerprint": schema_fingerprint(headers),
        "source_rows": len(rows),
        "parsed_rows": len(parsed),
        "quarantined_rows": len(quarantined),
        "distinct_source_facility_ids": len({item.source_facility_id for item in parsed}),
        "distinct_license_numbers": len({item.license_number for item in parsed}),
        "duplicate_facids": max(0, len(rows) - len({normalize_license_number(r.get("FacID")) for r in rows})),
        "duplicate_licenses": max(0, len(parsed) - len({item.license_number for item in parsed})),
        "rows_by_raw_type": dict(Counter(item.facility_type_raw for item in parsed)),
        "rows_by_canonical_type": dict(Counter(item.facility_type_canonical for item in parsed)),
        "unknown_types": dict(
            Counter(str(item.get("FACILITY_TYPE") or "") for item in quarantined if "unknown facility type" in str(item.get("_reason") or ""))
        ),
        "counties": [name for name in counties if name in NJ_COUNTIES],
        "invalid_counties": [name for name in counties if name not in NJ_COUNTIES],
        "null_rates": {
            column: round(sum(1 for row in rows if not _text(row.get(column))) / len(rows), 4) if rows else 0
            for column in headers
        },
        "license_expiration_min": min((item.license_expires_on for item in parsed if item.license_expires_on), default=None),
        "license_expiration_max": max((item.license_expires_on for item in parsed if item.license_expires_on), default=None),
        "expired_before_rundate": sum(
            1
            for item in parsed
            if item.license_expires_on and item.run_date and item.license_expires_on < item.run_date
        ),
        "geo_anomalies": sum(1 for item in parsed if item.latitude is None or item.longitude is None),
        "home_health_agencies": sum(1 for item in parsed if item.facility_type_canonical == "NJ_HHA"),
        "hospice_programs": sum(1 for item in parsed if item.facility_type_canonical == "NJ_HOSPICE_PROGRAM"),
        "hospice_branches": sum(1 for item in parsed if item.facility_type_canonical == "NJ_HOSPICE_BRANCH"),
        "hospice_inpatient": sum(1 for item in parsed if item.facility_type_canonical == "NJ_HOSPICE_INPATIENT"),
        "adapter_version": ADAPTER_VERSION,
    }


def build_report(
    parsed: list[NjAcuteFacilityRow],
    quarantined: list[dict[str, str]],
    matches: list[NjMatch],
    *,
    payload: bytes,
    schema_fp: str,
    sheets: list[str],
    retrieved_at: datetime,
    dry_run: bool,
    net_new: int = 0,
    updated: int = 0,
    unchanged: int = 0,
    existing_enriched: int = 0,
    cms_only: int = 0,
    service_area_status: str = "SOURCE_ACCESS_BLOCKED",
) -> NjAcuteIngestReport:
    buckets = Counter(item.bucket for item in matches)
    auto = sum(1 for item in matches if item.bucket in {"EXACT", "HIGH_CONFIDENCE"})
    return NjAcuteIngestReport(
        adapter_version=ADAPTER_VERSION,
        dataset_key=DATASET_KEY,
        landing_url=LANDING_URL,
        source_url=SOURCE_URL,
        retrieved_at=retrieved_at.isoformat(),
        source_as_of=next((item.run_date.isoformat() for item in parsed if item.run_date), None),
        content_sha256=hashlib.sha256(payload).hexdigest(),
        file_size_bytes=len(payload),
        schema_fingerprint=schema_fp,
        worksheet_names=sheets,
        source_rows=len(parsed) + len(quarantined),
        distinct_source_facility_ids=len({item.source_facility_id for item in parsed}),
        distinct_license_numbers=len({item.license_number for item in parsed}),
        rows_by_raw_type=dict(Counter(item.facility_type_raw for item in parsed)),
        rows_by_canonical_type=dict(Counter(item.facility_type_canonical for item in parsed)),
        home_health_agencies=sum(1 for item in parsed if item.facility_type_canonical == "NJ_HHA"),
        hospice_programs=sum(1 for item in parsed if item.facility_type_canonical == "NJ_HOSPICE_PROGRAM"),
        hospice_branches=sum(1 for item in parsed if item.facility_type_canonical == "NJ_HOSPICE_BRANCH"),
        hospice_inpatient=sum(1 for item in parsed if item.facility_type_canonical == "NJ_HOSPICE_INPATIENT"),
        other_acute_classes=sum(
            1
            for item in parsed
            if item.facility_type_canonical not in HHA_TYPES | HOSPICE_TYPES
        ),
        unknown_types=dict(
            Counter(
                str(item.get("FACILITY_TYPE") or "")
                for item in quarantined
                if str(item.get("_reason") or "").startswith("unknown")
            )
        ),
        quarantined_rows=len(quarantined),
        exact=buckets.get("EXACT", 0),
        high_confidence=buckets.get("HIGH_CONFIDENCE", 0),
        review_required=buckets.get("REVIEW_REQUIRED", 0),
        conflicts=buckets.get("CONFLICT", 0),
        unresolved=buckets.get("UNRESOLVED", 0),
        unsafe_rejected=buckets.get("UNSAFE_REJECTED", 0),
        state_only=max(0, len(parsed) - auto),
        cms_only=cms_only,
        net_new=net_new,
        updated=updated,
        unchanged=unchanged,
        existing_enriched=existing_enriched,
        duplicate_licenses=max(0, len(parsed) - len({item.license_number for item in parsed})),
        missing_county=sum(1 for item in parsed if not item.county),
        invalid_county=sum(1 for item in parsed if (item.county or "").upper() not in NJ_COUNTIES),
        missing_address=sum(1 for item in parsed if not item.street),
        expired_before_rundate=sum(
            1
            for item in parsed
            if item.license_expires_on and item.run_date and item.license_expires_on < item.run_date
        ),
        geo_anomalies=sum(1 for item in parsed if item.latitude is None or item.longitude is None),
        baseline_only=True,
        public_eligible=False,
        dry_run=dry_run,
        mode="dry-run" if dry_run else "execute",
        service_area_status=service_area_status,
        notes=[
            "First snapshot is baseline-only; no historical alerts are generated.",
            "public_eligible remains false. No /new-jersey page or sitemap changes.",
            "All_Acute identities are stored under dataset_key nj-doh-all-acute and do not overwrite All_LTC.",
            "Physical office county is stored as PHYSICAL_LOCATION, never as full-county service.",
            "Home Health Agency county search returns office location; counties served require the facility listing.",
            "Hospice Program, Branch, and Inpatient counts are never combined.",
            "Non-senior acute classes remain internal-only.",
        ],
    )


def match_rows(
    parsed: list[NjAcuteFacilityRow],
    hh_universe: list[CanonicalCmsFacility],
    hospice_universe: list[CanonicalCmsFacility],
) -> list[NjMatch]:
    matches: list[NjMatch] = []
    for row in parsed:
        if row.cms_crosswalk_class == "home_health":
            matches.append(match_home_health(row, hh_universe))
        elif row.cms_crosswalk_class == "hospice":
            matches.append(match_hospice(row, hospice_universe))
        else:
            matches.append(
                NjMatch(
                    "UNRESOLVED",
                    "non_cms_class",
                    "Official NJDOH acute type is not a CMS Home Health or Hospice class",
                    None,
                    0,
                )
            )
    return matches


__all__ = [
    "ADAPTER_VERSION",
    "DATASET_KEY",
    "LANDING_URL",
    "SOURCE_URL",
    "TYPE_MAP",
    "NjAcuteFacilityRow",
    "NjAcuteIngestReport",
    "NjDohSchemaError",
    "NjMatch",
    "branch_parent_links",
    "build_report",
    "fetch_official_workbook",
    "identity_from_acute",
    "identity_state_for",
    "inspect_payload",
    "map_facility_type",
    "match_home_health",
    "match_hospice",
    "match_rows",
    "parse_acute_rows",
    "parse_acute_xlsx",
    "physical_location_areas",
    "probe_service_area_page",
]
