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
