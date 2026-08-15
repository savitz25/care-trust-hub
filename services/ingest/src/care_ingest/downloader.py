"""Deterministic downloader for allowlisted official CMS distributions."""

from __future__ import annotations

import json
import logging
import tempfile
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from .archive import RawArchive, safe_filename
from .manifest import ReleaseManifest, sha256_file
from .registry import SourceDefinition

LOGGER = logging.getLogger(__name__)
ALLOWED_HOSTS = {"data.cms.gov"}
USER_AGENT = "care-intelligence-ingest/0.1 (+https://github.com/savitz25/care-trust-hub)"


class DownloadError(RuntimeError):
    """Descriptive CMS retrieval failure."""


def _request(url: str, timeout: float):
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"URL is not an allowlisted official CMS HTTPS URL: {url}")
    try:
        return urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=timeout)
    except (HTTPError, URLError, TimeoutError) as error:
        raise DownloadError(f"CMS request failed for {url}: {error}") from error


def resolve_distribution(
    source: SourceDefinition, timeout: float = 30, source_period: str | None = None
) -> dict[str, Any]:
    if not source.metadata_url:
        raise DownloadError(f"source has no implemented metadata strategy: {source.dataset_key}")
    with _request(source.metadata_url, timeout) as response:
        metadata: dict[str, Any] = json.load(response)
    if source.dataset_key == "payroll-based-journal-daily-nurse-staffing":
        datasets = metadata.get("dataset", [])
        metadata = next(
            (item for item in datasets if item.get("title") == source.official_name), None
        )
        if metadata is None:
            raise DownloadError("official CMS catalog did not contain the PBJ nurse dataset")
        distributions = metadata.get("distribution", [])
        latest = next(
            (
                item
                for item in distributions
                if item.get("description") == "latest" and item.get("format") == "API"
            ),
            None,
        )
        if latest is None:
            raise DownloadError("official CMS catalog did not identify the latest PBJ release")
        selected = latest
        if source_period is not None:
            if len(source_period) != 6 or source_period[4] != "Q" or source_period[5] not in "1234":
                raise ValueError("PBJ source period must use YYYYQn")
            year, quarter = int(source_period[:4]), int(source_period[5])
            month = (quarter - 1) * 3 + 1
            prefix = f"{year:04d}-{month:02d}-01/"
            selected = next(
                (
                    item
                    for item in distributions
                    if item.get("format") == "API"
                    and item.get("description") != "latest"
                    and item.get("temporal", "").startswith(prefix)
                ),
                None,
            )
            if selected is None:
                raise DownloadError(
                    f"official CMS catalog has no fixed PBJ release for {source_period}"
                )
        csv_distribution = next(
            (
                item
                for item in distributions
                if item.get("mediaType") == "text/csv"
                and item.get("downloadURL")
                and item.get("temporal") == selected.get("temporal")
                and item.get("modified") == selected.get("modified")
            ),
            None,
        )
        fixed_api = next(
            (
                item
                for item in distributions
                if item.get("format") == "API"
                and item.get("description") != "latest"
                and item.get("temporal") == selected.get("temporal")
                and item.get("modified") == selected.get("modified")
            ),
            None,
        )
        if csv_distribution is None or fixed_api is None:
            raise DownloadError("official CMS catalog PBJ release metadata is incomplete")
        period_start, period_end = selected["temporal"].split("/", maxsplit=1)
        year, month = period_start[:4], int(period_start[5:7])
        return {
            "download_url": csv_distribution["downloadURL"],
            "content_type": csv_distribution["mediaType"],
            "release_date": selected.get("modified"),
            "released": None,
            "official_source_url": source.official_landing_page,
            "source_period": f"{year}Q{((month - 1) // 3) + 1}",
            "coverage_start": period_start,
            "coverage_end": period_end,
            "source_version_identifier": fixed_api["accessURL"].split("/dataset/")[1].split("/")[0],
        }
    distributions = metadata.get("distribution", [])
    csv_distribution = next(
        (
            item
            for item in distributions
            if item.get("mediaType") in {"text/csv", "application/csv"} and item.get("downloadURL")
        ),
        None,
    )
    if csv_distribution is None:
        raise DownloadError("official CMS metadata did not contain a CSV distribution")
    return {
        "download_url": csv_distribution["downloadURL"],
        "content_type": csv_distribution["mediaType"],
        "release_date": metadata.get("modified"),
        "released": metadata.get("released"),
        "official_source_url": metadata.get("landingPage", source.official_landing_page),
        "source_period": None,
        "source_version_identifier": None,
    }


def download_source(
    source: SourceDefinition,
    data_root: Path,
    timeout: float = 120,
    source_period: str | None = None,
) -> tuple[Path, ReleaseManifest]:
    if not source.enabled or not source.implemented:
        raise DownloadError(f"source is not enabled for download: {source.dataset_key}")
    distribution = resolve_distribution(source, min(timeout, 30), source_period)
    url = distribution["download_url"]
    filename = safe_filename(Path(urlparse(url).path).name)
    LOGGER.info("Downloading %s from official CMS distribution", source.dataset_key)
    with tempfile.NamedTemporaryFile("wb", delete=False) as handle:
        temporary_path = Path(handle.name)
        try:
            with _request(url, timeout) as response:
                while chunk := response.read(1024 * 1024):
                    handle.write(chunk)
        except Exception:
            temporary_path.unlink(missing_ok=True)
            raise
    try:
        checksum = sha256_file(temporary_path)
        manifest = ReleaseManifest(
            manifest_version=2,
            dataset_key=source.dataset_key,
            source_organization=source.source_organization,
            cms_identifier=source.cms_identifier,
            official_source_url=distribution["official_source_url"],
            retrieval_timestamp=datetime.now(UTC).isoformat(),
            source_release_date=distribution["release_date"],
            original_filename=filename,
            byte_size=temporary_path.stat().st_size,
            sha256=checksum,
            content_type=distribution["content_type"],
            transformation_version=None,
            ingestion_status="downloaded",
            source_modified_at=distribution["release_date"],
            published_at=distribution["released"],
            source_period=distribution["source_period"],
            source_version_identifier=distribution["source_version_identifier"],
        )
        return RawArchive(data_root).store(temporary_path, manifest)
    finally:
        temporary_path.unlink(missing_ok=True)
