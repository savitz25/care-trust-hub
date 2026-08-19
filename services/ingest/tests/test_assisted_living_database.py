import os
from pathlib import Path

import pytest

from care_ingest.assisted_living_database import persist_assisted_living_records, record_fingerprint
from care_ingest.assisted_living_pilot import (
    parse_california_rcfe,
    parse_new_york_acf,
    parse_texas_records,
)

DATABASE_URL = os.environ.get("CARE_DATABASE_URL")
MIGRATION = (
    Path(__file__).resolve().parents[3] / "db" / "migrations" / "0020_assisted_living_pilot.sql"
)


def test_record_fingerprint_is_stable_and_ignores_retrieved_at() -> None:
    record = {
        "external_key": "CA:CA_CDSS_CCL:015600001",
        "official_name": "EXAMPLE RCFE",
        "official_street": "1 MAIN ST",
        "official_city": "OAKLAND",
        "official_zip": "94612",
        "official_type": "RCFE",
        "consumer_category": "residential_care",
        "license_status": "LICENSED",
        "licensed_capacity": 40,
        "memory_designation": "not_reported",
        "identity_state": "VERIFIED",
        "publication_state": "PUBLISHABLE_CURRENT",
        "discovery_eligible": True,
        "source_fingerprint": "abc",
        "licensee": "EXAMPLE LICENSEE LLC",
        "retrieved_at": "2026-08-18T00:00:00Z",
    }
    first = record_fingerprint(record)
    record["retrieved_at"] = "2026-08-19T00:00:00Z"
    assert record_fingerprint(record) == first
    record["official_name"] = "RENAMED"
    assert record_fingerprint(record) != first


def test_migration_is_standalone_and_has_no_google() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    assert "CREATE TABLE assisted_living_provider" in sql
    assert "CREATE TABLE assisted_living_organization_party" in sql
    assert "REFERENCES provider(" not in sql
    assert "certified_beds" not in sql
    assert "GOOGLE_PLACES" not in sql
    assert "google" not in sql.lower()
    assert "PUBLISHABLE_CURRENT" in sql
    assert "HISTORICAL_ONLY" in sql


@pytest.mark.integration
def test_persist_is_idempotent_and_does_not_duplicate() -> None:
    if not DATABASE_URL:
        pytest.skip("CARE_DATABASE_URL is not configured")
    import psycopg

    with psycopg.connect(DATABASE_URL) as connection:
        exists = connection.execute(
            "SELECT to_regclass('public.assisted_living_provider')"
        ).fetchone()[0]
        if exists is None:
            pytest.skip("0020_assisted_living_pilot.sql is not applied")

    ca = parse_california_rcfe(
        "\n".join(
            [
                "facility_type,facility_number,facility_name,licensee,"
                "facility_administrator,facility_telephone_number,facility_address,"
                "facility_city,facility_state,facility_zip,facility_capacity,"
                "facility_status,license_first_date",
                "RCFE,ZZTEST022A001,EXAMPLE RCFE,EXAMPLE LICENSEE LLC,JANE ADMIN,"
                "(510) 555-0100,1 MAIN ST,OAKLAND,CA,94612,40,LICENSED,1/1/2020",
                "RCFE,ZZTEST022A002,CLOSED RCFE,EXAMPLE LICENSEE LLC,JANE ADMIN,"
                "(510) 555-0100,2 MAIN ST,OAKLAND,CA,94612,8,CLOSED,1/1/2010",
            ]
        ),
        retrieved_at="2026-08-18T00:00:00Z",
    )
    ny = parse_new_york_acf(
        [
            {
                "fac_id": "ZZTEST022A901",
                "facility_name": "Example Adult Home",
                "description": "Adult Home",
                "address1": "10 State St",
                "city": "Albany",
                "fac_zip": "12207",
                "opcert_num": "0101000A",
                "operator_name": "Example Operator Inc",
            }
        ],
        [],
        retrieved_at="2026-08-18T00:00:00Z",
    )
    tx = parse_texas_records(
        [
            {
                "Facility Name": "EXAMPLE ALF",
                "Facility ID": "ZZTEST022A701",
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
    records = [*ca.records, *ny.records, *tx.records]
    keys = [item["external_key"] for item in records]
    with psycopg.connect(DATABASE_URL) as connection:
        connection.execute(
            "DELETE FROM assisted_living_provider WHERE external_key = ANY(%s)",
            (keys,),
        )
        connection.commit()
    try:
        first = persist_assisted_living_records(DATABASE_URL, records)
        second = persist_assisted_living_records(DATABASE_URL, records)
        assert first["inserted"] == 4
        assert first["google_places_requests"] == 0
        assert second["inserted"] == 0
        assert second["updated"] == 0
        assert second["unchanged"] == 4
        with psycopg.connect(DATABASE_URL) as connection:
            providers = connection.execute(
                "SELECT count(*) FROM assisted_living_provider WHERE external_key = ANY(%s)",
                (keys,),
            ).fetchone()[0]
            parties = connection.execute(
                """
                SELECT count(*)
                  FROM assisted_living_organization_party p
                  JOIN assisted_living_provider a ON a.id = p.provider_id
                 WHERE a.external_key = ANY(%s)
                """,
                (keys,),
            ).fetchone()[0]
            closed = connection.execute(
                """
                SELECT publication_state, discovery_eligible
                  FROM assisted_living_provider
                 WHERE source_facility_id = 'ZZTEST022A002'
                """
            ).fetchone()
            ny_status = connection.execute(
                """
                SELECT license_status_reported, license_status, source_directory_context
                  FROM assisted_living_provider
                 WHERE source_facility_id = 'ZZTEST022A901'
                """
            ).fetchone()
        assert providers == 4
        assert parties == 8
        assert closed == ("HISTORICAL_ONLY", False)
        assert ny_status == (False, None, "current_hfis_listing")
    finally:
        with psycopg.connect(DATABASE_URL) as connection:
            connection.execute(
                "DELETE FROM assisted_living_provider WHERE external_key = ANY(%s)",
                (keys,),
            )
            connection.commit()
