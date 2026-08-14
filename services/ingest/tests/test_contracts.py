from datetime import UTC, datetime

import pytest

from care_ingest import SourceRelease


def test_valid_source_release_proves_lineage() -> None:
    release = SourceRelease(
        dataset_key="synthetic-test-dataset",
        release_key="synthetic-release-001",
        retrieved_at=datetime(2026, 1, 1, tzinfo=UTC),
        sha256="a" * 64,
        transformation_version="test-v1",
    )
    release.validate()


def test_naive_retrieval_timestamp_is_rejected() -> None:
    release = SourceRelease(
        dataset_key="synthetic-test-dataset",
        release_key="synthetic-release-001",
        retrieved_at=datetime(2026, 1, 1),
        sha256="a" * 64,
        transformation_version="test-v1",
    )
    with pytest.raises(ValueError, match="timezone-aware"):
        release.validate()
