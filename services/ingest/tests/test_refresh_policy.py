from datetime import UTC, datetime, timedelta

import pytest

from care_ingest.provider_information import SchemaDriftError
from care_ingest.refresh import (
    advisory_lock_id,
    check_source,
    source_is_locked,
    validate_headers,
    validate_row_count,
)
from care_ingest.refresh_policy import (
    classify_failure,
    directory_status_for_absent_ccn,
    freshness_band,
    may_retry,
    npi_join_is_forbidden,
    platform_health,
    redact_secrets,
    row_count_violation,
    schema_drift,
    source_changed,
    topological_refresh_order,
    writes_enabled,
)


def test_topological_order_places_inspections_before_deficiencies() -> None:
    order = topological_refresh_order()
    assert order.index("nursing-home-inspection-dates") < order.index(
        "nursing-home-health-deficiencies"
    )
    assert order.index("nursing-home-inspection-dates") < order.index(
        "nursing-home-fire-safety-deficiencies"
    )
    assert order.index("skilled-nursing-facility-change-of-ownership") < order.index(
        "skilled-nursing-facility-change-of-ownership-owner-information"
    )
    assert "nursing-home-provider-information" in order
    assert "nursing-home-mds-quality-measures" in order


def test_modified_timestamps_compare_by_date_not_timezone_text() -> None:
    assert not source_changed(
        previous_checksum=None,
        discovered_checksum=None,
        previous_modified="2026-08-01 00:00:00+00",
        discovered_modified="2026-08-01",
    )
    assert source_changed(
        previous_checksum=None,
        discovered_checksum=None,
        previous_modified="2026-07-29 00:00:00+00",
        discovered_modified="2026-08-01",
    )


def test_checksum_beats_modified_for_change_detection() -> None:
    assert not source_changed(
        previous_checksum="a" * 64,
        discovered_checksum="a" * 64,
        previous_modified="2026-01-01",
        discovered_modified="2026-08-01",
    )
    assert source_changed(
        previous_checksum="a" * 64,
        discovered_checksum="b" * 64,
        previous_modified="2026-08-01",
        discovered_modified="2026-08-01",
    )


def test_schema_drift_lists_missing_required_columns() -> None:
    drift = schema_drift({"CCN", "Provider Name"}, {"CCN"})
    assert drift == ["missing required column: Provider Name"]
    with pytest.raises(SchemaDriftError, match="SCHEMA_DRIFT"):
        validate_headers({"CCN", "Provider Name"}, {"CCN"})


def test_row_count_violation_is_fail_closed() -> None:
    assert row_count_violation(50, previous=10000, min_row_count=10000, max_drop_ratio=0.25)
    assert (
        row_count_violation(12000, previous=10000, min_row_count=10000, max_drop_ratio=0.25) is None
    )
    with pytest.raises(ValueError, match="VALIDATION"):
        validate_row_count(100, "nursing-home-provider-information", previous=14000)


def test_freshness_bands_use_per_source_sla() -> None:
    now = datetime(2026, 8, 26, tzinfo=UTC)
    assert freshness_band(now - timedelta(days=10), 45, now) == "CURRENT"
    assert freshness_band(now - timedelta(days=50), 45, now) == "AGING"
    assert freshness_band(now - timedelta(days=100), 45, now) == "STALE"
    assert freshness_band(None, 45, now) == "UNKNOWN"


def test_platform_health_failed_critical_beats_aging() -> None:
    critical = ("nursing-home-provider-information",)
    assert (
        platform_health(
            {"nursing-home-provider-information": "FAILED"},
            {"nursing-home-provider-information": "CURRENT"},
            critical,
        )
        == "FAILED"
    )
    assert (
        platform_health(
            {"nursing-home-penalties": "FAILED"},
            {"nursing-home-penalties": "CURRENT"},
            critical,
        )
        == "DEGRADED"
    )


def test_writes_require_explicit_guard() -> None:
    assert not writes_enabled({})
    assert not writes_enabled({"CARE_CMS_REFRESH_WRITES": "yes"})
    assert writes_enabled({"CARE_CMS_REFRESH_WRITES": "true"})


def test_secrets_are_redacted_and_retries_are_transient_only() -> None:
    assert redact_secrets("postgresql://care:secret@localhost/care") == "[redacted]"
    assert redact_secrets("row count below minimum") == "row count below minimum"
    assert classify_failure(TimeoutError("timeout")) == "TRANSIENT"
    assert classify_failure(ValueError("SCHEMA_DRIFT: missing")) == "VALIDATION"
    assert classify_failure(OSError("No space left on device")) == "CAPACITY"
    assert may_retry("TRANSIENT", 1, 3)
    assert not may_retry("VALIDATION", 1, 3)


def test_absent_directory_and_forbidden_npi_join_remain_protected() -> None:
    assert directory_status_for_absent_ccn() == "ABSENT_FROM_CURRENT_DIRECTORY"
    assert npi_join_is_forbidden("organization_identifier_join")
    assert not npi_join_is_forbidden("same_enrollment_row")


def test_advisory_lock_id_is_stable() -> None:
    assert advisory_lock_id("nursing-home-mds-quality-measures") == advisory_lock_id(
        "nursing-home-mds-quality-measures"
    )
    assert advisory_lock_id("a") != advisory_lock_id("b")
    assert source_is_locked({"nursing-home-penalties"}, "nursing-home-penalties")
    assert not source_is_locked(set(), "nursing-home-penalties")


def test_check_source_uses_injected_discover() -> None:
    def discover(_key: str) -> dict[str, object]:
        return {"source_modified_at": "2026-08-01", "checksum": None, "version_identifier": "v1"}

    unchanged = check_source(
        "nursing-home-penalties",
        previous={"checksum": None, "modified": "2026-08-01", "version": "v1"},
        discover=discover,
    )
    assert unchanged.status == "NO_CHANGE"
    changed = check_source(
        "nursing-home-penalties",
        previous={"checksum": None, "modified": "2026-07-01", "version": "v0"},
        discover=discover,
    )
    assert changed.status == "DISCOVERED"
    assert changed.changed is True
