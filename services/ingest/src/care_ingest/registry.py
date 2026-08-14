"""Version-controlled CMS source registry."""

from __future__ import annotations

import json
from dataclasses import dataclass
from importlib.resources import files
from typing import Any
from urllib.parse import urlparse


@dataclass(frozen=True, slots=True)
class SourceDefinition:
    dataset_key: str
    source_organization: str
    official_name: str
    cms_identifier: str | None
    official_landing_page: str
    metadata_url: str | None
    expected_format: str
    update_cadence: str
    provider_type: str
    historical_archive_availability: str
    schema_verification_state: str
    documentation_url: str
    enabled: bool
    implemented: bool
    notes: str


def load_registry() -> tuple[SourceDefinition, ...]:
    resource = files("care_ingest.resources").joinpath("cms_sources.json")
    payload: dict[str, Any] = json.loads(resource.read_text(encoding="utf-8"))
    if payload.get("registry_version") != 1:
        raise ValueError("unsupported CMS source registry version")
    sources = tuple(SourceDefinition(**entry) for entry in payload.get("sources", []))
    validate_registry(sources)
    return sources


def validate_registry(sources: tuple[SourceDefinition, ...]) -> None:
    if not sources:
        raise ValueError("CMS source registry must not be empty")
    keys = [source.dataset_key for source in sources]
    if len(keys) != len(set(keys)):
        raise ValueError("CMS source dataset keys must be unique")
    for source in sources:
        if not source.dataset_key or source.dataset_key != source.dataset_key.lower():
            raise ValueError(f"invalid dataset key: {source.dataset_key!r}")
        for url in (source.official_landing_page, source.documentation_url, source.metadata_url):
            if url is not None and (
                urlparse(url).scheme != "https" or urlparse(url).hostname != "data.cms.gov"
            ):
                raise ValueError(f"source URL must be an official HTTPS data.cms.gov URL: {url}")
        if source.enabled and not source.implemented:
            raise ValueError(f"enabled source is not implemented: {source.dataset_key}")


def get_source(dataset_key: str) -> SourceDefinition:
    try:
        return next(source for source in load_registry() if source.dataset_key == dataset_key)
    except StopIteration as error:
        raise KeyError(f"unknown dataset key: {dataset_key}") from error
