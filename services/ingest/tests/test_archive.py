from datetime import UTC, datetime
from pathlib import Path

import pytest

from care_ingest.archive import RawArchive, ReleaseConflictError, safe_filename
from care_ingest.manifest import ReleaseManifest, sha256_file


def manifest_for(path: Path, checksum: str) -> ReleaseManifest:
    return ReleaseManifest(
        manifest_version=1,
        dataset_key="nursing-home-provider-information",
        source_organization="Centers for Medicare & Medicaid Services (CMS)",
        cms_identifier="4pq5-n9py",
        official_source_url="https://data.cms.gov/provider-data/dataset/4pq5-n9py",
        retrieval_timestamp=datetime(2026, 8, 14, tzinfo=UTC).isoformat(),
        source_release_date="2026-07-29",
        original_filename=path.name,
        byte_size=path.stat().st_size,
        sha256=checksum,
        content_type="text/csv",
        transformation_version=None,
        ingestion_status="downloaded",
    )


def test_manifest_round_trip_and_checksum(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    source.write_bytes(b"header\nvalue\n")
    manifest = manifest_for(source, sha256_file(source))
    path = tmp_path / "manifest.json"
    path.write_text(manifest.to_json(), encoding="utf-8")
    assert ReleaseManifest.from_path(path) == manifest
    assert len(manifest.sha256) == 64


def test_archive_is_idempotent_and_detects_conflicting_release(tmp_path: Path) -> None:
    source = tmp_path / "source.csv"
    source.write_bytes(b"first bytes")
    archive = RawArchive(tmp_path / "data")
    manifest = manifest_for(source, sha256_file(source))
    first_path, first_manifest = archive.store(source, manifest)
    second_path, second_manifest = archive.store(source, manifest)
    assert first_path == second_path
    assert first_manifest == second_manifest

    conflicting = tmp_path / "conflict.csv"
    conflicting.write_bytes(b"different bytes")
    with pytest.raises(ReleaseConflictError, match="already exists"):
        archive.store(conflicting, manifest_for(conflicting, sha256_file(conflicting)))


@pytest.mark.parametrize("filename", ["../escape.csv", "folder/file.csv", "", ".."])
def test_safe_filename_rejects_path_traversal(filename: str) -> None:
    with pytest.raises(ValueError, match="unsafe"):
        safe_filename(filename)
