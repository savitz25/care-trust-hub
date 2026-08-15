from care_ingest.ownership import normalize_ownership_row


def test_official_identifier_survives_name_change_without_name_merge() -> None:
    first = normalize_ownership_row(
        "skilled-nursing-facility-enrollments",
        {
            "CCN": "015001",
            "ASSOCIATE ID": "1234567890",
            "ENROLLMENT ID": "O20200101000001",
            "ORGANIZATION NAME": "OLD LEGAL NAME LLC",
        },
        2,
    )
    renamed = normalize_ownership_row(
        "skilled-nursing-facility-enrollments",
        {
            "CCN": "015001",
            "ASSOCIATE ID": "1234567890",
            "ENROLLMENT ID": "O20200101000001",
            "ORGANIZATION NAME": "NEW LEGAL NAME LLC",
        },
        2,
    )
    same_name_different_id = normalize_ownership_row(
        "skilled-nursing-facility-enrollments",
        {
            "CCN": "015002",
            "ASSOCIATE ID": "9999999999",
            "ENROLLMENT ID": "O20200101000002",
            "ORGANIZATION NAME": "NEW LEGAL NAME LLC",
        },
        3,
    )
    assert first["organization_pac_id"] == renamed["organization_pac_id"]
    assert renamed["organization_pac_id"] != same_name_different_id["organization_pac_id"]


def test_individual_owner_is_not_an_organization_and_roles_are_preserved() -> None:
    record = normalize_ownership_row(
        "skilled-nursing-facility-all-owners",
        {
            "ENROLLMENT ID": "O20200101000001",
            "ASSOCIATE ID - OWNER": "1111111111",
            "TYPE - OWNER": "I",
            "ROLE CODE - OWNER": "34",
            "ROLE TEXT - OWNER": "5% OR GREATER DIRECT OWNERSHIP INTEREST",
            "ASSOCIATION DATE - OWNER": "2020-01-01",
            "FIRST NAME - OWNER": "JANE",
            "LAST NAME - OWNER": "DOE",
            "PERCENTAGE OWNERSHIP": "25",
            "PRIVATE EQUITY COMPANY - OWNER": "N",
            "REIT - OWNER": "N",
        },
        2,
    )
    assert record["party_kind"] == "individual"
    assert record["role_code"] == "34"
    assert record["ownership_percentage"] == 25
    assert record["classifications"]["private_equity_company"] is False
    assert record["classifications"]["reit"] is False


def test_source_flags_are_never_inferred_from_names() -> None:
    record = normalize_ownership_row(
        "skilled-nursing-facility-all-owners",
        {
            "ENROLLMENT ID": "O20200101000001",
            "ASSOCIATE ID - OWNER": "2222222222",
            "TYPE - OWNER": "O",
            "ROLE TEXT - OWNER": "MANAGING CONTROL",
            "ORGANIZATION NAME - OWNER": "EXAMPLE PRIVATE EQUITY REIT LLC",
            "PRIVATE EQUITY COMPANY - OWNER": "N",
            "REIT - OWNER": "N",
        },
        2,
    )
    assert record["classifications"]["private_equity_company"] is False
    assert record["classifications"]["reit"] is False


def test_chow_preserves_buyer_seller_and_effective_date() -> None:
    record = normalize_ownership_row(
        "skilled-nursing-facility-change-of-ownership",
        {
            "CCN - BUYER": "015001",
            "ASSOCIATE ID - BUYER": "1234567890",
            "ORGANIZATION NAME - BUYER": "BUYER LLC",
            "ASSOCIATE ID - SELLER": "0987654321",
            "ORGANIZATION NAME - SELLER": "SELLER LLC",
            "CHOW TYPE CODE": "CH",
            "CHOW TYPE TEXT": "CHANGE OF OWNERSHIP",
            "EFFECTIVE DATE": "2025-05-01",
        },
        2,
    )
    assert record["buyer_pac_id"] == "1234567890"
    assert record["seller_pac_id"] == "0987654321"
    assert record["effective_date"] == "2025-05-01"
