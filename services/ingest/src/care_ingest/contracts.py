"""Stable contracts shared by future source adapters."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass(frozen=True, slots=True)
class SourceRelease:
    """Metadata proving which immutable source bytes an ingest run used."""

    dataset_key: str
    release_key: str
    retrieved_at: datetime
    sha256: str
    transformation_version: str

    def validate(self) -> None:
        if not self.dataset_key.strip() or not self.release_key.strip():
            raise ValueError("dataset_key and release_key are required")
        if self.retrieved_at.tzinfo is None:
            raise ValueError("retrieved_at must be timezone-aware")
        if len(self.sha256) != 64 or any(char not in "0123456789abcdef" for char in self.sha256):
            raise ValueError("sha256 must be 64 lowercase hexadecimal characters")
        if not self.transformation_version.strip():
            raise ValueError("transformation_version is required")


class SourceAdapter(Protocol):
    """Boundary for a verified federal or state source implementation."""

    dataset_key: str

    def validate_release(self, release: SourceRelease) -> None: ...
