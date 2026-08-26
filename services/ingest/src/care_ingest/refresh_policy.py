"""Pure CMS refresh policy: cadence, drift, sanity, retries, freshness, topology."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from importlib.resources import files
from typing import Any
from urllib.error import HTTPError, URLError

from .registry import load_registry

TRANSIENT_MARKERS = (
    "timeout",
    "temporarily",
    "connection",
    "network",
    "503",
    "502",
    "429",
    "reset",
)
VALIDATION_MARKERS = (
    "schema",
    "required column",
    "row count",
    "sanity",
    "identifier",
    "drift",
)
CAPACITY_MARKERS = ("disk", "no space", "memory", "out of memory", "temp space")

RUN_STATUSES = (
    "DISCOVERED",
    "NO_CHANGE",
    "FETCHED",
    "VALIDATED",
    "INGESTING",
    "DATA_LOADED_DERIVE_FAILED",
    "COMPLETE",
    "FAILED",
    "QUARANTINED",
    "ALREADY_RUNNING",
    "SKIPPED_DEPENDENCY",
)


@dataclass(frozen=True, slots=True)
class RefreshProgram:
    check_frequency: str
    max_transient_retries: int
    write_guard_env: str
    critical_sources: tuple[str, ...]
    sources: dict[str, dict[str, Any]]


def load_refresh_program() -> RefreshProgram:
    payload = json.loads(
        files("care_ingest.resources")
        .joinpath("cms_refresh_program.json")
        .read_text(encoding="utf-8")
    )
    if payload.get("program_version") != 1:
        raise ValueError("unsupported CMS refresh program version")
    return RefreshProgram(
        check_frequency=payload["check_frequency"],
        max_transient_retries=int(payload["max_transient_retries"]),
        write_guard_env=payload["write_guard_env"],
        critical_sources=tuple(payload["critical_sources"]),
        sources=payload["sources"],
    )


def program_for(dataset_key: str, program: RefreshProgram | None = None) -> dict[str, Any]:
    program = program or load_refresh_program()
    try:
        return program.sources[dataset_key]
    except KeyError as error:
        raise KeyError(f"dataset is not in the refresh program: {dataset_key}") from error


def topological_refresh_order(program: RefreshProgram | None = None) -> list[str]:
    program = program or load_refresh_program()
    remaining = dict(program.sources)
    ordered: list[str] = []
    while remaining:
        ready = [
            key
            for key, spec in remaining.items()
            if all(dep not in remaining for dep in spec.get("depends_on") or [])
        ]
        if not ready:
            raise ValueError("refresh program has a dependency cycle")
        ready.sort()
        ordered.extend(ready)
        for key in ready:
            remaining.pop(key)
    implemented = {source.dataset_key for source in load_registry() if source.enabled}
    return [key for key in ordered if key in implemented]


def classify_failure(error: BaseException | str) -> str:
    text = str(error).lower()
    if any(marker in text for marker in CAPACITY_MARKERS):
        return "CAPACITY"
    if any(marker in text for marker in VALIDATION_MARKERS):
        return "VALIDATION"
    if isinstance(error, TimeoutError | ConnectionError | HTTPError | URLError):
        return "TRANSIENT"
    if any(marker in text for marker in TRANSIENT_MARKERS):
        return "TRANSIENT"
    return "UNKNOWN"


def may_retry(failure_class: str, attempt: int, max_retries: int) -> bool:
    return failure_class == "TRANSIENT" and 0 < attempt <= max_retries


def schema_drift(required: set[str], actual: set[str]) -> list[str]:
    missing = sorted(required - actual)
    return [f"missing required column: {name}" for name in missing]


def row_count_violation(
    current: int,
    *,
    previous: int | None,
    min_row_count: int,
    max_drop_ratio: float,
) -> str | None:
    if current < min_row_count:
        return f"row count {current} below minimum {min_row_count}"
    if previous and previous > 0:
        drop = (previous - current) / previous
        if drop > max_drop_ratio:
            return (
                f"row count dropped from {previous} to {current} "
                f"({drop:.0%} > {max_drop_ratio:.0%} allowed)"
            )
    return None


def _stamp_key(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.date().isoformat()
    except ValueError:
        return text[:10] if len(text) >= 10 else text


def source_changed(
    *,
    previous_checksum: str | None,
    discovered_checksum: str | None,
    previous_modified: str | None,
    discovered_modified: str | None,
    previous_version: str | None = None,
    discovered_version: str | None = None,
) -> bool:
    if discovered_checksum and previous_checksum:
        return discovered_checksum != previous_checksum
    if discovered_version and previous_version:
        return discovered_version != previous_version
    previous_stamp = _stamp_key(previous_modified)
    discovered_stamp = _stamp_key(discovered_modified)
    if previous_stamp and discovered_stamp:
        return previous_stamp != discovered_stamp
    return True


def freshness_band(source_modified_at: datetime | None, sla_days: int, now: datetime) -> str:
    if source_modified_at is None:
        return "UNKNOWN"
    modified = (
        source_modified_at.replace(tzinfo=UTC)
        if source_modified_at.tzinfo is None
        else source_modified_at
    )
    current = now.replace(tzinfo=UTC) if now.tzinfo is None else now
    age = current - modified
    if age <= timedelta(days=sla_days):
        return "CURRENT"
    if age <= timedelta(days=sla_days * 2):
        return "AGING"
    return "STALE"


def platform_health(
    source_statuses: dict[str, str],
    source_bands: dict[str, str],
    critical: tuple[str, ...],
) -> str:
    failed_critical = [
        key
        for key in critical
        if source_statuses.get(key) in {"FAILED", "QUARANTINED", "DATA_LOADED_DERIVE_FAILED"}
    ]
    if failed_critical:
        return "FAILED"
    if any(band == "STALE" for band in source_bands.values()):
        return "STALE"
    degraded = any(
        status in {"FAILED", "QUARANTINED", "SKIPPED_DEPENDENCY", "DATA_LOADED_DERIVE_FAILED"}
        for status in source_statuses.values()
    ) or any(band == "AGING" for band in source_bands.values())
    if degraded:
        return "DEGRADED"
    return "HEALTHY"


def writes_enabled(
    environment: dict[str, str | None], program: RefreshProgram | None = None
) -> bool:
    program = program or load_refresh_program()
    return environment.get(program.write_guard_env) == "true"


def redact_secrets(text: str) -> str:
    lowered = text
    for marker in ("password=", "pwd=", "service_role", "postgres://", "postgresql://"):
        if marker in lowered.lower():
            return "[redacted]"
    return text


def directory_status_for_absent_ccn() -> str:
    return "ABSENT_FROM_CURRENT_DIRECTORY"


def npi_join_is_forbidden(strategy: str) -> bool:
    return strategy == "organization_identifier_join"
