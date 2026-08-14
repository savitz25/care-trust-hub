import json
from dataclasses import replace
from datetime import UTC, datetime
from pathlib import Path

import pytest

from care_ingest.manifest import ReleaseManifest, sha256_file
from care_ingest.provider_information import (
    SchemaDriftError,
    ingest_provider_information,
    source_record_locator,
    verify_schema,
)

FIXTURE = Path(__file__).parent / "fixtures" / "provider_information.csv"


def manifest(release: str = "2026-07-29") -> ReleaseManifest:
    return ReleaseManifest(
        manifest_version=1,
        dataset_key="nursing-home-provider-information",
        source_organization="Centers for Medicare & Medicaid Services (CMS)",
        cms_identifier="4pq5-n9py",
        official_source_url="https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        retrieval_timestamp=datetime(2026, 8, 14, tzinfo=UTC).isoformat(),
        source_release_date=release,
        original_filename=FIXTURE.name,
        byte_size=FIXTURE.stat().st_size,
        sha256=sha256_file(FIXTURE),
        content_type="text/csv",
        transformation_version=None,
        ingestion_status="downloaded",
    )


def test_schema_drift_stops_on_missing_identity_column() -> None:
    with pytest.raises(SchemaDriftError, match="CMS Certification Number"):
        verify_schema(["Provider Name"])


def test_provider_normalization_summary_and_locator(tmp_path: Path) -> None:
    summary = ingest_provider_information(FIXTURE, manifest(), tmp_path, write_outputs=False)
    assert summary.total_rows_read == 2
    assert summary.valid_rows == 2
    assert summary.rejected_rows == 0
    assert summary.states_represented == ["AL"]
    assert summary.normalized_provider_count == 2
    assert summary.warnings == ["1 additional columns preserved in raw records and not normalized"]
    assert source_record_locator(2, "015001") == "csv-row:2:ccn:015001"


def test_letter_bearing_cms_identifier_is_preserved() -> None:
    assert source_record_locator(2, "37E109") == "csv-row:2:ccn:37E109"


def test_duplicate_and_missing_ccn_are_rejected_and_preserved(tmp_path: Path) -> None:
    fixture = tmp_path / "duplicates.csv"
    rows = FIXTURE.read_text(encoding="utf-8").splitlines()
    missing = rows[1].replace("015001", "", 1)
    fixture.write_text("\n".join([rows[0], rows[1], rows[1], missing]) + "\n", encoding="utf-8")
    test_manifest = replace(
        manifest(),
        original_filename=fixture.name,
        byte_size=fixture.stat().st_size,
        sha256=sha256_file(fixture),
    )
    summary = ingest_provider_information(fixture, test_manifest, tmp_path, write_outputs=False)
    assert summary.total_rows_read == 3
    assert summary.valid_rows == 1
    assert summary.rejected_rows == 2
    assert summary.duplicate_provider_identifiers == 1
    assert summary.missing_critical_identifiers == 1


def test_two_releases_for_same_provider_coexist(tmp_path: Path) -> None:
    for release in ("2026-06-01", "2026-07-01"):
        release_dir = tmp_path / "raw" / "cms" / "nursing-home-provider-information" / release
        release_dir.mkdir(parents=True)
        source = release_dir / FIXTURE.name
        source.write_bytes(FIXTURE.read_bytes())
        release_manifest = replace(manifest(release), original_filename=source.name)
        (release_dir / "manifest.json").write_text(release_manifest.to_json(), encoding="utf-8")
        ingest_provider_information(source, release_manifest, tmp_path)

    first = (
        tmp_path
        / "normalized"
        / "cms"
        / "nursing-home-provider-information"
        / "2026-06-01"
        / "providers.jsonl"
    )
    second = (
        tmp_path
        / "normalized"
        / "cms"
        / "nursing-home-provider-information"
        / "2026-07-01"
        / "providers.jsonl"
    )
    assert first.exists() and second.exists()
    first_record = json.loads(first.read_text(encoding="utf-8").splitlines()[0])
    second_record = json.loads(second.read_text(encoding="utf-8").splitlines()[0])
    assert first_record["provider_identity"] == second_record["provider_identity"]
    assert (
        first_record["source_release"]["release_date"]
        != second_record["source_release"]["release_date"]
    )
