import json
from datetime import UTC, datetime
from pathlib import Path

from care_ingest.state_regulator import (
    CanonicalCmsFacility,
    StateClaimType,
    StateLicenseRecord,
    get_state_regulator_source,
    load_state_regulator_sources,
    observations_from_license_record,
    resolve_against_canonical_cms,
)


def _ca_record() -> StateLicenseRecord:
    payload = json.loads(
        Path(__file__)
        .parent.joinpath("fixtures/ca_cdph_facility_sample.json")
        .read_text(encoding="utf-8")
    )["record"]
    return StateLicenseRecord(
        state_code="CA",
        source_record_identifier=str(payload["FACID"]),
        facility_name=payload["FACNAME"],
        license_id=str(payload["LICENSE_NUMBER"]),
        license_status=payload["LICENSE_STATUS_DESCRIPTION"],
        license_type=payload["FAC_TYPE_CODE"],
        cms_ccn=payload["CCN"],
        address=payload["ADDRESS"],
        city=payload["CITY"],
        zip_code=str(payload["ZIP"]),
        phone=payload["CONTACT_PHONE_NUMBER"],
        licensee=payload["BUSINESS_NAME"],
        operator_name=None,
        administrator=payload["FACADMIN"],
        capacity=payload["CAPACITY"],
        issue_date=None,
        expiration_date=None,
        source_url="https://data.chhs.ca.gov/dataset/healthcare-facility-locations",
        raw=payload,
    )


def test_discovery_registry_covers_eight_unimplemented_states() -> None:
    sources = load_state_regulator_sources()
    assert {source.state_code for source in sources} == {
        "CA",
        "NY",
        "TX",
        "NC",
        "FL",
        "PA",
        "OH",
        "NJ",
    }
    assert all(not source.implemented for source in sources)
    california = get_state_regulator_source("ca-cdph-healthcare-facility-locations")
    assert california.cms_reconciliation == "EXCELLENT"
    assert california.automation_difficulty == "LOW"


def test_official_ca_sample_verifies_against_cms_ccn() -> None:
    record = _ca_record()
    cms = CanonicalCmsFacility(
        cms_ccn="555120",
        name="Vineyard Post Acute",
        address="101 Monroe Street",
        city="Petaluma",
        state="CA",
        zip_code="94954",
        phone="7077634109",
    )
    bridge = resolve_against_canonical_cms(record, cms)
    assert bridge.state == "VERIFIED"
    assert bridge.matched_on == ("cms_ccn",)


def test_name_only_overlap_stays_under_review() -> None:
    record = _ca_record()
    cms = CanonicalCmsFacility(
        cms_ccn="999999",
        name="Vineyard Post Acute",
        address="500 Other Road",
        city="Oakland",
        state="CA",
        zip_code="94601",
        phone="5105550100",
    )
    nameless_ccn = StateLicenseRecord(
        state_code=record.state_code,
        source_record_identifier=record.source_record_identifier,
        facility_name=record.facility_name,
        license_id=record.license_id,
        license_status=record.license_status,
        license_type=record.license_type,
        cms_ccn=None,
        address="1 Unrelated Way",
        city=record.city,
        zip_code="90001",
        phone=None,
        licensee=record.licensee,
        operator_name=record.operator_name,
        administrator=record.administrator,
        capacity=record.capacity,
        issue_date=record.issue_date,
        expiration_date=record.expiration_date,
        source_url=record.source_url,
        raw=record.raw,
    )
    bridge = resolve_against_canonical_cms(nameless_ccn, cms)
    assert bridge.state == "REVIEW_REQUIRED"


def test_observations_are_state_authority_and_do_not_invent_cms_rows() -> None:
    record = _ca_record()
    source = get_state_regulator_source("ca-cdph-healthcare-facility-locations")
    observations = observations_from_license_record(
        record,
        source=source,
        retrieved_at=datetime(2026, 8, 18, tzinfo=UTC),
        release_identifier="ca-cdph-2026-08-17",
        adapter_version="state-regulator-v0",
        cms_ccn="555120",
    )
    types = {item.observation_type for item in observations}
    assert StateClaimType.STATE_LICENSE_STATUS.value in types
    assert StateClaimType.STATE_LICENSEE.value in types
    assert all(item.source_authority.value == "state_healthcare_regulator" for item in observations)
    assert all(item.canonical_ccn == "555120" for item in observations)
