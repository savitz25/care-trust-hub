import json

from care_ingest.state_regulator import (
    CanonicalCmsFacility,
    StateLicenseRecord,
    match_against_cms_universe,
    normalize_ccn,
)
from care_ingest.state_regulator_adapters import (
    StateSourceFormatError,
    parse_california_records,
    parse_new_york_records,
    parse_texas_records,
)


def test_normalize_ccn_pads_and_rejects_invalid() -> None:
    assert normalize_ccn("555120") == "555120"
    assert normalize_ccn(55120) == "055120"
    assert normalize_ccn("not-a-ccn") is None
    assert normalize_ccn("") is None


def test_california_parser_keeps_snf_and_uses_explicit_ccn() -> None:
    payload = json.dumps(
        {
            "records": [
                {
                    "FACID": "010000001",
                    "CCN": "555120",
                    "FACNAME": "VINEYARD POST ACUTE",
                    "FAC_TYPE_CODE": "SNF",
                    "ADDRESS": "101 MONROE ST",
                    "CITY": "PETALUMA",
                    "ZIP": "94954",
                    "LICENSE_NUMBER": "10000102",
                    "LICENSE_STATUS_DESCRIPTION": "ACTIVE",
                    "BUSINESS_NAME": "PETALUMAIDENCE OPCO, LLC",
                    "FACADMIN": "BILLS, KEVAN",
                    "CAPACITY": 99,
                },
                {
                    "FACID": "hospital-1",
                    "CCN": "050001",
                    "FACNAME": "GENERAL HOSPITAL",
                    "FAC_TYPE_CODE": "GACH",
                    "ADDRESS": "1 HOSPITAL WAY",
                    "CITY": "OAKLAND",
                },
            ]
        }
    ).encode()
    records = parse_california_records(payload)
    assert len(records) == 1
    assert records[0].cms_ccn == "555120"
    assert records[0].license_status == "ACTIVE"
    assert records[0].administrator == "BILLS, KEVAN"


def test_california_missing_columns_fail_closed() -> None:
    try:
        parse_california_records(b'{"records":[{"name":"x"}]}')
    except StateSourceFormatError:
        return
    raise AssertionError("expected parser failure")


def test_new_york_parser_uses_address_and_rejects_non_snf() -> None:
    payload = json.dumps(
        {
            "general": [
                {
                    "fac_id": "472",
                    "facility_name": "Hamilton Manor Nursing Home",
                    "description": "Residential Health Care Facility - SNF",
                    "address1": "1172 Long Pond Road",
                    "city": "Rochester",
                    "fac_zip": "14626",
                    "fac_phone": "5852250450",
                    "opcert_num": "2701364N",
                    "operator_name": "Hamilton Manor Nursing Home, LLC",
                },
                {
                    "fac_id": "1",
                    "facility_name": "Adult Home Example",
                    "description": "Adult Home",
                    "address1": "1 Main",
                    "city": "Albany",
                },
            ],
            "certification": [
                {
                    "fac_id": "472",
                    "attribute_type": "Bed",
                    "measure_value": "120",
                }
            ],
        }
    ).encode()
    records = parse_new_york_records(payload)
    assert len(records) == 1
    assert records[0].license_id == "2701364N"
    assert records[0].cms_ccn is None
    assert records[0].capacity == 120
    assert records[0].operator_name == "Hamilton Manor Nursing Home, LLC"


def test_new_york_name_only_never_verifies() -> None:
    record = StateLicenseRecord(
        state_code="NY",
        source_record_identifier="1",
        facility_name="Hamilton Manor Nursing Home",
        license_id="2701364N",
        license_status=None,
        license_type="SNF",
        cms_ccn=None,
        address="999 Other Road",
        city="Rochester",
        zip_code="14626",
        phone=None,
        licensee=None,
        operator_name=None,
        administrator=None,
        management_company=None,
        capacity=None,
        issue_date=None,
        expiration_date=None,
        source_url=None,
        raw={},
    )
    universe = [
        CanonicalCmsFacility(
            "335001",
            "Hamilton Manor Nursing Home",
            "1172 Long Pond Road",
            "Rochester",
            "NY",
            "14626",
            "5852250450",
        )
    ]
    match = match_against_cms_universe(record, universe)
    assert match.state == "REVIEW_REQUIRED"


def test_new_york_address_and_phone_verify_and_ambiguity_stays_review() -> None:
    record = StateLicenseRecord(
        state_code="NY",
        source_record_identifier="472",
        facility_name="Hamilton Manor Nursing Home",
        license_id="2701364N",
        license_status=None,
        license_type="SNF",
        cms_ccn=None,
        address="1172 Long Pond Road",
        city="Rochester",
        zip_code="14626",
        phone="5852250450",
        licensee=None,
        operator_name=None,
        administrator=None,
        management_company=None,
        capacity=120,
        issue_date=None,
        expiration_date=None,
        source_url=None,
        raw={},
    )
    one = CanonicalCmsFacility(
        "335001",
        "Hamilton Manor Nursing Home",
        "1172 Long Pond Road",
        "Rochester",
        "NY",
        "14626",
        "5852250450",
    )
    assert match_against_cms_universe(record, [one]).state == "VERIFIED"
    twin = CanonicalCmsFacility(
        "335002",
        "Hamilton Manor Annex",
        "1172 Long Pond Road",
        "Rochester",
        "NY",
        "14626",
        "5852250450",
    )
    assert match_against_cms_universe(record, [one, twin]).state == "REVIEW_REQUIRED"


def test_texas_parser_and_invalid_ccn_is_ignored() -> None:
    csv = (
        b"Facility Name,Address,City,Zip,Phone,License Number,CCN,Beds,Licensee\n"
        b"Example NF,100 Main St,Austin,78701,5125550100,TX-1,not-a-ccn,80,Example LLC\n"
        b"Second NF,200 Oak Ave,Dallas,75201,2145550100,TX-2,675001,100,Other LLC\n"
    )
    records = parse_texas_records(csv)
    assert len(records) == 2
    assert records[0].cms_ccn is None
    assert records[1].cms_ccn == "675001"
    assert records[1].capacity == 100


def test_texas_title_row_is_skipped() -> None:
    rows = [
        {"title": "Directory of Nursing Facilities with an Active License", "column_1": ""},
        {
            "title": "Facility Name",
            "column_1": "Physical Address",
            "column_2": "Physical Address CITY",
            "column_3": "Medicare Provider Number",
            "column_4": "Total Licensed Capacity",
            "column_5": "License No",
        },
        {
            "title": "Oak Grove NF",
            "column_1": "10 Main St",
            "column_2": "Houston",
            "column_3": "675010",
            "column_4": "90",
            "column_5": "147890",
        },
    ]
    from care_ingest.state_regulator_adapters import _promote_header_row, parse_texas_records

    promoted = _promote_header_row(rows)
    payload = (
        b"Facility Name,Physical Address,Physical Address CITY,Medicare Provider Number,"
        b"Total Licensed Capacity,License No\n"
        b"Oak Grove NF,10 Main St,Houston,675010,90,147890\n"
    )
    records = parse_texas_records(payload)
    assert records[0].cms_ccn == "675010"
    assert records[0].license_id == "147890"
    assert promoted[0]["Facility Name"] == "Oak Grove NF"
