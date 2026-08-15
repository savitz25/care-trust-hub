"""Apply one reviewed repository migration to PostgreSQL."""

from __future__ import annotations

import re
from pathlib import Path

import psycopg

MIGRATION_NAME = re.compile(r"^\d{4}_[a-z0-9_]+\.sql$")


def apply_migration(database_url: str, migrations_dir: Path, migration_name: str) -> None:
    if not MIGRATION_NAME.fullmatch(migration_name):
        raise ValueError("migration name must use the repository migration naming convention")
    root = migrations_dir.resolve()
    migration = (root / migration_name).resolve()
    if root not in migration.parents or not migration.is_file():
        raise ValueError("migration must be an existing file in db/migrations")
    sql = migration.read_text(encoding="utf-8")
    with psycopg.connect(database_url) as connection:
        connection.execute(sql)
