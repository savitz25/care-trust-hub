import pytest

from care_ingest.chain import normalize_chain_row


def sample():
    return {
        "Chain": "Example Chain",
        "Chain ID": "123",
        "Number of facilities": "7",
        "Number of states and territories with operations": "2",
        "Average staffing rating": "2.8",
        "Total number of fines": "0",
        "Percentage of facilities with an abuse icon": "",
        "Average overall 5-star rating": "3.1",
    }


def test_identity_name_change_null_and_zero():
    a = normalize_chain_row(sample(), 2, "2026-07-01")
    changed = sample()
    changed["Chain"] = "Renamed"
    b = normalize_chain_row(changed, 2, "2026-06-01")
    assert a["chain_id"] == b["chain_id"]
    assert a["metrics"]["Average staffing rating"] == "2.8"
    assert a["metrics"]["Total number of fines"] == "0"
    assert a["metrics"]["Percentage of facilities with an abuse icon"] is None


def test_invalid_rating_rejected():
    value = sample()
    value["Average staffing rating"] = "8"
    with pytest.raises(ValueError):
        normalize_chain_row(value, 2, "2026-07-01")
