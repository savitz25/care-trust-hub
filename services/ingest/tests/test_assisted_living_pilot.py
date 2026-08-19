from care_ingest.assisted_living_pilot import (
    classify_memory,
    ingest_pilot_states,
    parse_california_rcfe,
    parse_new_york_acf,
    parse_texas_records,
    publication_eligible,
    resolve_identity,
)

CA_HEADER = (
    "facility_type,facility_number,facility_name,licensee,"
    "facility_administrator,facility_telephone_number,facility_address,"
    "facility_city,facility_state,facility_zip,facility_capacity,"
    "facility_status,license_first_date"
)
CA_CSV = "\n".join(
    [
        CA_HEADER,
        "RCFE,015600001,EXAMPLE RCFE,EXAMPLE LICENSEE LLC,JANE ADMIN,"
        "(510) 555-0100,1 MAIN ST,OAKLAND,CA,94612,40,LICENSED,1/1/2020",
        "RCFE,015600001,EXAMPLE RCFE DUP,EXAMPLE LICENSEE LLC,JANE ADMIN,"
        "(510) 555-0100,1 MAIN ST,OAKLAND,CA,94612,40,LICENSED,1/1/2020",
        "RCFE,,NAME ONLY FACILITY,,,,,OAKLAND,CA,94612,8,LICENSED,1/1/2020",
        "",
    ]
)


def test_identity_is_state_scoped_and_rejects_name_only() -> None:
    verified, _, key = resolve_identity("CA", "CA_CDSS_CCL", "015600001", "EXAMPLE RCFE")
    assert verified == "VERIFIED"
    assert key == "CA:CA_CDSS_CCL:015600001"
    review, reason, _ = resolve_identity("CA", "CA_CDSS_CCL", None, "Sunrise Memory Care")
    assert review == "REVIEW_REQUIRED"
    assert "Name without" in reason


def test_memory_is_never_inferred_from_name() -> None:
    assert classify_memory(facility_name="Sunrise Memory Care of Dallas") == "not_reported"
    assert (
        classify_memory(explicit="Special Needs Assisted Living Residence (SNALR)")
        == "explicit_memory_or_dementia_license"
    )


def test_california_parser_dedupes_and_keeps_licensee_separate() -> None:
    result = parse_california_rcfe(CA_CSV, retrieved_at="2026-08-18T00:00:00Z")
    assert result.raw_rows == 3
    assert len(result.records) == 2
    verified = next(item for item in result.records if item["source_facility_id"] == "015600001")
    assert verified["licensee"] == "EXAMPLE LICENSEE LLC"
    assert verified["operator"] is None
    assert verified["consumer_category"] == "residential_care"
    assert verified["licensed_capacity"] == 40
    assert verified["memory_designation"] == "not_reported"
    assert publication_eligible(verified) is True


def test_new_york_snalr_is_explicit_memory() -> None:
    general = [
        {
            "fac_id": "9001",
            "facility_name": "Example Adult Home",
            "description": "Adult Home",
            "address1": "10 State St",
            "city": "Albany",
            "fac_zip": "12207",
            "opcert_num": "0101000A",
            "operator_name": "Example Operator Inc",
        }
    ]
    certs = [
        {
            "fac_id": "9001",
            "attribute_value": "Special Needs Assisted Living Residence (SNALR)",
            "measure_value": "20",
        },
        {
            "fac_id": "9001",
            "attribute_value": "Overall Capacity (AH/EHP)",
            "measure_value": "80",
        },
    ]
    result = parse_new_york_acf(general, certs, retrieved_at="2026-08-18T00:00:00Z")
    record = result.records[0]
    assert record["memory_designation"] == "explicit_memory_or_dementia_license"
    assert record["consumer_category"] == "memory_supportive"
    assert record["licensed_capacity"] == 80
    assert record["operator"] == "Example Operator Inc"
    assert record["licensee"] is None


def test_texas_keeps_owner_and_management_separate() -> None:
    result = parse_texas_records(
        [
            {
                "Facility Name": "EXAMPLE ALF",
                "Facility ID": "000001",
                "Service Type": "TYPE A",
                "Facility Licensed": "YES",
                "License No": "100001",
                "Physical Address": "2 CONGRESS AVE",
                "Physical Address CITY": "AUSTIN",
                "Physical Address Zipcode": "78701",
                "Total Licensed Capacity": "24",
                "Alzheimer Certificate No": "ALZ-9",
                "Owner_": "EXAMPLE OWNER LLC",
                "Administrator": "PAT ADMIN",
                "Management Company_": "EXAMPLE MGMT",
            }
        ],
        retrieved_at="2026-08-18T00:00:00Z",
    )
    record = result.records[0]
    assert record["owner"] == "EXAMPLE OWNER LLC"
    assert record["management_company"] == "EXAMPLE MGMT"
    assert record["memory_designation"] == "specialty_endorsement"


def test_idempotent_pilot_ingest_and_no_google() -> None:
    report = ingest_pilot_states(
        ca_csv=CA_CSV,
        ny_general=[
            {
                "fac_id": "1",
                "facility_name": "AH",
                "description": "Adult Home",
                "address1": "1 Main",
                "city": "Troy",
                "fac_zip": "12180",
            }
        ],
        ny_certs=[],
        tx_rows=[
            {
                "Facility Name": "EXAMPLE ALF",
                "Facility ID": "000001",
                "Physical Address": "2 CONGRESS AVE",
                "Physical Address CITY": "AUSTIN",
                "Physical Address Zipcode": "78701",
            }
        ],
        retrieved_at="2026-08-18T00:00:00Z",
    )
    assert report["idempotent"] is True
    assert report["google_places_requests"] == 0
    assert report["states"]["CA"]["canonical_providers"] == 2
