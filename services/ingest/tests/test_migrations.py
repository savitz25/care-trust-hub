from pathlib import Path

import pytest

from care_ingest.migrations import apply_migration


def test_migration_path_is_restricted_before_connecting(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="naming convention"):
        apply_migration("unused", tmp_path, "../secret.sql")
    with pytest.raises(ValueError, match="existing file"):
        apply_migration("unused", tmp_path, "0004_missing.sql")
