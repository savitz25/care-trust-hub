"""Safe immutable local raw-source archive."""

from __future__ import annotations

import os
import shutil
import tempfile
from dataclasses import replace
from pathlib import Path

from .manifest import ReleaseManifest, sha256_file


class ReleaseConflictError(RuntimeError):
    """Raised when one logical release is observed with different bytes."""


def safe_filename(filename: str) -> str:
    candidate = Path(filename)
    if candidate.name != filename or filename in {"", ".", ".."}:
        raise ValueError(f"unsafe source filename: {filename!r}")
    return filename


class RawArchive:
    def __init__(self, data_root: Path) -> None:
        self.root = data_root.resolve() / "raw" / "cms"

    def release_dir(self, dataset_key: str, release_key: str) -> Path:
        for value, label in ((dataset_key, "dataset key"), (release_key, "release key")):
            if not value or Path(value).name != value or value in {".", ".."}:
                raise ValueError(f"unsafe {label}: {value!r}")
        destination = (self.root / dataset_key / release_key).resolve()
        if self.root not in destination.parents:
            raise ValueError("archive destination escaped the configured root")
        return destination

    def store(
        self, temporary_file: Path, manifest: ReleaseManifest
    ) -> tuple[Path, ReleaseManifest]:
        filename = safe_filename(manifest.original_filename)
        release_dir = self.release_dir(
            manifest.dataset_key, manifest.source_release_date or "unknown"
        )
        manifest_path = release_dir / "manifest.json"
        destination = release_dir / filename
        actual_checksum = sha256_file(temporary_file)
        if actual_checksum != manifest.sha256:
            raise ValueError("manifest checksum does not match downloaded bytes")

        if manifest_path.exists():
            existing = ReleaseManifest.from_path(manifest_path)
            if existing.sha256 != manifest.sha256:
                raise ReleaseConflictError(
                    f"release {manifest.dataset_key}/{manifest.source_release_date} already exists "
                    f"with checksum {existing.sha256}; received {manifest.sha256}"
                )
            if not destination.exists() or sha256_file(destination) != existing.sha256:
                raise ReleaseConflictError(
                    "archived file is missing or no longer matches its manifest"
                )
            return destination, existing

        release_dir.mkdir(parents=True, exist_ok=True)
        staged_data = release_dir / f".{filename}.partial"
        staged_manifest = release_dir / ".manifest.partial"
        try:
            shutil.copyfile(temporary_file, staged_data)
            staged_manifest.write_text(manifest.to_json(), encoding="utf-8", newline="\n")
            os.replace(staged_data, destination)
            os.replace(staged_manifest, manifest_path)
        finally:
            staged_data.unlink(missing_ok=True)
            staged_manifest.unlink(missing_ok=True)
        return destination, manifest

    def update_status(
        self,
        manifest_path: Path,
        status: str,
        transformation_version: str | None = None,
    ) -> ReleaseManifest:
        existing = ReleaseManifest.from_path(manifest_path)
        updated = replace(
            existing,
            ingestion_status=status,
            transformation_version=transformation_version or existing.transformation_version,
        )
        with tempfile.NamedTemporaryFile(
            "w", dir=manifest_path.parent, encoding="utf-8", delete=False
        ) as handle:
            handle.write(updated.to_json())
            temporary_manifest = Path(handle.name)
        os.replace(temporary_manifest, manifest_path)
        return updated
