from datetime import UTC, datetime

from care_ingest.facility_intelligence import (
    FacilitySourceObservation,
    RequestBudget,
    SourceAuthority,
)


def test_observation_fingerprint_is_deterministic_and_version_sensitive() -> None:
    values = dict(
        source_type="state_regulator",
        source_authority=SourceAuthority.STATE_HEALTHCARE_REGULATOR,
        source_identifier="synthetic-state-source",
        source_record_identifier="synthetic-record-1",
        observation_type="license_status",
        observed_value="Active",
        normalized_value="active",
        observed_at=None,
        source_published_at=None,
        retrieved_at=datetime(2026, 8, 17, tzinfo=UTC),
        source_reference="https://example.invalid/record/1",
        release_identifier="synthetic-release",
        adapter_version="state-adapter-v1",
        canonical_ccn="015001",
    )
    first = FacilitySourceObservation(**values)
    same = FacilitySourceObservation(**values)
    changed = FacilitySourceObservation(**{**values, "adapter_version": "state-adapter-v2"})
    assert first.fingerprint() == same.fingerprint()
    assert first.fingerprint() != changed.fingerprint()


def test_request_budget_defaults_to_dry_run_and_hard_stops() -> None:
    dry = RequestBudget(maximum_requests=2)
    assert dry.reserve(2)
    assert dry.used_requests == 0
    live = RequestBudget(maximum_requests=2, dry_run=False)
    assert live.reserve()
    assert live.reserve()
    assert not live.reserve()
    assert live.used_requests == 2
