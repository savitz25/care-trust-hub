from care_ingest.ownership_portfolio import (
    DELETE_STALE_MEMBERS_SQL,
    DELETE_STALE_PORTFOLIOS_SQL,
    DERIVATION_VERSION,
    HIGH_VALUE_FINE_USD,
    OWNERSHIP_DATASET_KEYS,
    UPSERT_MEMBERS_SQL,
    UPSERT_PORTFOLIOS_SQL,
)


def test_portfolio_sql_is_idempotent_versioned_and_cms_only() -> None:
    assert DERIVATION_VERSION == "ownership-portfolio-v1"
    assert HIGH_VALUE_FINE_USD == 10_000
    assert "nursing-home-ownership" in OWNERSHIP_DATASET_KEYS
    for sql in (UPSERT_MEMBERS_SQL, UPSERT_PORTFOLIOS_SQL):
        assert "ON CONFLICT" in sql
        assert "DO UPDATE" in sql
        assert "fingerprint" in sql
        assert "http" not in sql.lower()
        assert "google" not in sql.lower()
        assert "secretary of state" not in sql.lower()
    assert "membership_status" in UPSERT_MEMBERS_SQL
    assert "'current'" in UPSERT_MEMBERS_SQL
    assert "'historical'" in UPSERT_MEMBERS_SQL
    assert "IN (SELECT release_id FROM latest)" in UPSERT_MEMBERS_SQL
    assert "publication_eligible" in UPSERT_PORTFOLIOS_SQL
    assert "REVIEW_REQUIRED" in UPSERT_PORTFOLIOS_SQL
    assert "recent_cms_penalty" in UPSERT_PORTFOLIOS_SQL
    assert "complaint" in UPSERT_PORTFOLIOS_SQL
    assert "NOT EXISTS" in DELETE_STALE_MEMBERS_SQL
    assert "NOT EXISTS" in DELETE_STALE_PORTFOLIOS_SQL
    assert "fuzzy" not in UPSERT_MEMBERS_SQL.lower()


def test_portfolio_sql_does_not_collapse_roles_or_invent_acquisitions() -> None:
    assert "acquired" not in UPSERT_PORTFOLIOS_SQL.lower()
    assert "beneficial" not in UPSERT_PORTFOLIOS_SQL.lower()
    assert "trust score" not in UPSERT_PORTFOLIOS_SQL.lower()
    assert "relationship_roles" in UPSERT_MEMBERS_SQL
    assert "organization_id IS NOT NULL" in UPSERT_MEMBERS_SQL
