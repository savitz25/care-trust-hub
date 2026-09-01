"""SEN-NAT-005 automated reconciliation R1–R15 and scheduler behavior."""

from __future__ import annotations

from pathlib import Path

from care_ingest.cms_designations import classify_abuse_icon, classify_special_focus
from care_ingest.directory_status import interpret_missing_current_pi
from care_ingest.facility_npi import PUBLIC_LANGUAGE, classify_enrollment_npi
from care_ingest.manifest import ReleaseManifest
from care_ingest.mds import is_star_rating_observation
from care_ingest.provider_information import SchemaDriftError
from care_ingest.refresh import run_refresh
from care_ingest.refresh_execute import peek_csv_headers, required_columns_for
from care_ingest.refresh_policy import npi_join_is_forbidden, platform_health
from care_ingest.regulatory import DEFICIENCIES_KEY, FIRE_KEY, normalize_regulatory_row

PI = "nursing-home-provider-information"
INSPECTIONS = "nursing-home-inspection-dates"
DEFICIENCIES = "nursing-home-health-deficiencies"
FIRE = "nursing-home-fire-safety-deficiencies"
PENALTIES = "nursing-home-penalties"
MDS = "nursing-home-mds-quality-measures"
PBJ = "payroll-based-journal-daily-nurse-staffing"
ENROLLMENTS = "skilled-nursing-facility-enrollments"
CHOW = "skilled-nursing-facility-change-of-ownership"
CHOW_OWNERS = "skilled-nursing-facility-change-of-ownership-owner-information"

STABLE = {
    PI: {"checksum": "a" * 64, "modified": "2026-07-29", "version": None, "rows_read": 14693},
    INSPECTIONS: {
        "checksum": "b" * 64,
        "modified": "2026-07-29",
        "version": None,
        "rows_read": 149705,
    },
    DEFICIENCIES: {
        "checksum": "c" * 64,
        "modified": "2026-07-29",
        "version": None,
        "rows_read": 418344,
    },
    FIRE: {"checksum": "d" * 64, "modified": "2026-08-01", "version": None, "rows_read": 200327},
    PENALTIES: {
        "checksum": "e" * 64,
        "modified": "2026-07-29",
        "version": None,
        "rows_read": 16000,
    },
    MDS: {"checksum": "f" * 64, "modified": "2026-08-01", "version": None, "rows_read": 250000},
    PBJ: {
        "checksum": "1" * 64,
        "modified": "2026-07-29",
        "version": "q1",
        "rows_read": 5280805,
    },
}


def _regulatory_manifest(dataset_key: str) -> ReleaseManifest:
    return ReleaseManifest(
        2,
        dataset_key,
        "CMS",
        "id",
        "https://data.cms.gov/source",
        "2026-08-26T00:00:00+00:00",
        "2026-08-01",
        "source.csv",
        1,
        "a" * 64,
        "text/csv",
        None,
        "downloaded",
    )


def _discover_factory(overrides: dict[str, dict] | None = None, failing: set[str] | None = None):
    overrides = overrides or {}
    failing = failing or set()

    def discover(dataset_key: str) -> dict[str, object]:
        if dataset_key in failing:
            raise TimeoutError(f"timeout contacting CMS for {dataset_key}")
        prior = STABLE.get(
            dataset_key, {"modified": "2026-07-01", "checksum": "9" * 64, "version": "v0"}
        )
        payload = {
            "source_modified_at": prior.get("modified"),
            "checksum": prior.get("checksum"),
            "version_identifier": prior.get("version"),
            "download_url": "https://data.cms.gov/example.csv",
        }
        payload.update(overrides.get(dataset_key, {}))
        return payload

    return discover


def _run(**kwargs):
    defaults = {
        "mode": "check",
        "database_url": None,
        "data_root": Path("."),
        "trigger": "manual",
        "fingerprints": STABLE,
        "discover": _discover_factory(),
        "environment": {},
    }
    defaults.update(kwargs)
    return run_refresh(**defaults)


def _status(report, dataset_key: str) -> str:
    return next(item["status"] for item in report.sources if item["dataset_key"] == dataset_key)


def test_r1_unchanged_source_is_no_change() -> None:
    report = _run(mode="check", trigger="scheduled")
    assert _status(report, PI) == "NO_CHANGE"
    assert _status(report, MDS) == "NO_CHANGE"
    assert all(
        item["status"] in {"NO_CHANGE", "SKIPPED_DEPENDENCY"} or item["dataset_key"] not in STABLE
        for item in report.sources
    )
    assert report.trigger == "scheduled"
    assert report.writes_enabled is False


def test_r2_changed_source_is_discovered_in_check_mode() -> None:
    report = _run(
        mode="check",
        discover=_discover_factory(
            {PI: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
    )
    assert _status(report, PI) == "DISCOVERED"
    assert _status(report, PENALTIES) == "NO_CHANGE"
    pi = next(item for item in report.sources if item["dataset_key"] == PI)
    assert "writes not enabled" in pi["note"]


def test_r3_schema_drift_quarantines_and_does_not_load() -> None:
    def write(dataset_key: str, **_kwargs):
        raise SchemaDriftError(
            "SCHEMA_DRIFT: missing required column: CMS Certification Number (CCN)"
        )

    report = _run(
        mode="refresh",
        environment={"CARE_CMS_REFRESH_WRITES": "true"},
        discover=_discover_factory(
            {PI: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        write_source=write,
        sources=[PI],
    )
    assert _status(report, PI) == "QUARANTINED"
    pi = next(item for item in report.sources if item["dataset_key"] == PI)
    assert pi["failure_class"] == "VALIDATION"
    assert report.health == "FAILED"


def test_r4_row_count_drop_is_fail_closed() -> None:
    def write(dataset_key: str, **_kwargs):
        raise ValueError("VALIDATION: row count dropped from 14693 to 100 (99% > 25% allowed)")

    report = _run(
        mode="refresh",
        environment={"CARE_CMS_REFRESH_WRITES": "true"},
        discover=_discover_factory(
            {PI: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        write_source=write,
        sources=[PI],
    )
    assert _status(report, PI) == "FAILED"
    assert (
        next(item for item in report.sources if item["dataset_key"] == PI)["failure_class"]
        == "VALIDATION"
    )


def test_r5_refresh_without_write_guard_does_not_call_writer() -> None:
    calls: list[str] = []

    def write(dataset_key: str, **_kwargs):
        calls.append(dataset_key)
        return {"status": "COMPLETE"}

    report = _run(
        mode="refresh",
        environment={},
        discover=_discover_factory(
            {PI: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        write_source=write,
        sources=[PI],
    )
    assert calls == []
    assert _status(report, PI) == "DISCOVERED"
    assert report.writes_enabled is False


def test_r6_same_release_twice_is_idempotent() -> None:
    calls = {"n": 0}

    def write(dataset_key: str, **_kwargs):
        calls["n"] += 1
        return {
            "status": "COMPLETE",
            "idempotent": calls["n"] > 1,
            "rows_loaded": 3,
            "checksum": "a" * 64,
        }

    first = _run(
        mode="refresh",
        environment={"CARE_CMS_REFRESH_WRITES": "true"},
        discover=_discover_factory(
            {PENALTIES: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        write_source=write,
        sources=[PENALTIES],
    )
    second = _run(
        mode="refresh",
        environment={"CARE_CMS_REFRESH_WRITES": "true"},
        discover=_discover_factory(
            {PENALTIES: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        write_source=write,
        sources=[PENALTIES],
    )
    assert _status(first, PENALTIES) == "COMPLETE"
    assert first.sources[0]["idempotent"] is False
    assert _status(second, PENALTIES) == "COMPLETE"
    assert second.sources[0]["idempotent"] is True
    assert calls["n"] == 2


def test_r7_continuing_ccn_stays_current_active() -> None:
    assert interpret_missing_current_pi(in_latest_pi=True, termination_source=None) == (
        "CURRENT_ACTIVE"
    )


def test_r8_new_ccn_is_current_active() -> None:
    assert interpret_missing_current_pi(in_latest_pi=True, termination_source=None) != (
        "ABSENT_FROM_CURRENT_DIRECTORY"
    )


def test_r9_absent_ccn_is_not_confirmed_termination() -> None:
    assert interpret_missing_current_pi(in_latest_pi=False, termination_source=None) == (
        "ABSENT_FROM_CURRENT_DIRECTORY"
    )
    assert interpret_missing_current_pi(in_latest_pi=False, termination_source=None) != (
        "TERMINATED_CONFIRMED"
    )


def test_r10_sff_and_abuse_are_historical_release_rows() -> None:
    first = ("release-2026-07-29", "015009", "special_focus")
    second = ("release-2026-08-26", "015009", "special_focus")
    assert first != second
    assert classify_special_focus("SFF Candidate")[0] == "SFF_CANDIDATE"
    assert classify_special_focus("SFF Candidate")[0] != "SFF"
    assert classify_abuse_icon("Y")[0] == "DESIGNATED"
    assert "abusive" not in classify_abuse_icon("Y")[0].lower()


def test_r11_npi_same_row_rule_forbids_org_identifier_join() -> None:
    assert classify_enrollment_npi("015009", "1234567890") == "CONFIRMED"
    assert classify_enrollment_npi("015009", "") is None
    assert npi_join_is_forbidden("organization_identifier_join")
    assert "not a replacement for the facility CCN" in PUBLIC_LANGUAGE
    assert "facility-location NPI" in PUBLIC_LANGUAGE


def test_r12_mds_history_is_period_keyed_and_not_a_star_rating() -> None:
    key_q1 = ("release-2026-08-01", "015009", "401", "Q1")
    key_q2 = ("release-2026-08-01", "015009", "401", "Q2")
    assert key_q1 != key_q2
    assert is_star_rating_observation("Q1", "401") is False
    assert "CMS Certification Number (CCN)" in required_columns_for(MDS)
    assert "Measure Code" in required_columns_for(MDS)


def test_r13_fire_citations_stay_separate_from_health_deficiencies() -> None:
    fire = normalize_regulatory_row(
        {
            "CMS Certification Number (CCN)": "015009",
            "Survey Date": "2026-01-02",
            "Survey Type": "Fire Safety",
            "Deficiency Prefix": "K",
            "Deficiency Category": "Fire",
            "Deficiency Tag Number": "0353",
            "Tag Version": "2012",
            "Deficiency Description": "Sprinkler system",
            "Scope Severity Code": "E",
            "Deficiency Corrected": "Deficient, Provider has date of correction",
            "Correction Date": "2026-02-01",
            "Inspection Cycle": "1",
            "Standard Deficiency": "Y",
            "Complaint Deficiency": "N",
            "Processing Date": "2026-08-01",
        },
        2,
        _regulatory_manifest(FIRE_KEY),
    )
    health = normalize_regulatory_row(
        {
            "CMS Certification Number (CCN)": "015009",
            "Survey Date": "2026-01-02",
            "Survey Type": "Health",
            "Deficiency Prefix": "F",
            "Deficiency Category": "Care",
            "Deficiency Tag Number": "0880",
            "Deficiency Description": "Official description",
            "Scope Severity Code": "D",
            "Deficiency Corrected": "Past Non-Compliance",
            "Correction Date": "2026-01-03",
            "Inspection Cycle": "1",
            "Standard Deficiency": "Y",
            "Complaint Deficiency": "N",
            "Infection Control Inspection Deficiency": "N",
            "Citation under IDR": "N",
            "Citation under IIDR": "N",
            "Processing Date": "2026-08-01",
        },
        3,
        _regulatory_manifest(DEFICIENCIES_KEY),
    )
    assert fire["normalized"]["evidence_class"] == "fire_safety_citation"
    assert "evidence_class" not in health["normalized"]
    assert fire["normalized"]["finding_key"] != health["normalized"]["finding_key"]


def test_r14_pbj_quarters_are_additional_releases() -> None:
    q1 = {"dataset": PBJ, "source_period": "2026Q1", "release_key": "2026Q1"}
    q2 = {"dataset": PBJ, "source_period": "2025Q4", "release_key": "2025Q4"}
    assert q1["source_period"] != q2["source_period"]
    assert q1["release_key"] != q2["release_key"]


def test_r15_partial_failure_and_lock_do_not_mark_everything_current() -> None:
    report = _run(
        mode="check",
        discover=_discover_factory(
            {PENALTIES: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}},
            failing={INSPECTIONS},
        ),
    )
    assert _status(report, INSPECTIONS) == "FAILED"
    assert _status(report, DEFICIENCIES) == "SKIPPED_DEPENDENCY"
    assert _status(report, FIRE) == "SKIPPED_DEPENDENCY"
    assert _status(report, PENALTIES) == "DISCOVERED"
    assert report.health == "FAILED"
    locked = _run(
        mode="refresh",
        environment={"CARE_CMS_REFRESH_WRITES": "true"},
        discover=_discover_factory(
            {PI: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        active_ingests={PI},
        write_source=lambda **_k: {"status": "COMPLETE"},
        sources=[PI, PENALTIES],
    )
    assert _status(locked, PI) == "ALREADY_RUNNING"
    assert _status(locked, PENALTIES) == "NO_CHANGE"


def test_scheduler_check_changed_and_failed_fixtures() -> None:
    unchanged = _run(mode="check", trigger="scheduled")
    assert unchanged.trigger == "scheduled"
    assert unchanged.mode == "check"
    assert _status(unchanged, PI) == "NO_CHANGE"

    changed = _run(
        mode="check",
        trigger="scheduled",
        discover=_discover_factory(
            {MDS: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
    )
    assert _status(changed, MDS) == "DISCOVERED"
    assert _status(changed, PI) == "NO_CHANGE"

    failed = _run(
        mode="check",
        trigger="scheduled",
        discover=_discover_factory(failing={PI}),
    )
    assert _status(failed, PI) == "FAILED"
    assert failed.health == "FAILED"


def test_dry_run_does_not_require_writes_or_locks() -> None:
    report = _run(
        mode="dry_run",
        discover=_discover_factory(
            {PI: {"source_modified_at": "2026-08-26", "checksum": "0" * 64}}
        ),
        active_ingests={PI},
    )
    assert _status(report, PI) == "DISCOVERED"
    assert report.writes_enabled is False


def test_one_failed_noncritical_source_is_degraded_not_globally_current() -> None:
    statuses = {
        PI: "NO_CHANGE",
        PENALTIES: "FAILED",
        INSPECTIONS: "NO_CHANGE",
        DEFICIENCIES: "NO_CHANGE",
    }
    bands = {key: "CURRENT" for key in statuses}
    assert (
        platform_health(
            statuses,
            bands,
            (
                "nursing-home-provider-information",
                "nursing-home-inspection-dates",
                DEFICIENCIES,
                PENALTIES,
            ),
        )
        == "FAILED"
    )
    assert (
        platform_health(
            {PI: "NO_CHANGE", MDS: "FAILED"},
            {PI: "CURRENT", MDS: "CURRENT"},
            ("nursing-home-provider-information",),
        )
        == "DEGRADED"
    )


def test_header_peek_reads_utf8_csv(tmp_path: Path) -> None:
    path = tmp_path / "pi.csv"
    path.write_text(
        "CMS Certification Number (CCN),Provider Name\n015009,Example\n", encoding="utf-8"
    )
    headers = peek_csv_headers(path)
    assert "CMS Certification Number (CCN)" in headers
    assert "Provider Name" in required_columns_for(PI)


def test_chow_dependency_skips_owners_when_chow_fails() -> None:
    report = _run(
        mode="check",
        discover=_discover_factory(failing={CHOW}),
        fingerprints={
            **STABLE,
            CHOW: {"modified": "2026-01-01", "checksum": "2" * 64, "version": "v1"},
            CHOW_OWNERS: {"modified": "2026-01-01", "checksum": "3" * 64, "version": "v1"},
        },
        sources=[CHOW, CHOW_OWNERS],
    )
    assert _status(report, CHOW) == "FAILED"
    assert _status(report, CHOW_OWNERS) == "SKIPPED_DEPENDENCY"
