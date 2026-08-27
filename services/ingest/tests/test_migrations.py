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

    florida29 = (migrations / "0029_florida_license_status_and_external_key.sql").read_text(
        encoding="utf-8"
    )
    assert "CLOSED_IN_LOCATOR" in florida29
    assert "REVOKED" not in florida29
    assert "PENDING" not in florida29
    assert "FL|AHCA|" in florida29
    assert "DROP TABLE" not in florida29

    florida = (migrations / "0028_florida_state_licensed_provider.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE state_licensed_provider (" in florida
    assert "CREATE TABLE state_license_credential (" in florida
    assert "CREATE TABLE state_provider_contact (" in florida
    assert "CREATE TABLE state_service_geography (" in florida
    assert "CREATE TABLE state_regulatory_event (" in florida
    assert "REFERENCES provider(id)" in florida
    assert "MEMORY_CARE" not in florida
    assert "DROP TABLE" not in florida
    assert "GOOGLE_PLACES" not in florida
    assert "DROP TABLE assisted_living_provider" not in florida
    assert "ALTER TABLE assisted_living_provider" not in florida
    assert "AHCA file number is canonical" in florida

    profile = (migrations / "0027_provider_intelligence.sql").read_text(encoding="utf-8")
    assert "cms_agency_quality_provider_idx" in profile
    assert "DROP TABLE" not in profile
    assert "Not a materialization of measures" in profile

    intel = (migrations / "0026_senior_intelligence.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE IF NOT EXISTS senior_intelligence_metric_definition (" in intel
    assert "CREATE TABLE IF NOT EXISTS senior_intelligence_snapshot (" in intel
    assert "CREATE TABLE IF NOT EXISTS senior_intelligence_metric_value (" in intel
    assert "DROP TABLE" not in intel
    assert "No combined senior-provider denominator" in intel

    chow = (migrations / "0025_ownership_change_intelligence.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE ownership_change_event_party (" in chow
    assert "CREATE TABLE ownership_change_relationship_link (" in chow
    assert "CREATE OR REPLACE VIEW provider_ownership_timeline AS" in chow
    assert "DROP TABLE" not in chow
    assert "UNKNOWN into divestiture" in chow

    graph = (migrations / "0024_ownership_graph.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE provider_organization_edge (" in graph
    assert "CREATE TABLE organization_name_observation (" in graph
    assert "provider_ownership_relationship_id" in graph
    assert "DROP TABLE" not in graph
    assert "PAC is PECOS organization identity, not parent company" in graph

    post_acute = (migrations / "0023_home_health_hospice_national.sql").read_text(encoding="utf-8")
    assert "CREATE TABLE home_health_snapshot (" in post_acute
    assert "CREATE TABLE hospice_snapshot (" in post_acute
    assert "hh_hhcahps" in post_acute
    assert "hospice_cahps" in post_acute
    assert "certified_beds" not in post_acute
    assert "DROP TABLE" not in post_acute
    assert "home-health-care-agencies" in post_acute

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
