import csv
from pathlib import Path

import pytest

from care_ingest.senior_dot_enrich import (
    EXPECTED_SHA256,
    GO_PHRASE,
    HELD_EMAIL_FILENAME,
    Candidate,
    CurrentFacilityState,
    ObservationPlan,
    OpenIdentifier,
    SeniorEnrichReject,
    _classification_sql,
    _gate_sql,
    _insert_sql,
    assert_outside_git,
    classify_identity,
    evidence_fingerprint,
    execute_rendered_sql,
    main,
    mask_value,
    parse_candidate_csv,
    plan_observations,
    render_commit_sql,
    render_dry_run_sql,
    require_production_authorization,
    select_masked_samples,
    validate_production_contract,
    write_rollback_manifest,
)

HEADER = (
    "provider_id,provider_type,display_name,state,city,grade,website,"
    "phone_primary_cms,phone_secondary_website,email,address,"
    "dot_match_confidence,source_file,source_row,flags,dot_source_pages"
)


def candidate(**overrides: str) -> Candidate:
    values = {
        "provider_id": "105000",
        "provider_type": "nursing_home",
        "state": "FL",
        "grade": "strict",
        "website": "https://example.invalid/facility",
        "phone_primary_cms": "(555) 010-0199",
        "phone_secondary_website": "",
        "email": "",
        "source_row": "1",
    }
    values.update(overrides)
    return Candidate(**values)


def test_parser_rejects_short_ccn_without_padding() -> None:
    text = HEADER + "\n12345,nursing_home,Example,FL,Miami,strict,https://example.invalid,555,,"
    text += ",,high,file,1,,\n"
    with pytest.raises(SeniorEnrichReject, match="6-character"):
        parse_candidate_csv(text)


def test_parser_ignores_address_and_name_columns() -> None:
    text = (
        HEADER
        + "\n105000,nursing_home,Secret Name,FL,Miami,partial,https://example.invalid,"
        + "555-0100,555-0101,a@example.invalid,1 Secret St,high,file,9,,\n"
    )
    parsed = parse_candidate_csv(text)
    assert len(parsed) == 1
    assert not hasattr(parsed[0], "address")
    assert parsed[0].email == "a@example.invalid"


def test_held_file_is_rejected_before_content_is_trusted() -> None:
    with pytest.raises(SeniorEnrichReject, match="held email"):
        validate_production_contract(HELD_EMAIL_FILENAME, "a" * 64, [candidate()])


def test_contract_rejects_wrong_hash_count_and_email_cap() -> None:
    filename = "final-publish-candidate-2026-10-14.csv"
    with pytest.raises(SeniorEnrichReject, match="sha256"):
        validate_production_contract(filename, "0" * 64, [candidate()])
    with pytest.raises(SeniorEnrichReject, match="provider count"):
        validate_production_contract(filename, EXPECTED_SHA256, [candidate()])
    rows = [
        candidate(provider_id=f"{index:06d}", email="a@example.invalid") for index in range(1910)
    ]
    with pytest.raises(SeniorEnrichReject, match="725"):
        validate_production_contract(filename, EXPECTED_SHA256, rows)


def test_identity_is_exact_only_for_the_class_ccn_and_state() -> None:
    row = candidate()
    identifiers = [
        OpenIdentifier("provider-1", "nursing_home", "CCN", "105000"),
        OpenIdentifier("provider-2", "home_health", "HOME_HEALTH_CCN", "105000"),
    ]
    states = {"provider-1": CurrentFacilityState("provider-1", frozenset({"FL"}), None)}
    counts = classify_identity([row], identifiers, states)
    assert counts["EXACT_PROVIDER_MATCHES"] == 1
    assert counts["CCN_MISMATCHES"] == 0


def test_other_class_ccn_is_not_repaired_into_a_match() -> None:
    row = candidate(provider_type="home_health", provider_id="225000")
    identifiers = [OpenIdentifier("provider-1", "nursing_home", "CCN", "225000")]
    counts = classify_identity([row], identifiers, {})
    assert counts["CCN_MISMATCHES"] == 1
    assert counts["EXACT_PROVIDER_MATCHES"] == 0
    assert counts["PROVIDER_NOT_FOUND"] == 0


def test_identity_buckets_cover_not_found_multiple_state_and_ambiguous() -> None:
    missing = candidate(provider_id="335000")
    duplicated = candidate(provider_id="445000")
    wrong_state = candidate(provider_id="555000", state="NJ")
    ambiguous = candidate(provider_id="665000")
    identifiers = [
        OpenIdentifier("a", "nursing_home", "CCN", "445000"),
        OpenIdentifier("b", "nursing_home", "CCN", "445000"),
        OpenIdentifier("c", "nursing_home", "CCN", "555000"),
        OpenIdentifier("d", "nursing_home", "CCN", "665000"),
    ]
    states = {
        "c": CurrentFacilityState("c", frozenset({"FL"}), None),
        "d": CurrentFacilityState("d", frozenset({"FL", "GA"}), None),
    }
    counts = classify_identity([missing, duplicated, wrong_state, ambiguous], identifiers, states)
    assert counts["PROVIDER_NOT_FOUND"] == 1
    assert counts["MULTIPLE_PROVIDER_MATCHES"] == 1
    assert counts["STATE_MISMATCHES"] == 1
    assert counts["AMBIGUOUS_IDENTITIES"] == 1


def test_home_health_snapshot_ccn_must_match_exactly() -> None:
    row = candidate(provider_type="home_health", provider_id="775000", state="NC")
    identifiers = [OpenIdentifier("hh", "home_health", "HOME_HEALTH_CCN", "775000")]
    mismatch = {"hh": CurrentFacilityState("hh", frozenset({"NC"}), frozenset({"775001"}))}
    assert classify_identity([row], identifiers, mismatch)["CCN_MISMATCHES"] == 1
    exact = {"hh": CurrentFacilityState("hh", frozenset({"NC"}), frozenset({"775000"}))}
    assert classify_identity([row], identifiers, exact)["EXACT_PROVIDER_MATCHES"] == 1


def test_plan_preserves_phone_roles_and_skips_blank_optional_fields() -> None:
    planned = plan_observations(
        [
            candidate(
                website="http://example.invalid/plain",
                phone_secondary_website="555-0102",
                email="a@example.invalid",
            )
        ]
    )
    by_type = {row.observation_type: row for row in planned}
    assert set(by_type) == {
        "website",
        "phone_primary_cms",
        "phone_secondary_website",
        "email",
    }
    assert by_type["website"].observed_url is None
    assert by_type["phone_primary_cms"].provenance["phone_role"] == "cms_primary"
    assert by_type["phone_secondary_website"].provenance["phone_role"] == "website_secondary"
    assert by_type["phone_primary_cms"].observed_phone == "(555) 010-0199"
    assert by_type["email"].observed_phone is None
    https = plan_observations([candidate()])[0]
    assert https.observed_url == "https://example.invalid/facility"


def test_fingerprint_is_stable_and_changes_with_value() -> None:
    first = evidence_fingerprint("105000", "email", "a@example.invalid")
    assert first == evidence_fingerprint("105000", "email", "a@example.invalid")
    assert first != evidence_fingerprint("105000", "email", "b@example.invalid")


def test_masked_samples_do_not_contain_the_contact_value() -> None:
    observation = plan_observations(
        [candidate(email="alpha@example.com", phone_secondary_website="555-010-0199")]
    )
    email = next(row for row in observation if row.observation_type == "email")
    phone = next(row for row in observation if row.observation_type == "phone_primary_cms")
    website = next(row for row in observation if row.observation_type == "website")
    assert mask_value("email", email.value) == "a***@e***.com"
    assert "alpha@example.com" not in mask_value("email", email.value)
    assert "555" not in mask_value("phone_primary_cms", phone.value)
    assert "example.invalid" not in mask_value("website", website.value)
    samples = select_masked_samples(observation)
    assert len(samples) == 4
    assert all("value" not in sample for sample in samples)


def test_dry_run_sql_is_rollback_only_and_class_scoped() -> None:
    classification = _classification_sql()
    insert = _insert_sql()
    gate = _gate_sql()
    assert classification.rstrip().endswith(";")
    assert insert.rstrip().endswith(";")
    assert gate.rstrip().endswith(";")
    assert "HOME_HEALTH_CCN" in classification
    assert "HOSPICE_CCN" in classification
    assert "valid_to IS NULL" in classification
    assert "lpad(" not in classification.lower()
    assert "display_name" not in classification
    assert "observed_address" not in insert
    assert "dot_enrich" in insert
    assert "senior-enrich-001-2026-10-16" in insert
    assert HELD_EMAIL_FILENAME not in insert
    assert "1910" in gate
    assert "725" in gate
    rendered = _render_contract_dry_run()
    assert "SENIOR_ENRICH_DRY_RUN" in rendered
    assert "\nCOMMIT;\n" not in rendered
    assert "ROLLBACK;" not in rendered


def test_commit_renderer_requires_the_exact_founder_phrase() -> None:
    with pytest.raises(SeniorEnrichReject, match="not authorized"):
        render_commit_sql("go senior enrich load", [], [])
    require_production_authorization(GO_PHRASE)


def test_execute_dry_run_rejects_commit_and_commit_mode_checks_phrase() -> None:
    class Recorder:
        def __init__(self) -> None:
            self.calls = 0

        def execute(self, sql: str) -> None:
            self.calls += 1
            self.sql = sql

    recorder = Recorder()
    execute_rendered_sql(
        recorder,
        "DO $$ BEGIN RAISE EXCEPTION 'SENIOR_ENRICH_DRY_RUN {}'; END $$;\n",
        mode="dry_run",
        phrase=None,
    )
    assert recorder.calls == 1
    with pytest.raises(SeniorEnrichReject):
        execute_rendered_sql(recorder, "BEGIN;\nCOMMIT;\n", mode="dry_run", phrase=GO_PHRASE)
    with pytest.raises(SeniorEnrichReject):
        execute_rendered_sql(recorder, "BEGIN;\nCOMMIT;\n", mode="commit", phrase="no")
    assert recorder.calls == 1


def test_cli_commit_flag_does_not_open_a_load(tmp_path: Path) -> None:
    candidate = tmp_path / "final-publish-candidate-2026-10-14.csv"
    candidate.write_text("unused\n", encoding="utf-8")
    code = main(["--candidate", str(candidate), "--commit", "--authorize", GO_PHRASE])
    assert code == 2


def test_rollback_manifest_omits_contact_and_stays_outside_git(tmp_path: Path) -> None:
    observation = plan_observations([candidate(email="alpha@example.com")])
    email = next(row for row in observation if row.observation_type == "email")
    destination = tmp_path / "rollback-manifest.csv"
    write_rollback_manifest(destination, [email])
    text = destination.read_text(encoding="utf-8")
    assert "alpha@example.com" not in text
    assert "website" not in text or "observation_type" in text
    with destination.open(encoding="utf-8", newline="\n") as handle:
        rows = list(csv.DictReader(handle))
    assert rows[0]["evidence_fingerprint"] == email.evidence_fingerprint
    assert rows[0]["rollback_method"] == "append_only_backup_restore"
    with pytest.raises(SeniorEnrichReject, match="git checkout"):
        assert_outside_git(Path(__file__).resolve().parents[1] / "output.csv")


def test_samples_keep_only_masked_fields() -> None:
    observation = ObservationPlan(
        provider_id="105000",
        provider_type="hospice",
        state="VA",
        grade="partial",
        observation_type="email",
        value="person@example.org",
        observed_phone=None,
        observed_url=None,
        evidence_fingerprint="a" * 64,
        provenance={"grade": "partial"},
    )
    sample = select_masked_samples([observation])[0]
    assert set(sample) == {"n", "provider_type", "grade", "observation_type", "masked_value"}
    assert sample["masked_value"] == "p***@e***.org"


def _render_contract_dry_run() -> str:
    rows = []
    for index in range(1910):
        rows.append(
            candidate(
                provider_id=f"{index:06d}",
                grade="strict" if index < 717 else "partial",
                website="https://example.invalid",
                phone_primary_cms="555-0100",
                email="a@example.invalid" if index < 725 else "",
            )
        )
    return render_dry_run_sql(rows, plan_observations(rows))
