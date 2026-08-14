"""Dependency-free command line for source inspection and ingestion."""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

from .downloader import download_source, resolve_distribution
from .manifest import ReleaseManifest, sha256_file
from .provider_information import ingest_provider_information
from .registry import get_source, load_registry

PROVIDER_INFORMATION_KEY = "nursing-home-provider-information"


def default_data_root() -> Path:
    configured = os.environ.get("CARE_DATA_ROOT")
    if configured:
        return Path(configured).expanduser().resolve()
    return Path(__file__).resolve().parents[4] / "data"


def _release_paths(data_root: Path, dataset_key: str, release: str) -> tuple[Path, Path]:
    release_dir = data_root / "raw" / "cms" / dataset_key / release
    manifest_path = release_dir / "manifest.json"
    if not manifest_path.exists():
        raise FileNotFoundError(f"release manifest not found: {manifest_path}")
    manifest = ReleaseManifest.from_path(manifest_path)
    source_file = release_dir / manifest.original_filename
    return source_file, manifest_path


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="care-ingest", description="Care data ingestion")
    parser.add_argument("--data-root", type=Path, default=default_data_root())
    parser.add_argument("--verbose", action="store_true")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("list-sources", help="List configured authoritative sources")
    inspect = commands.add_parser("inspect-source", help="Inspect one source contract")
    inspect.add_argument("dataset_key")
    download = commands.add_parser("download", help="Download an enabled source release")
    download.add_argument("dataset_key", choices=[PROVIDER_INFORMATION_KEY])
    download.add_argument("--timeout", type=float, default=120)
    for name in ("validate", "ingest", "summarize"):
        command = commands.add_parser(name, help=f"{name.title()} an archived release")
        command.add_argument("dataset_key", choices=[PROVIDER_INFORMATION_KEY])
        command.add_argument("--release", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    data_root = args.data_root.resolve()

    if args.command == "list-sources":
        for source in load_registry():
            status = "IMPLEMENTED" if source.implemented else "PLANNED"
            print(
                f"{source.dataset_key}\t{status}\t{source.official_name}\t"
                f"{source.cms_identifier or 'unknown'}"
            )
        return 0
    if args.command == "inspect-source":
        source = get_source(args.dataset_key)
        payload = {field: getattr(source, field) for field in source.__dataclass_fields__}
        if source.enabled and source.metadata_url:
            payload["current_distribution"] = resolve_distribution(source)
        print(json.dumps(payload, indent=2, sort_keys=True))
        return 0
    if args.command == "download":
        path, manifest = download_source(get_source(args.dataset_key), data_root, args.timeout)
        print(f"Archived: {path}")
        print(manifest.to_json(), end="")
        return 0

    source_file, manifest_path = _release_paths(data_root, args.dataset_key, args.release)
    manifest = ReleaseManifest.from_path(manifest_path)
    if not source_file.exists() or sha256_file(source_file) != manifest.sha256:
        raise ValueError("archived source file is missing or does not match manifest checksum")
    if args.command == "validate":
        summary = ingest_provider_information(source_file, manifest, data_root, write_outputs=False)
        print(summary.to_json(), end="")
        return 1 if summary.rejected_rows else 0
    if args.command == "ingest":
        summary = ingest_provider_information(source_file, manifest, data_root)
        print(summary.to_json(), end="")
        return 1 if summary.rejected_rows else 0
    if args.command == "summarize":
        report = data_root / "reports" / "cms" / args.dataset_key / args.release / "summary.json"
        print(report.read_text(encoding="utf-8"), end="")
        return 0
    parser.error("unsupported command")
    return 2
