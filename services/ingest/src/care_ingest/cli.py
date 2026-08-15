"""Dependency-free command line for source inspection and ingestion."""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

from .database import load_provider_information
from .downloader import download_source, resolve_distribution
from .manifest import ReleaseManifest, sha256_file
from .migrations import apply_migration
from .pbj import PBJ_NURSE_KEY, ingest_pbj_source
from .pbj_database import audit_pbj_database, load_pbj_source
from .provider_information import ingest_provider_information
from .quality import write_quality_report
from .registry import get_source, load_registry
from .regulatory import (
    DEFICIENCIES_KEY,
    INSPECTIONS_KEY,
    PENALTIES_KEY,
    ingest_regulatory_source,
)
from .regulatory_database import audit_regulatory_database, load_regulatory_source

PROVIDER_INFORMATION_KEY = "nursing-home-provider-information"
REGULATORY_KEYS = (INSPECTIONS_KEY, DEFICIENCIES_KEY, PENALTIES_KEY)
IMPLEMENTED_KEYS = (PROVIDER_INFORMATION_KEY, *REGULATORY_KEYS, PBJ_NURSE_KEY)


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
    download.add_argument("dataset_key", choices=IMPLEMENTED_KEYS)
    download.add_argument("--timeout", type=float, default=120)
    download.add_argument("--source-period", help="Fixed PBJ quarter in YYYYQn form")
    for name in ("validate", "ingest", "summarize"):
        command = commands.add_parser(name, help=f"{name.title()} an archived release")
        command.add_argument("dataset_key", choices=IMPLEMENTED_KEYS)
        command.add_argument("--release", required=True)
    load = commands.add_parser("load", help="Transactionally load a normalized release")
    load.add_argument("dataset_key", choices=IMPLEMENTED_KEYS)
    load.add_argument("--release", required=True)
    load.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    report = commands.add_parser("report", help="Generate a release data-quality report")
    report.add_argument("dataset_key", choices=IMPLEMENTED_KEYS)
    report.add_argument("--release", required=True)
    migrate = commands.add_parser("apply-migration", help="Apply one reviewed SQL migration")
    migrate.add_argument("migration_name")
    migrate.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    audit = commands.add_parser("audit-regulatory", help="Audit regulatory database lineage")
    audit.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    staffing_audit = commands.add_parser("audit-staffing", help="Audit PBJ staffing database")
    staffing_audit.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    data_root = args.data_root.resolve()

    if args.command == "apply-migration":
        if not args.database_url:
            parser.error("apply-migration requires CARE_DATABASE_URL or --database-url")
        migrations_dir = Path(__file__).resolve().parents[4] / "db" / "migrations"
        apply_migration(args.database_url, migrations_dir, args.migration_name)
        print(f"Applied migration: {args.migration_name}")
        return 0
    if args.command == "audit-regulatory":
        if not args.database_url:
            parser.error("audit-regulatory requires CARE_DATABASE_URL or --database-url")
        print(json.dumps(audit_regulatory_database(args.database_url), indent=2, sort_keys=True))
        return 0
    if args.command == "audit-staffing":
        if not args.database_url:
            parser.error("audit-staffing requires CARE_DATABASE_URL or --database-url")
        print(json.dumps(audit_pbj_database(args.database_url), indent=2, sort_keys=True))
        return 0

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
        path, manifest = download_source(
            get_source(args.dataset_key), data_root, args.timeout, args.source_period
        )
        print(f"Archived: {path}")
        print(manifest.to_json(), end="")
        return 0

    source_file, manifest_path = _release_paths(data_root, args.dataset_key, args.release)
    manifest = ReleaseManifest.from_path(manifest_path)
    if not source_file.exists() or sha256_file(source_file) != manifest.sha256:
        raise ValueError("archived source file is missing or does not match manifest checksum")
    ingest_function = (
        ingest_provider_information
        if args.dataset_key == PROVIDER_INFORMATION_KEY
        else ingest_pbj_source
        if args.dataset_key == PBJ_NURSE_KEY
        else ingest_regulatory_source
    )
    if args.command == "validate":
        summary = ingest_function(source_file, manifest, data_root, write_outputs=False)
        print(summary.to_json(), end="")
        return 1 if summary.rejected_rows else 0
    if args.command == "ingest":
        summary = ingest_function(source_file, manifest, data_root)
        print(summary.to_json(), end="")
        return 1 if summary.rejected_rows else 0
    if args.command == "summarize":
        report = data_root / "reports" / "cms" / args.dataset_key / args.release / "summary.json"
        print(report.read_text(encoding="utf-8"), end="")
        return 0
    normalized_name = (
        "providers.jsonl" if args.dataset_key == PROVIDER_INFORMATION_KEY else "records.jsonl"
    )
    normalized = (
        data_root / "normalized" / "cms" / args.dataset_key / args.release / normalized_name
    )
    if args.command == "report":
        destination = (
            data_root / "reports" / "cms" / args.dataset_key / args.release / "quality.json"
        )
        if args.dataset_key != PROVIDER_INFORMATION_KEY:
            summary_path = (
                data_root / "reports" / "cms" / args.dataset_key / args.release / "summary.json"
            )
            print(summary_path.read_text(encoding="utf-8"), end="")
            return 0
        report_payload = write_quality_report(normalized, destination)
        print(json.dumps(report_payload, indent=2, sort_keys=True))
        return 0
    if args.command == "load":
        if not args.database_url:
            parser.error("load requires CARE_DATABASE_URL or --database-url")
        loader = (
            load_provider_information
            if args.dataset_key == PROVIDER_INFORMATION_KEY
            else load_pbj_source
            if args.dataset_key == PBJ_NURSE_KEY
            else load_regulatory_source
        )
        result = loader(
            args.database_url, get_source(args.dataset_key), manifest, source_file, normalized
        )
        print(result.to_json(), end="")
        return 0
    parser.error("unsupported command")
    return 2
