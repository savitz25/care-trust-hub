"""Immutable source-release manifest model."""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Literal

IngestionStatus = Literal["downloaded", "validated", "ingested", "failed"]


@dataclass(frozen=True, slots=True)
class ReleaseManifest:
    manifest_version: int
    dataset_key: str
    source_organization: str
    cms_identifier: str | None
    official_source_url: str
    retrieval_timestamp: str
    source_release_date: str | None
    original_filename: str
    byte_size: int
    sha256: str
    content_type: str
    transformation_version: str | None
    ingestion_status: IngestionStatus

    def to_json(self) -> str:
        return json.dumps(asdict(self), indent=2, sort_keys=True) + "\n"

    @classmethod
    def from_path(cls, path: Path) -> ReleaseManifest:
        return cls(**json.loads(path.read_text(encoding="utf-8")))


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()
