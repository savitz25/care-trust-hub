"""Registry-driven CMS refresh orchestrator."""

from __future__ import annotations

import hashlib
import json
import logging
import os
from collections.abc import Callable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from .downloader import resolve_distribution
from .provider_information import SchemaDriftError
from .refresh_execute import execute_source_write
from .refresh_policy import (
    classify_failure,
    freshness_band,
    load_refresh_program,
    platform_health,
    program_for,
    redact_secrets,
    schema_drift,
    source_changed,
    topological_refresh_order,
    writes_enabled,
)
from .registry import get_source

LOGGER = logging.getLogger(__name__)

DiscoverFn = Callable[[str], dict[str, Any]]
WriteFn = Callable[..., dict[str, Any]]
FingerprintMap = dict[str, dict[str, Any]]


@dataclass
class SourceCheck:
    dataset_key: str
    status: str
    failure_class: str | None = None
    source_modified_at: str | None = None
    checksum: str | None = None
    version_identifier: str | None = None
    download_url: str | None = None
    previous_checksum: str | None = None
    error: str | None = None
    changed: bool | None = None


@dataclass
class RefreshReport:
    refresh_run_id: str
    mode: str
    status: str
    trigger: str
    started_at: str
    completed_at: str | None
    writes_enabled: bool
    sources: list[dict[str, Any]] = field(default_factory=list)
    health: str = "HEALTHY"
    directory: dict[str, Any] = field(default_factory=dict)

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"


def _now() -> datetime:
    return datetime.now(UTC)


def advisory_lock_id(dataset_key: str) -> int:
    digest = hashlib.sha256(f"cms-refresh:{dataset_key}".encode()).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFFFFFF


def _discover_cms(dataset_key: str) -> dict[str, Any]:
    source = get_source(dataset_key)
    distribution = resolve_distribution(source, timeout=30)
    return {
        "source_modified_at": distribution.get("release_date"),
        "published_at": distribution.get("released"),
        "version_identifier": distribution.get("source_version_identifier"),
        "download_url": distribution.get("download_url"),
        "source_period": distribution.get("source_period"),
        "checksum": None,
    }


def _connect(database_url: str):
    import psycopg

    connection = psycopg.connect(database_url)
    connection.execute("SET statement_timeout = 0")
    return connection


def inspect_capacity(database_url: str | None) -> dict[str, Any]:
    result: dict[str, Any] = {
        "database_size_bytes": None,
        "free_storage_bytes": None,
        "limitation": None,
    }
    if not database_url:
        result["limitation"] = "No database URL; capacity not queried."
        return result
    try:
        with _connect(database_url) as connection:
            size = connection.execute("SELECT pg_database_size(current_database())").fetchone()
            result["database_size_bytes"] = int(size[0]) if size else None
            result["limitation"] = (
                "Managed Postgres does not expose host free disk. "
                "Use COPY batching; do not delete historical evidence to free space."
            )
    except Exception as error:  # noqa: BLE001
        result["limitation"] = redact_secrets(str(error))
    return result


def last_successful_fingerprint(database_url: str | None, dataset_key: str) -> dict[str, Any]:
    empty = {
        "checksum": None,
        "modified": None,
        "version": None,
        "release_id": None,
        "rows_read": None,
    }
    if not database_url:
        return empty
    with _connect(database_url) as connection:
        row = connection.execute(
            """
            SELECT r.content_sha256, r.source_modified_at::text, r.source_version_identifier,
                   r.id, ir.rows_read
            FROM source_dataset d
            JOIN source_release r ON r.source_dataset_id = d.id
            JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
            WHERE d.dataset_key = %s
            ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
            LIMIT 1
            """,
            (dataset_key,),
        ).fetchone()
    if not row:
        return empty
    return {
        "checksum": row[0],
        "modified": row[1],
        "version": row[2],
        "release_id": str(row[3]),
        "rows_read": int(row[4]) if row[4] is not None else None,
    }


def current_directory_counts(database_url: str | None) -> dict[str, Any]:
    empty = {"ccn_count": None, "pi_release": None}
    if not database_url:
        return empty
    try:
        with _connect(database_url) as connection:
            row = connection.execute(
                """
                SELECT r.release_key, count(DISTINCT pi.identifier_value)::bigint
                FROM source_dataset d
                JOIN source_release r ON r.source_dataset_id = d.id
                JOIN ingest_run ir ON ir.source_release_id = r.id AND ir.status = 'succeeded'
                JOIN facility_snapshot fs ON fs.source_release_id = r.id
                JOIN provider_identifier pi ON pi.provider_id = fs.provider_id
                  AND pi.issuer = 'CMS' AND pi.identifier_type = 'CCN'
                  AND pi.valid_from IS NULL
                WHERE d.dataset_key = 'nursing-home-provider-information'
                GROUP BY r.release_key, r.source_modified_at
                ORDER BY r.source_modified_at DESC NULLS LAST, r.release_key DESC
                LIMIT 1
                """
            ).fetchone()
    except Exception as error:  # noqa: BLE001
        return {**empty, "error": redact_secrets(str(error))}
    if not row:
        return empty
    return {"pi_release": row[0], "ccn_count": int(row[1])}


def query_source_freshness(database_url: str) -> list[dict[str, Any]]:
    with _connect(database_url) as connection:
        rows = connection.execute(
            """
            SELECT dataset_key, display_name, cms_identifier, refresh_cadence, check_frequency,
                   freshness_sla_days, current_release, source_modified_at::text, source_period,
                   retrieved_at::text, last_success_at::text, last_ingest_status, freshness_band,
                   age_days, last_source_run_status, last_failure_at::text, last_healthy_status,
                   official_url
            FROM cms_source_freshness
            ORDER BY dataset_key
            """
        ).fetchall()
    columns = (
        "dataset_key",
        "display_name",
        "cms_identifier",
        "refresh_cadence",
        "check_frequency",
        "freshness_sla_days",
        "current_release",
        "source_modified_at",
        "source_period",
        "retrieved_at",
        "last_success_at",
        "last_ingest_status",
        "freshness_band",
        "age_days",
        "last_source_run_status",
        "last_failure_at",
        "last_healthy_status",
        "official_url",
    )
    return [dict(zip(columns, row, strict=True)) for row in rows]


def check_source(
    dataset_key: str,
    *,
    database_url: str | None = None,
    discover: DiscoverFn = _discover_cms,
    previous: dict[str, Any] | None = None,
) -> SourceCheck:
    prior = (
        previous if previous is not None else last_successful_fingerprint(database_url, dataset_key)
    )
    try:
        discovered = discover(dataset_key)
    except Exception as error:  # noqa: BLE001
        return SourceCheck(
            dataset_key=dataset_key,
            status="FAILED",
            failure_class=classify_failure(error),
            error=redact_secrets(str(error)),
            previous_checksum=prior.get("checksum"),
        )
    changed = source_changed(
        previous_checksum=prior.get("checksum"),
        discovered_checksum=discovered.get("checksum"),
        previous_modified=prior.get("modified"),
        discovered_modified=discovered.get("source_modified_at"),
        previous_version=prior.get("version"),
        discovered_version=discovered.get("version_identifier"),
    )
    known_prior = bool(prior.get("checksum") or prior.get("modified") or prior.get("version"))
    return SourceCheck(
        dataset_key=dataset_key,
        status="NO_CHANGE" if not changed and known_prior else "DISCOVERED",
        source_modified_at=discovered.get("source_modified_at"),
        checksum=discovered.get("checksum"),
        version_identifier=discovered.get("version_identifier"),
        download_url=discovered.get("download_url"),
        previous_checksum=prior.get("checksum"),
        changed=changed if known_prior else True,
    )


def validate_headers(required: set[str], actual: set[str]) -> None:
    drift = schema_drift(required, actual)
    if drift:
        raise SchemaDriftError("SCHEMA_DRIFT: " + "; ".join(drift))


def validate_row_count(current: int, dataset_key: str, previous: int | None = None) -> None:
    spec = program_for(dataset_key)
    from .refresh_policy import row_count_violation

    problem = row_count_violation(
        current,
        previous=previous,
        min_row_count=int(spec["min_row_count"]),
        max_drop_ratio=float(spec["max_drop_ratio"]),
    )
    if problem:
        raise ValueError("VALIDATION: " + problem)


def source_is_locked(active_ingests: set[str], dataset_key: str) -> bool:
    return dataset_key in active_ingests


def expire_stale_locks(database_url: str | None) -> int:
    if not database_url:
        return 0
    with _connect(database_url) as connection:
        with connection.transaction():
            result = connection.execute(
                """
                UPDATE cms_source_run
                SET status = 'FAILED',
                    failure_class = 'LOCK',
                    error = 'stale in-progress lock expired after 3 hours',
                    completed_at = now()
                WHERE status IN ('FETCHED', 'VALIDATED', 'INGESTING')
                  AND started_at < now() - interval '3 hours'
                """
            )
    return int(result.rowcount or 0)


def load_active_ingests(database_url: str | None) -> set[str]:
    if not database_url:
        return set()
    with _connect(database_url) as connection:
        rows = connection.execute(
            """
            SELECT DISTINCT dataset_key FROM cms_source_run
            WHERE status IN ('FETCHED','VALIDATED','INGESTING')
              AND started_at > now() - interval '3 hours'
            """
        ).fetchall()
    return {row[0] for row in rows}


def _persist_parent(database_url: str | None, report: RefreshReport) -> None:
    if not database_url:
        return
    from psycopg.types.json import Jsonb

    with _connect(database_url) as connection:
        with connection.transaction():
            exists = connection.execute(
                "SELECT 1 FROM cms_refresh_run WHERE id = %s",
                (report.refresh_run_id,),
            ).fetchone()
            if exists:
                connection.execute(
                    """
                    UPDATE cms_refresh_run
                    SET status = %s, completed_at = %s, writes_enabled = %s, artifact = %s
                    WHERE id = %s
                    """,
                    (
                        report.health,
                        report.completed_at,
                        report.writes_enabled,
                        Jsonb(asdict(report)),
                        report.refresh_run_id,
                    ),
                )
            else:
                connection.execute(
                    """
                    INSERT INTO cms_refresh_run (
                      id, mode, status, started_at, completed_at,
                      trigger, writes_enabled, artifact
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                    """,
                    (
                        report.refresh_run_id,
                        report.mode,
                        report.status if report.completed_at else "RUNNING",
                        report.started_at,
                        report.completed_at,
                        report.trigger,
                        report.writes_enabled,
                        Jsonb(asdict(report)),
                    ),
                )


def _persist_source(
    database_url: str | None,
    parent_id: str,
    source: dict[str, Any],
    *,
    source_run_id: str,
) -> None:
    if not database_url:
        return
    from psycopg.errors import UniqueViolation
    from psycopg.types.json import Jsonb

    checksum = source.get("checksum")
    if checksum and not (isinstance(checksum, str) and len(checksum) == 64 and checksum.isalnum()):
        checksum = None
    params = (
        source_run_id,
        parent_id,
        source["dataset_key"],
        source.get("status"),
        source.get("failure_class"),
        source.get("source_modified_at"),
        checksum,
        source.get("error"),
        Jsonb(source),
        source.get("completed_at"),
        source.get("rows_read") or source.get("record_count"),
        source.get("source_release_id"),
    )
    with _connect(database_url) as connection:
        with connection.transaction():
            exists = connection.execute(
                "SELECT 1 FROM cms_source_run WHERE id = %s",
                (source_run_id,),
            ).fetchone()
            try:
                if exists:
                    connection.execute(
                        """
                        UPDATE cms_source_run SET
                          status = %s, failure_class = %s, source_modified_at = %s,
                          checksum = %s, error = %s, metrics = %s, completed_at = %s,
                          record_count = %s, source_release_id = %s
                        WHERE id = %s
                        """,
                        (
                            source.get("status"),
                            source.get("failure_class"),
                            source.get("source_modified_at"),
                            checksum,
                            source.get("error"),
                            Jsonb(source),
                            source.get("completed_at"),
                            source.get("rows_read") or source.get("record_count"),
                            source.get("source_release_id"),
                            source_run_id,
                        ),
                    )
                else:
                    connection.execute(
                        """
                        INSERT INTO cms_source_run (
                          id, refresh_run_id, dataset_key, status, failure_class,
                          source_modified_at, checksum, error, metrics, completed_at,
                          record_count, source_release_id
                        ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        """,
                        params,
                    )
            except UniqueViolation:
                raise


def _classify_write_status(error: BaseException) -> tuple[str, str]:
    text = str(error)
    failure = classify_failure(error)
    if isinstance(error, SchemaDriftError) or "SCHEMA_DRIFT" in text:
        return "QUARANTINED", "VALIDATION"
    return "FAILED", failure


def run_refresh(
    *,
    mode: str,
    database_url: str | None,
    data_root: Path,
    trigger: str = "manual",
    sources: list[str] | None = None,
    environment: dict[str, str | None] | None = None,
    discover: DiscoverFn = _discover_cms,
    write_source: WriteFn | None = None,
    fingerprints: FingerprintMap | None = None,
    active_ingests: set[str] | None = None,
) -> RefreshReport:
    if mode not in {"check", "refresh", "dry_run"}:
        raise ValueError("mode must be check, refresh, or dry_run")
    env = environment or dict(os.environ)
    program = load_refresh_program()
    allow_writes = mode == "refresh" and writes_enabled(env, program)
    started = _now()
    report = RefreshReport(
        refresh_run_id=str(uuid4()),
        mode=mode,
        status="RUNNING",
        trigger=trigger,
        started_at=started.isoformat(),
        completed_at=None,
        writes_enabled=allow_writes,
    )
    order = sources or topological_refresh_order(program)
    failed_parents: set[str] = set()
    statuses: dict[str, str] = {}
    bands: dict[str, str] = {}
    if mode != "dry_run":
        expire_stale_locks(database_url)
    active = (
        set()
        if mode == "dry_run"
        else (active_ingests if active_ingests is not None else load_active_ingests(database_url))
    )
    writer = write_source or execute_source_write
    if mode != "dry_run":
        try:
            _persist_parent(database_url, report)
        except Exception as error:  # noqa: BLE001
            LOGGER.warning("refresh parent persist failed: %s", redact_secrets(str(error)))

    for dataset_key in order:
        spec = program_for(dataset_key, program)
        source_run_id = str(uuid4())
        prior = (
            fingerprints.get(dataset_key, {})
            if fingerprints is not None
            else last_successful_fingerprint(
                None if mode == "dry_run" else database_url, dataset_key
            )
        )
        blocked = [dep for dep in spec.get("depends_on") or [] if dep in failed_parents]
        if blocked:
            payload = {
                "id": source_run_id,
                "dataset_key": dataset_key,
                "status": "SKIPPED_DEPENDENCY",
                "failure_class": "DEPENDENCY",
                "error": f"skipped because {blocked} failed",
                "completed_at": _now().isoformat(),
            }
            statuses[dataset_key] = "SKIPPED_DEPENDENCY"
            report.sources.append(payload)
            _safe_persist_source(database_url, report, payload, source_run_id)
            continue
        if source_is_locked(active, dataset_key):
            payload = {
                "id": source_run_id,
                "dataset_key": dataset_key,
                "status": "ALREADY_RUNNING",
                "failure_class": "LOCK",
                "completed_at": _now().isoformat(),
            }
            statuses[dataset_key] = "ALREADY_RUNNING"
            report.sources.append(payload)
            _safe_persist_source(database_url, report, payload, source_run_id)
            continue
        check = check_source(
            dataset_key,
            database_url=None if mode == "dry_run" else database_url,
            discover=discover,
            previous=prior,
        )
        payload = asdict(check)
        payload["id"] = source_run_id
        if check.status == "FAILED":
            statuses[dataset_key] = "FAILED"
            if spec.get("pause_dependents_on_failure"):
                failed_parents.add(dataset_key)
            payload["completed_at"] = _now().isoformat()
            report.sources.append(payload)
            _safe_persist_source(database_url, report, payload, source_run_id)
            continue
        if check.status == "NO_CHANGE" or check.changed is False:
            statuses[dataset_key] = "NO_CHANGE"
            payload["status"] = "NO_CHANGE"
            payload["completed_at"] = _now().isoformat()
            report.sources.append(payload)
            _safe_persist_source(database_url, report, payload, source_run_id)
            continue
        if mode in {"check", "dry_run"} or not allow_writes:
            statuses[dataset_key] = "DISCOVERED"
            payload["status"] = "DISCOVERED"
            payload["note"] = "changed source detected; writes not enabled in this mode"
            payload["completed_at"] = _now().isoformat()
            report.sources.append(payload)
            _safe_persist_source(database_url, report, payload, source_run_id)
            continue
        payload["status"] = "INGESTING"
        payload["started_at"] = _now().isoformat()
        try:
            _persist_source(
                database_url, report.refresh_run_id, payload, source_run_id=source_run_id
            )
        except Exception as error:  # noqa: BLE001
            from psycopg.errors import UniqueViolation

            if isinstance(error, UniqueViolation):
                payload["status"] = "ALREADY_RUNNING"
                payload["failure_class"] = "LOCK"
                payload["completed_at"] = _now().isoformat()
                statuses[dataset_key] = "ALREADY_RUNNING"
                report.sources.append(payload)
                continue
            LOGGER.warning("source lock persist failed: %s", redact_secrets(str(error)))
        active.add(dataset_key)

        def _on_status(
            status: str,
            metrics: dict[str, Any] | None = None,
            *,
            current: dict[str, Any] = payload,
            run_id: str = source_run_id,
        ) -> None:
            current["status"] = status
            if metrics:
                current.update(metrics)
            _safe_persist_source(database_url, report, current, run_id)

        try:
            written = writer(
                dataset_key,
                data_root=data_root,
                database_url=database_url,
                previous_row_count=prior.get("rows_read") if prior else None,
                previous_checksum=prior.get("checksum") if prior else None,
                on_status=_on_status,
            )
            payload.update(written)
            payload["status"] = written.get("status", "COMPLETE")
            payload["completed_at"] = _now().isoformat()
            statuses[dataset_key] = payload["status"]
            if payload["status"] in {"FAILED", "QUARANTINED"} and spec.get(
                "pause_dependents_on_failure"
            ):
                failed_parents.add(dataset_key)
        except Exception as error:  # noqa: BLE001
            status, failure = _classify_write_status(error)
            payload["status"] = status
            payload["failure_class"] = failure
            payload["error"] = redact_secrets(str(error))
            payload["completed_at"] = _now().isoformat()
            statuses[dataset_key] = status
            if spec.get("pause_dependents_on_failure"):
                failed_parents.add(dataset_key)
        report.sources.append(payload)
        _safe_persist_source(database_url, report, payload, source_run_id)
        active.discard(dataset_key)

    for dataset_key in order:
        spec = program_for(dataset_key, program)
        previous = (
            fingerprints.get(dataset_key, {})
            if fingerprints is not None
            else last_successful_fingerprint(database_url, dataset_key)
        )
        modified = None
        if previous.get("modified"):
            try:
                modified = datetime.fromisoformat(str(previous["modified"]).replace("Z", "+00:00"))
            except ValueError:
                modified = None
        bands[dataset_key] = freshness_band(modified, int(spec["freshness_sla_days"]), _now())

    report.directory = current_directory_counts(database_url)
    report.health = platform_health(statuses, bands, program.critical_sources)
    report.status = report.health
    report.completed_at = _now().isoformat()
    if mode != "dry_run":
        try:
            _persist_parent(database_url, report)
        except Exception as error:  # noqa: BLE001
            LOGGER.warning("refresh artifact persist failed: %s", redact_secrets(str(error)))
    return report


def _safe_persist_source(
    database_url: str | None,
    report: RefreshReport,
    payload: dict[str, Any],
    source_run_id: str,
) -> None:
    if report.mode == "dry_run":
        return
    try:
        _persist_source(database_url, report.refresh_run_id, payload, source_run_id=source_run_id)
    except Exception as error:  # noqa: BLE001
        LOGGER.warning("source run persist failed: %s", redact_secrets(str(error)))


__all__ = [
    "RefreshReport",
    "SourceCheck",
    "advisory_lock_id",
    "check_source",
    "current_directory_counts",
    "expire_stale_locks",
    "inspect_capacity",
    "last_successful_fingerprint",
    "load_active_ingests",
    "query_source_freshness",
    "run_refresh",
    "source_is_locked",
    "validate_headers",
    "validate_row_count",
]
