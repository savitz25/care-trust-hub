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
