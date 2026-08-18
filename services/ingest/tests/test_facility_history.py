from care_ingest.facility_history import (
    DERIVATION_VERSION,
    INSPECTION_SQL,
    OWNERSHIP_SQL,
    PENALTY_SQL,
    RATING_SQL,
    STAFFING_SQL,
)


def test_history_sql_is_idempotent_and_versioned() -> None:
    for sql in (INSPECTION_SQL, PENALTY_SQL, OWNERSHIP_SQL, STAFFING_SQL, RATING_SQL):
        assert "ON CONFLICT (fingerprint) DO NOTHING" in sql
        assert "INSERT INTO facility_history_event" in sql
    assert DERIVATION_VERSION == "facility-history-v1"
    assert "Fire Safety Standard" not in INSPECTION_SQL or "fire safety standard" in INSPECTION_SQL
    assert "0.2" in STAFFING_SQL
    assert "STATE_" not in INSPECTION_SQL
