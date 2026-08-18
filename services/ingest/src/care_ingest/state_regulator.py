"""Reusable state-regulator adapter contract for Task 015A/015B.

No production state claims are written here. Adapters emit observations only.
CMS CCN remains canonical; state evidence never overwrites CMS source rows.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum
from importlib.resources import files
from typing import Any, Protocol
from urllib.parse import urlparse

from .facility_intelligence import FacilitySourceObservation, SourceAuthority


class StateClaimType(StrEnum):
    STATE_LICENSE_ID = "STATE_LICENSE_ID"
    STATE_LICENSE_STATUS = "STATE_LICENSE_STATUS"
    STATE_LICENSE_TYPE = "STATE_LICENSE_TYPE"
    STATE_LICENSE_ISSUE_DATE = "STATE_LICENSE_ISSUE_DATE"
    STATE_LICENSE_EXPIRATION_DATE = "STATE_LICENSE_EXPIRATION_DATE"
    STATE_LICENSE_CAPACITY = "STATE_LICENSE_CAPACITY"
    STATE_LICENSEE = "STATE_LICENSEE"
    STATE_OPERATOR = "STATE_OPERATOR"
    STATE_MANAGEMENT_ENTITY = "STATE_MANAGEMENT_ENTITY"
    STATE_ADMINISTRATOR = "STATE_ADMINISTRATOR"
    STATE_INSPECTION = "STATE_INSPECTION"
    STATE_COMPLAINT = "STATE_COMPLAINT"
    STATE_ENFORCEMENT_ACTION = "STATE_ENFORCEMENT_ACTION"
    STATE_FINE = "STATE_FINE"
    STATE_ORDER = "STATE_ORDER"
    STATE_RESTRICTION = "STATE_RESTRICTION"
    STATE_CLOSURE_ACTION = "STATE_CLOSURE_ACTION"
    STATE_OWNERSHIP_CHANGE = "STATE_OWNERSHIP_CHANGE"


@dataclass(frozen=True, slots=True)
class StateRegulatorSource:
    state_code: str
    dataset_key: str
    regulator: str
    official_name: str
    official_landing_page: str
    download_or_api_url: str
    access_mechanism: str
    update_cadence: str
    automation_difficulty: str
    cms_reconciliation: str
    assisted_living_same_ecosystem: bool
    implemented: bool
    notes: str


@dataclass(frozen=True, slots=True)
class StateLicenseRecord:
    """Normalized facility/license identity from a state regulator."""

    state_code: str
    source_record_identifier: str
    facility_name: str | None
    license_id: str | None
    license_status: str | None
    license_type: str | None
    cms_ccn: str | None
    address: str | None
    city: str | None
    zip_code: str | None
    phone: str | None
    licensee: str | None
    operator_name: str | None
    administrator: str | None
    capacity: int | None
    issue_date: date | None
    expiration_date: date | None
    source_url: str | None
    raw: dict[str, Any]


@dataclass(frozen=True, slots=True)
class CanonicalCmsFacility:
    cms_ccn: str
    name: str
    address: str | None
    city: str | None
    state: str
    zip_code: str | None
    phone: str | None


@dataclass(frozen=True, slots=True)
class StateCmsBridge:
    state: str
    reason: str
    matched_on: tuple[str, ...]


class StateRegulatorAdapter(Protocol):
    source: StateRegulatorSource
    adapter_version: str

    def discover_source(self) -> StateRegulatorSource: ...

    def parse_records(
        self, payload: bytes, release_identifier: str
    ) -> list[StateLicenseRecord]: ...

    def emit_observations(
        self,
        record: StateLicenseRecord,
        retrieved_at: datetime,
        release_identifier: str,
    ) -> list[FacilitySourceObservation]: ...

    def resolve_against_canonical_cms(
        self, record: StateLicenseRecord, cms: CanonicalCmsFacility
    ) -> StateCmsBridge: ...


def load_state_regulator_sources() -> tuple[StateRegulatorSource, ...]:
    resource = files("care_ingest.resources").joinpath("state_regulator_sources.json")
    payload: dict[str, Any] = json.loads(resource.read_text(encoding="utf-8"))
    if payload.get("registry_version") != 1:
        raise ValueError("unsupported state regulator registry version")
    sources = tuple(StateRegulatorSource(**entry) for entry in payload.get("sources", []))
    validate_state_regulator_sources(sources)
    return sources


def validate_state_regulator_sources(sources: tuple[StateRegulatorSource, ...]) -> None:
    if len(sources) != 8:
        raise ValueError("015A registry must contain exactly the eight discovery states")
    keys = [source.dataset_key for source in sources]
    if len(keys) != len(set(keys)):
        raise ValueError("state dataset keys must be unique")
    if any(source.implemented for source in sources):
        raise ValueError("015A must not mark state adapters implemented")
    for source in sources:
        if not re.fullmatch(r"[A-Z]{2}", source.state_code):
            raise ValueError(f"invalid state code: {source.state_code}")
        for url in (source.official_landing_page, source.download_or_api_url):
            parsed = urlparse(url)
            if parsed.scheme not in {"https", "http"} or not parsed.hostname:
                raise ValueError(f"invalid official URL: {url}")
            if "cms.gov" in parsed.hostname or "google." in parsed.hostname:
                raise ValueError(
                    f"state registry must not use CMS or Google as a state source: {url}"
                )


def get_state_regulator_source(dataset_key: str) -> StateRegulatorSource:
    try:
        return next(
            source for source in load_state_regulator_sources() if source.dataset_key == dataset_key
        )
    except StopIteration as error:
        raise KeyError(f"unknown state dataset key: {dataset_key}") from error


def _digits(value: str | None) -> str:
    return re.sub(r"\D", "", value or "")


def _norm_name(value: str | None) -> str:
    cleaned = re.sub(r"[^a-z0-9]+", " ", (value or "").lower())
    cleaned = re.sub(r"\b(llc|inc|corp|co|ltd|the)\b", " ", cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def _norm_address(value: str | None) -> str:
    cleaned = re.sub(r"\.", "", (value or "").lower())
    cleaned = re.sub(
        r"\b(street|st|avenue|ave|road|rd|drive|dr|boulevard|blvd|lane|ln|suite|ste|unit)\b",
        " ",
        cleaned,
    )
    return re.sub(r"[^a-z0-9]+", " ", cleaned).strip()


def resolve_against_canonical_cms(
    record: StateLicenseRecord, cms: CanonicalCmsFacility
) -> StateCmsBridge:
    """Deterministic CMS bridge. Name similarity alone never verifies."""
    if record.state_code.upper() != cms.state.upper():
        return StateCmsBridge(
            "REJECTED",
            "State record is outside the CMS facility jurisdiction",
            (),
        )
    state_ccn = (record.cms_ccn or "").strip().upper()
    if state_ccn and state_ccn == cms.cms_ccn.strip().upper():
        return StateCmsBridge("VERIFIED", "State source supplied the same CMS CCN", ("cms_ccn",))

    matched: list[str] = []
    if _norm_address(record.address) and _norm_address(record.address) == _norm_address(
        cms.address
    ):
        matched.append("address")
    if (record.zip_code or "")[:5] and (record.zip_code or "")[:5] == (cms.zip_code or "")[:5]:
        matched.append("zip")
    if _norm_name(record.city) and _norm_name(record.city) == _norm_name(cms.city):
        matched.append("city")
    phone_a, phone_b = _digits(record.phone)[-10:], _digits(cms.phone)[-10:]
    if len(phone_a) == 10 and phone_a == phone_b:
        matched.append("phone")
    if _norm_name(record.facility_name) and _norm_name(record.facility_name) == _norm_name(
        cms.name
    ):
        matched.append("name")

    if (
        "address" in matched
        and ("zip" in matched or "city" in matched)
        and ("phone" in matched or "name" in matched)
    ):
        return StateCmsBridge(
            "VERIFIED",
            "Exact address plus independent city/ZIP and name or phone corroboration",
            tuple(matched),
        )
    if "address" in matched and ("zip" in matched or "city" in matched):
        return StateCmsBridge(
            "PROBABLE",
            "Exact address and locality match without a second independent identifier",
            tuple(matched),
        )
    if "name" in matched and "address" not in matched:
        return StateCmsBridge(
            "REVIEW_REQUIRED",
            "Name agreement without a deterministic location or CCN bridge",
            tuple(matched),
        )
    if not matched:
        return StateCmsBridge("UNRESOLVED", "No overlapping identity evidence", ())
    return StateCmsBridge(
        "REVIEW_REQUIRED",
        "Partial identity overlap is not sufficient for a state-license relationship",
        tuple(matched),
    )


def observations_from_license_record(
    record: StateLicenseRecord,
    *,
    source: StateRegulatorSource,
    retrieved_at: datetime,
    release_identifier: str,
    adapter_version: str,
    cms_ccn: str | None = None,
) -> list[FacilitySourceObservation]:
    """Emit typed observations. Does not write CMS source evidence."""
    fields: list[tuple[StateClaimType, str | None]] = [
        (StateClaimType.STATE_LICENSE_ID, record.license_id),
        (StateClaimType.STATE_LICENSE_STATUS, record.license_status),
        (StateClaimType.STATE_LICENSE_TYPE, record.license_type),
        (StateClaimType.STATE_LICENSEE, record.licensee),
        (StateClaimType.STATE_OPERATOR, record.operator_name),
        (StateClaimType.STATE_ADMINISTRATOR, record.administrator),
        (
            StateClaimType.STATE_LICENSE_CAPACITY,
            str(record.capacity) if record.capacity is not None else None,
        ),
    ]
    observations: list[FacilitySourceObservation] = []
    for claim_type, value in fields:
        if not value:
            continue
        observations.append(
            FacilitySourceObservation(
                source_type=source.dataset_key,
                source_authority=SourceAuthority.STATE_HEALTHCARE_REGULATOR,
                source_identifier=source.dataset_key,
                source_record_identifier=record.source_record_identifier,
                observation_type=claim_type.value,
                observed_value=value,
                normalized_value=value.casefold(),
                observed_at=None,
                source_published_at=None,
                retrieved_at=retrieved_at,
                source_reference=record.source_url or source.official_landing_page,
                release_identifier=release_identifier,
                adapter_version=adapter_version,
                canonical_ccn=cms_ccn,
                state_code=record.state_code,
                state_license_identifier=record.license_id,
                license_type=record.license_type,
                license_status=record.license_status,
                issue_date=record.issue_date,
                expiration_date=record.expiration_date,
                operator_name=record.operator_name,
                legal_entity_name=record.licensee,
                capacity=record.capacity,
                address=record.address,
                provenance={"claim_type": claim_type.value, "state": record.state_code},
            )
        )
    return observations
