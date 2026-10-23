from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from care_ingest.hh_hospice_chow import (
    EVENT_COLUMNS,
    HOLD_REASONS,
    OWNER_COLUMNS,
    ChowQaError,
    event_natural_key,
    read_cp1252_csv,
    sha256_bytes,
    stage_chow_files,
    stage_events,
    stage_owners,
)
from care_ingest.hh_hospice_chow_database import (
    EVENT_UPSERT_SQL,
    NOT_SEEN_SQL,
    OWNER_UPSERT_SQL,
    apply_chow_plan,
    guarded_sql,
)

EVENT_HEADER = ",".join(EVENT_COLUMNS)
OWNER_HEADER = ",".join(OWNER_COLUMNS)


def _event_row(**overrides: str) -> str:
    values = {
        "ENROLLMENT ID - BUYER": "B1",
        "ENROLLMENT ID - SELLER": "S1",
        "EFFECTIVE DATE": "01/15/2024",
        "CHOW TYPE CODE": "CH",
        "CHOW TYPE TEXT": "CHANGE OF OWNERSHIP",
        "CCN - BUYER": "123456",
        "CCN - SELLER": "123456",
        "NPI - BUYER": "1111111111",
        "NPI - SELLER": "2222222222",
        "PROVIDER TYPE CODE - BUYER": "00-06",
        "PROVIDER TYPE CODE - SELLER": "00-06",
        "PROVIDER TYPE TEXT - SELLER": "Home Health",
        "MULTIPLE NPI FLAG - BUYER": "N",
        "MULTIPLE NPI FLAG - SELLER": "N",
        "ORGANIZATION NAME - BUYER": "Buyer Org",
        "ORGANIZATION NAME - SELLER": "Seller Org",
    }
    values.update(overrides)
    return ",".join(values[column] for column in EVENT_COLUMNS)


def _owner_row(**overrides: str) -> str:
    values = {
        "ENROLLMENT ID": "B1",
        "ASSOCIATE ID - OWNER": "A1",
        "TYPE - OWNER": "O",
        "ROLE CODE - OWNER": "35",
        "ROLE TEXT - OWNER": "OWNER",
        "ORGANIZATION NAME - OWNER": "Owner Org",
        "FIRST NAME - OWNER": "",
        "LAST NAME - OWNER": "",
        "ASSOCIATION DATE - OWNER": "02/01/2024",
        "PERCENTAGE OWNERSHIP": "100",
    }
    values.update(overrides)
    return ",".join(values[column] for column in OWNER_COLUMNS)


def _write_pair(
    directory: Path, program: str, events: list[str], owners: list[str]
) -> tuple[Path, Path]:
    directory.mkdir(parents=True, exist_ok=True)
    event_path = directory / f"{program}_CHOW.csv"
    owner_path = directory / f"{program}_CHOW_Owners.csv"
    event_path.write_bytes((EVENT_HEADER + "\n" + "\n".join(events) + "\n").encode("cp1252"))
    owner_path.write_bytes((OWNER_HEADER + "\n" + "\n".join(owners) + "\n").encode("cp1252"))
    return event_path, owner_path


def _stage(
    tmp_path: Path, hh_events: list[str], hospice_events: list[str], identifiers: list[dict]
):
    hh_e, hh_o = _write_pair(tmp_path, "HH", hh_events, [_owner_row()])
    ho_e, ho_o = _write_pair(
        tmp_path / "hospice" if False else tmp_path,
        "HOSPICE",
        hospice_events,
        [_owner_row(ENROLLMENT_ID="H1")],
    )
    # hospice files share the directory; names differ
    return stage_chow_files(
        hh_events=hh_e,
        hh_owners=hh_o,
        hospice_events=ho_e,
        hospice_owners=ho_o,
        identifiers=identifiers,
    )


def test_cp1252_keeps_raw_byte_sha256(tmp_path: Path) -> None:
    path = tmp_path / "HH_CHOW.csv"
    body = (
        EVENT_HEADER + "\n" + _event_row(**{"ORGANIZATION NAME - BUYER": "Buyer\u2019s Org"}) + "\n"
    ).encode("cp1252")
    assert b"\x92" in body
    with pytest.raises(UnicodeDecodeError):
        body.decode("utf-8")
    path.write_bytes(body)
    parsed = read_cp1252_csv(path, EVENT_COLUMNS)
    assert parsed.raw_sha256 == hashlib.sha256(body).hexdigest()
    assert parsed.raw_sha256 == sha256_bytes(body)
    assert parsed.decoding == "cp1252"
    assert "Buyer\u2019s Org" in parsed.rows[0]["ORGANIZATION NAME - BUYER"]
    reencoded = body.decode("cp1252").encode("utf-8")
    assert hashlib.sha256(reencoded).hexdigest() != parsed.raw_sha256


def test_event_key_is_buyer_seller_date_and_type() -> None:
    assert (
        event_natural_key(
            program="HH",
            buyer_enrollment="B1",
            seller_enrollment="S1",
            effective_date="2024-01-15",
            chow_type_code="CH",
        )
        == "HH|B1|S1|2024-01-15|CH"
    )


def test_exact_buyer_publishes_and_strong_does_not(tmp_path: Path) -> None:
    exact_ids = [
        {
            "pid": "11111111-1111-1111-1111-111111111111",
            "t": "home_health",
            "e": "B1",
            "c": "123456",
            "n": "1111111111",
        },
        {
            "pid": "11111111-1111-1111-1111-111111111111",
            "t": "home_health",
            "e": "S-OTHER",
            "c": "123456",
            "n": "2222222222",
        },
    ]
    # seller enrollment is not on the buyer profile; seller CCN and NPI are
    plan = _stage(
        tmp_path,
        [_event_row()],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                    "CCN - BUYER": "654321",
                    "CCN - SELLER": "654321",
                    "NPI - BUYER": "3333333333",
                    "NPI - SELLER": "4444444444",
                }
            )
        ],
        exact_ids
        + [
            {
                "pid": "22222222-2222-2222-2222-222222222222",
                "t": "hospice",
                "c": "654321",
                "n": "3333333333",
            },
        ],
    )
    hh = [event for event in plan.events if event.program == "HH"][0]
    assert hh.buyer_match == "EXACT"
    assert hh.public_eligible is True
    assert hh.event_status == "VERIFIED"
    assert hh.confidence == "EXACT"
    assert hh.hold_reasons == []
    hospice = [event for event in plan.events if event.program == "HOSPICE"][0]
    assert hospice.buyer_match == "STRONG"
    assert hospice.public_eligible is False
    assert hospice.event_status == "REVIEW_REQUIRED"
    assert hospice.confidence == "STRONG"


def test_missing_seller_ccn_and_cross_type_are_held(tmp_path: Path) -> None:
    plan = _stage(
        tmp_path,
        [
            _event_row(**{"CCN - SELLER": ""}),
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "B2",
                    "ENROLLMENT ID - SELLER": "S2",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                    "EFFECTIVE DATE": "02/02/2024",
                }
            ),
        ],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                }
            )
        ],
        [],
    )
    hh = [event for event in plan.events if event.program == "HH"]
    assert "MISSING_SELLER_CCN" in hh[0].hold_reasons
    assert hh[0].public_eligible is False
    assert hh[0].event_status == "REVIEW_REQUIRED"
    assert "CROSS_TYPE_SELLER" in hh[1].hold_reasons
    assert hh[1].public_eligible is False
    assert all(reason in HOLD_REASONS for event in plan.events for reason in event.hold_reasons)
    assert plan.passed


def test_seller_ccn_on_buyer_is_ok_and_seller_enrollment_on_buyer_is_held(tmp_path: Path) -> None:
    shared = "11111111-1111-1111-1111-111111111111"
    ok = _stage(
        tmp_path / "ok",
        [_event_row()],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                    "CCN - BUYER": "654321",
                    "CCN - SELLER": "654320",
                }
            )
        ],
        [
            {"pid": shared, "t": "home_health", "e": "B1", "c": "123456", "n": "1111111111"},
            {"pid": shared, "t": "home_health", "c": "123456"},
        ],
    )
    hh = [event for event in ok.events if event.program == "HH"][0]
    assert "SELLER_RESOLVES_TO_DIFFERENT_PROFILE" not in hh.hold_reasons
    assert "SELLER_ENROLLMENT_ON_BUYER_PROFILE" not in hh.hold_reasons
    assert hh.public_eligible is True

    held = _stage(
        tmp_path / "held",
        [_event_row()],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                }
            )
        ],
        [
            {"pid": shared, "t": "home_health", "e": "B1", "c": "123456", "n": "1111111111"},
            {"pid": shared, "t": "home_health", "e": "S1", "c": "123456"},
        ],
    )
    hh_held = [event for event in held.events if event.program == "HH"][0]
    assert "SELLER_ENROLLMENT_ON_BUYER_PROFILE" in hh_held.hold_reasons
    assert hh_held.public_eligible is False


def test_duplicate_event_keys_fail_closed(tmp_path: Path) -> None:
    plan = _stage(
        tmp_path,
        [_event_row(), _event_row()],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                }
            )
        ],
        [],
    )
    assert plan.passed is False
    assert any("distinct event keys" in error for error in plan.qa_errors)
    with pytest.raises(ChowQaError, match="QA failed"):
        apply_chow_plan(plan, write=True, dry_run_reviewed=True, connection=object())


def test_dry_run_is_the_default_and_write_requires_explicit_flags(tmp_path: Path) -> None:
    plan = _stage(
        tmp_path,
        [_event_row()],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                }
            )
        ],
        [],
    )
    summary = apply_chow_plan(plan)
    assert summary["dry_run"] is True
    assert summary["writes"] == 0
    assert summary["deletes"] == 0
    with pytest.raises(ChowQaError, match="dry-run review"):
        apply_chow_plan(plan, write=True, connection=object())
    with pytest.raises(ChowQaError, match="explicit database connection"):
        apply_chow_plan(plan, write=True, dry_run_reviewed=True, connection=None)


def test_sql_has_no_delete_and_owners_are_never_public(tmp_path: Path) -> None:
    joined = "\n".join(guarded_sql()).upper()
    assert "DELETE" not in joined
    assert "NOT_SEEN" in NOT_SEEN_SQL.upper() or "not_seen" in NOT_SEEN_SQL
    assert "public_eligible = false" in OWNER_UPSERT_SQL
    assert "ON CONFLICT" in EVENT_UPSERT_SQL
    plan = _stage(
        tmp_path,
        [_event_row()],
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                }
            )
        ],
        [],
    )
    assert plan.owners
    assert all(owner.public_eligible is False for owner in plan.owners)
    assert plan.summary()["public_eligible_owners"] == 0


def test_sha256_mismatch_fails_closed(tmp_path: Path) -> None:
    hh_e, hh_o = _write_pair(tmp_path, "HH", [_event_row()], [_owner_row()])
    ho_e, ho_o = _write_pair(
        tmp_path,
        "HOSPICE",
        [
            _event_row(
                **{
                    "ENROLLMENT ID - BUYER": "HB",
                    "ENROLLMENT ID - SELLER": "HS",
                    "PROVIDER TYPE CODE - BUYER": "00-08",
                    "PROVIDER TYPE CODE - SELLER": "00-08",
                }
            )
        ],
        [_owner_row()],
    )
    plan = stage_chow_files(
        hh_events=hh_e,
        hh_owners=hh_o,
        hospice_events=ho_e,
        hospice_owners=ho_o,
        identifiers=[],
        expected_sha256={hh_e.name: "0" * 64},
    )
    assert plan.passed is False
    assert any("sha256" in error for error in plan.qa_errors)


def test_empty_events_refuse_not_seen_write(tmp_path: Path) -> None:
    plan = _stage(tmp_path, [], [], [])
    # header-only event files still stage zero events; owners exist
    assert plan.events == []
    summary = apply_chow_plan(plan)
    assert summary["not_seen_updates"] == 0
    with pytest.raises(ChowQaError, match="empty event file"):
        apply_chow_plan(plan, write=True, dry_run_reviewed=True, connection=object())


def test_stage_helpers_cover_owner_and_event_files(tmp_path: Path) -> None:
    event_path, owner_path = _write_pair(tmp_path, "HH", [_event_row()], [_owner_row()])
    events = stage_events(read_cp1252_csv(event_path, EVENT_COLUMNS), program="HH", index={})
    owners = stage_owners(read_cp1252_csv(owner_path, OWNER_COLUMNS), program="HH")
    assert events[0].event_natural_key.startswith("HH|")
    assert owners[0].public_eligible is False
    assert owners[0].dataset_key == "home-health-chow-owners"
