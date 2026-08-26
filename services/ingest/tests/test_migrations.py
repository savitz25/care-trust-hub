from pathlib import Path

import pytest

from care_ingest.migrations import apply_migration


def test_migration_path_is_restricted_before_connecting(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="naming convention"):
        apply_migration("unused", tmp_path, "../secret.sql")
    with pytest.raises(ValueError, match="existing file"):
        apply_migration("unused", tmp_path, "0004_missing.sql")


def test_pbj_migration_is_next_and_preserves_prior_migrations() -> None:
    migrations = Path(__file__).resolve().parents[3] / "db" / "migrations"
    assert (migrations / "0006_pbj_staffing.sql").is_file()
    prior = (
        (1, "foundation"),
        (2, "cms_provider_information"),
        (3, "provider_information_load"),
        (4, "inspection_deficiency_penalty"),
        (5, "regulatory_load_stage"),
    )
    assert all((migrations / f"000{number}_{name}.sql").is_file() for number, name in prior)
    ownership = (migrations / "0007_ownership_organization_graph.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE organization (" in ownership
    assert "CREATE TABLE ownership_party (" in ownership
    assert "subscription" not in ownership
    assert "billing" not in ownership

    trust = (migrations / "0011_trust_participation.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE trust_request (" in trust
    assert "CREATE TABLE provider_context_submission (" in trust
    assert "CREATE TABLE trusthub_manual_override (" in trust
    assert "CREATE TABLE trust_audit_event (" in trust
    assert "append-only" in trust
    assert "subscription" not in trust
    assert "billing" not in trust

    intelligence = (migrations / "0012_facility_intelligence_evidence_identity.sql").read_text(
        encoding="utf-8"
    )
    assert "CREATE TABLE facility_source_observation (" in intelligence
    assert "CREATE TABLE facility_claim (" in intelligence
    assert "CREATE TABLE facility_identity_candidate (" in intelligence
    assert "CREATE TABLE facility_review_item (" in intelligence
    assert "CREATE TABLE facility_external_request_cache (" in intelligence
    assert "facility_intelligence_append_only" in intelligence
    assert "CHECK (publication_eligible = false OR resolution_state = 'VERIFIED')" in intelligence
    assert "GOOGLE_PLACES_API_KEY" not in intelligence

    pilot = (migrations / "0013_facility_identity_pilot_manifest.sql").read_text(encoding="utf-8")
    assert "ADD COLUMN selection_metadata jsonb" in pilot
    assert "ADD COLUMN verified_audit_status text" in pilot
    assert "facility_run_provider_reason_codes_gin" in pilot
    assert "GOOGLE_PLACES_API_KEY" not in pilot

    portfolio = (migrations / "0019_ownership_portfolio.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE ownership_portfolio (" in portfolio
    assert "CREATE TABLE ownership_portfolio_member (" in portfolio
    assert "membership_status" in portfolio
    assert "publication_eligible" in portfolio
    assert "CHECK (publication_eligible = false OR resolution_state = 'VERIFIED')" in portfolio
    assert "ALTER TABLE organization" not in portfolio
    assert "DROP TABLE" not in portfolio

    refresh = (migrations / "0022_cms_refresh_governance.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE cms_refresh_run (" in refresh
    assert "CREATE TABLE cms_source_run (" in refresh
    assert "CREATE TABLE cms_refresh_source_policy (" in refresh
    assert "CREATE UNIQUE INDEX cms_source_run_active_lock" in refresh
    assert "CREATE OR REPLACE VIEW cms_source_freshness" in refresh
    assert "DROP TABLE" not in refresh
    assert "nursing-home-provider-information" in refresh
    assert "freshness_sla_days" in refresh

    assisted = (migrations / "0020_assisted_living_pilot.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE assisted_living_provider (" in assisted
    assert "CREATE TABLE assisted_living_organization_party (" in assisted
    assert "UNIQUE (state_code, regulator_code, source_facility_id)" in assisted
    assert "REFERENCES provider(" not in assisted
    assert "certified_beds" not in assisted
    assert "GOOGLE_PLACES" not in assisted
    assert "google" not in assisted.lower()
    assert "PUBLISHABLE_WITH_STATUS" in assisted
    assert "CHECK (discovery_eligible = false OR identity_state = 'VERIFIED')" in assisted
