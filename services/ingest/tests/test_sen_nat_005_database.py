import os
from uuid import uuid4

import pytest

from care_ingest.refresh import expire_stale_locks, run_refresh

DATABASE_URL = os.environ.get("CARE_DATABASE_URL")
pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def require_database() -> None:
    if not DATABASE_URL:
        pytest.skip("CARE_DATABASE_URL is not configured")


def _connect():
    import psycopg

    return psycopg.connect(DATABASE_URL)


def _governance_ready() -> bool:
    with _connect() as connection:
        return (
            connection.execute("SELECT to_regclass('public.cms_refresh_run')").fetchone()[0]
            is not None
        )


def test_overlapping_source_runs_are_blocked_by_unique_lock() -> None:
    if not _governance_ready():
        pytest.skip("cms refresh governance tables are not applied")
    from psycopg.errors import UniqueViolation

    parent = str(uuid4())
    first = str(uuid4())
    second = str(uuid4())
    key = "nursing-home-penalties"
    with _connect() as connection:
        with connection.transaction():
            connection.execute(
                """
                INSERT INTO cms_refresh_run (id, mode, status, trigger, writes_enabled)
                VALUES (%s, 'refresh', 'RUNNING', 'manual', false)
                """,
                (parent,),
            )
            connection.execute(
                """
                INSERT INTO cms_source_run (id, refresh_run_id, dataset_key, status)
                VALUES (%s, %s, %s, 'INGESTING')
                """,
                (first, parent, key),
            )
        with pytest.raises(UniqueViolation, match="cms_source_run_active_lock"):
            with connection.transaction():
                connection.execute(
                    """
                    INSERT INTO cms_source_run (id, refresh_run_id, dataset_key, status)
                    VALUES (%s, %s, %s, 'INGESTING')
                    """,
                    (second, parent, key),
                )
        with connection.transaction():
            connection.execute(
                "UPDATE cms_source_run SET status = 'COMPLETE', completed_at = now() WHERE id = %s",
                (first,),
            )
            connection.execute(
                """
                INSERT INTO cms_source_run (id, refresh_run_id, dataset_key, status)
                VALUES (%s, %s, %s, 'INGESTING')
                """,
                (second, parent, key),
            )
            connection.execute(
                "UPDATE cms_source_run SET status = 'COMPLETE', completed_at = now() WHERE id = %s",
                (second,),
            )


def test_stale_lock_expiry_releases_dataset() -> None:
    if not _governance_ready():
        pytest.skip("cms refresh governance tables are not applied")
    parent = str(uuid4())
    stale = str(uuid4())
    with _connect() as connection:
        with connection.transaction():
            connection.execute(
                """
                INSERT INTO cms_refresh_run (id, mode, status, trigger)
                VALUES (%s, 'refresh', 'RUNNING', 'manual')
                """,
                (parent,),
            )
            connection.execute(
                """
                INSERT INTO cms_source_run (id, refresh_run_id, dataset_key, status, started_at)
                VALUES (%s, %s, 'nursing-home-ownership', 'INGESTING', now() - interval '4 hours')
                """,
                (stale, parent),
            )
    assert expire_stale_locks(DATABASE_URL) >= 1
    with _connect() as connection:
        status = connection.execute(
            "SELECT status, failure_class FROM cms_source_run WHERE id = %s",
            (stale,),
        ).fetchone()
    assert status[0] == "FAILED"
    assert status[1] == "LOCK"


def test_freshness_view_is_queryable() -> None:
    if not _governance_ready():
        pytest.skip("cms refresh governance tables are not applied")
    with _connect() as connection:
        count = connection.execute("SELECT count(*) FROM cms_refresh_source_policy").fetchone()[0]
        connection.execute("SELECT dataset_key, freshness_band FROM cms_source_freshness LIMIT 1")
    assert count == 13


def test_check_mode_persists_parent_and_source_runs(tmp_path) -> None:
    if not _governance_ready():
        pytest.skip("cms refresh governance tables are not applied")

    def discover(_key: str) -> dict:
        return {
            "source_modified_at": "2099-01-01",
            "checksum": None,
            "version_identifier": "fixture",
        }

    report = run_refresh(
        mode="check",
        database_url=DATABASE_URL,
        data_root=tmp_path,
        trigger="manual",
        sources=["nursing-home-chain-performance-measures"],
        discover=discover,
        environment={},
    )
    assert report.sources[0]["status"] in {"DISCOVERED", "NO_CHANGE"}
    with _connect() as connection:
        parent = connection.execute(
            "SELECT mode, trigger, writes_enabled FROM cms_refresh_run WHERE id = %s",
            (report.refresh_run_id,),
        ).fetchone()
        child = connection.execute(
            "SELECT dataset_key, status FROM cms_source_run WHERE refresh_run_id = %s",
            (report.refresh_run_id,),
        ).fetchone()
    assert parent[0] == "check"
    assert parent[1] == "manual"
    assert parent[2] is False
    assert child[0] == "nursing-home-chain-performance-measures"
