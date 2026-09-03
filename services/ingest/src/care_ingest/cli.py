"""Dependency-free command line for source inspection and ingestion."""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

from .chain import CHAIN_KEY, ingest_chain_source
from .chain_database import load_chain_membership, load_chain_source
from .database import load_provider_information
from .downloader import download_source, resolve_distribution
from .manifest import ReleaseManifest, sha256_file
from .mds import MDS_KEY, ingest_mds_source
from .mds_database import load_mds_source
from .migrations import apply_migration
from .ownership import OWNERSHIP_KEYS, ingest_ownership_source
from .ownership_database import audit_ownership_database, load_ownership_source
from .pbj import PBJ_NURSE_KEY, ingest_pbj_source
from .pbj_database import audit_pbj_database, load_pbj_source
from .post_acute import POST_ACUTE_KEYS, ingest_post_acute_source
from .post_acute_database import load_post_acute_source
from .provider_information import ingest_provider_information
from .quality import write_quality_report
from .registry import get_source, load_registry
from .regulatory import (
    DEFICIENCIES_KEY,
    FIRE_KEY,
    INSPECTIONS_KEY,
    PENALTIES_KEY,
    ingest_regulatory_source,
)
from .regulatory_database import audit_regulatory_database, load_regulatory_source

PROVIDER_INFORMATION_KEY = "nursing-home-provider-information"
REGULATORY_KEYS = (INSPECTIONS_KEY, DEFICIENCIES_KEY, PENALTIES_KEY, FIRE_KEY)
IMPLEMENTED_KEYS = (
    PROVIDER_INFORMATION_KEY,
    *REGULATORY_KEYS,
    PBJ_NURSE_KEY,
    *OWNERSHIP_KEYS,
    CHAIN_KEY,
    MDS_KEY,
    *POST_ACUTE_KEYS,
)


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
    ownership_audit = commands.add_parser("audit-ownership", help="Audit ownership database")
    ownership_audit.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    membership = commands.add_parser(
        "load-chain-membership", help="Load exact CMS chain membership from SNF Enrollments"
    )
    membership.add_argument("--release", required=True)
    membership.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    state = commands.add_parser(
        "ingest-state", help="Ingest current CA/NY/TX state regulatory licensing evidence"
    )
    state.add_argument(
        "dataset_key",
        choices=(
            "ca-cdph-healthcare-facility-locations",
            "ny-doh-hfis-general-information",
            "tx-hhsc-nursing-facility-directory",
        ),
    )
    state.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    state.add_argument("--timeout", type=float, default=180)
    history = commands.add_parser(
        "derive-facility-history",
        help="Idempotently derive national facility-history events from existing CMS evidence",
    )
    history.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    portfolios = commands.add_parser(
        "derive-ownership-portfolios",
        help="Derive current/historical ownership portfolios from existing CMS evidence",
    )
    portfolios.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    enforcement = commands.add_parser(
        "ingest-state-enforcement",
        help="Ingest official CA/NY/TX state enforcement and inspection events",
    )
    enforcement.add_argument("state_code", choices=("CA", "NY", "TX", "ALL"))
    enforcement.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    enforcement.add_argument("--timeout", type=float, default=180)
    persist_al = commands.add_parser(
        "persist-assisted-living",
        help="Idempotently persist CA/NY/TX assisted-living pilot identities",
    )
    persist_al.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    persist_al.add_argument(
        "--twice",
        action="store_true",
        help="Run persist a second time and report duplicate/update counts",
    )
    for name, help_text in (
        ("derive-cms-designations", "Derive SFF and abuse-icon observations from current PI"),
        ("derive-facility-npi", "Attach CONFIRMED enrollment-organization NPIs to CCNs"),
        ("derive-directory-status", "Mark CURRENT_ACTIVE vs ABSENT_FROM_CURRENT_DIRECTORY"),
        ("derive-ownership-graph", "Classify time-aware owner/operator/enrollment edges"),
        ("derive-ownership-change-events", "Classify SNF CHOW events without snapshot inference"),
        ("derive-senior-intelligence", "Materialize National Senior Intelligence metrics"),
    ):
        command = commands.add_parser(name, help=help_text)
        command.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    profile = commands.add_parser(
        "provider-intelligence",
        help="Assemble one class-aware Provider Intelligence object (internal)",
    )
    profile.add_argument(
        "--provider-type", required=True, choices=("nursing_home", "home_health", "hospice")
    )
    profile.add_argument("--canonical-id", required=True)
    profile.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    refresh = commands.add_parser(
        "cms-refresh",
        help="Registry-driven CMS check/refresh. Writes require CARE_CMS_REFRESH_WRITES=true",
    )
    refresh.add_argument("--mode", choices=("check", "refresh", "dry_run"), default="check")
    refresh.add_argument("--source", default="all", help="all or one dataset_key")
    refresh.add_argument("--trigger", choices=("scheduled", "manual", "dispatch"), default="manual")
    refresh.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    freshness = commands.add_parser(
        "cms-freshness",
        help="Print per-source freshness from cms_source_freshness (not a global clock)",
    )
    freshness.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    nj = commands.add_parser(
        "ingest-nj-doh-ltc",
        help="Acquire/normalize NJDOH All_LTC facility identity spine (NJ-SEN-001)",
    )
    nj.add_argument("--input", type=Path, help="Local All_LTC.xlsx path")
    nj.add_argument("--download", action="store_true", help="Download the official workbook")
    nj.add_argument("--dry-run", action="store_true", help="Parse and match without writing")
    nj.add_argument("--execute", action="store_true", help="Write identities to the database")
    nj.add_argument("--inspect-only", action="store_true", help="Print source inspection JSON")
    nj.add_argument("--timeout", type=float, default=120)
    nj.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    njenf = commands.add_parser(
        "ingest-nj-doh-enforcement",
        help="Acquire/normalize NJDOH penalty letters and state enforcement documents (NJ-SEN-002)",
    )
    njenf.add_argument(
        "--index-html",
        "--input-index",
        type=Path,
        dest="index_html",
        help="Local penalty-letters HTML path",
    )
    njenf.add_argument("--download-index", action="store_true", help="Download the official index")
    njenf.add_argument("--identity-xlsx", type=Path, help="Local All_LTC.xlsx identity spine")
    njenf.add_argument("--pdf-dir", type=Path, help="Directory of preserved penalty-letter PDFs")
    njenf.add_argument(
        "--download-pdfs", action="store_true", help="Incrementally download public PDFs"
    )
    njenf.add_argument("--pdf-limit", type=int, help="Max new PDFs to download this run")
    njenf.add_argument(
        "--sample-inspections",
        action="store_true",
        help="Probe the documented FacID inspection/SOD sample",
    )
    njenf.add_argument("--dry-run", action="store_true", help="Parse and match without writing")
    njenf.add_argument("--execute", action="store_true", help="Write documents to the database")
    njenf.add_argument("--inspect-only", action="store_true", help="Print source inspection JSON")
    njenf.add_argument(
        "--write-reports",
        type=Path,
        help="Write acquisition ledger and corpus summary JSON",
    )
    njenf.add_argument("--timeout", type=float, default=120)
    njenf.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    staff = commands.add_parser(
        "ingest-nj-nh-staffing",
        help="NJDOH quarterly nursing-home staffing ratios (NJ-SEN-003)",
    )
    staff.add_argument("--input", type=Path, help="Local quarterly report HTML")
    staff.add_argument("--year", type=int)
    staff.add_argument("--quarter", choices=("Q1", "Q2", "Q3", "Q4"))
    staff.add_argument("--download", action="store_true")
    staff.add_argument("--identity-xlsx", type=Path)
    staff.add_argument("--inspect-only", action="store_true")
    staff.add_argument("--dry-run", action="store_true")
    staff.add_argument("--execute", action="store_true")
    staff.add_argument("--timeout", type=float, default=180)
    staff.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    rates = commands.add_parser(
        "ingest-nj-assisted-living-rates",
        help="NJ Medicaid assisted-living listed provider rates (NJ-SEN-003)",
    )
    rates.add_argument("--input", type=Path, help="Local rate-schedule PDF")
    rates.add_argument("--download", action="store_true")
    rates.add_argument("--identity-xlsx", type=Path)
    rates.add_argument("--inspect-only", action="store_true")
    rates.add_argument("--dry-run", action="store_true")
    rates.add_argument("--execute", action="store_true")
    rates.add_argument("--timeout", type=float, default=120)
    rates.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    pace = commands.add_parser(
        "ingest-nj-pace",
        help="NJ PACE organizations, centers, and service areas (NJ-SEN-003)",
    )
    pace.add_argument("--input", type=Path, help="Local DoAS PACE HTML")
    pace.add_argument("--download", action="store_true")
    pace.add_argument("--inspect-only", action="store_true")
    pace.add_argument("--dry-run", action="store_true")
    pace.add_argument("--execute", action="store_true")
    pace.add_argument("--timeout", type=float, default=60)
    pace.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    acute = commands.add_parser(
        "ingest-nj-doh-acute",
        help="Acquire/normalize NJDOH All_Acute facility identity spine (NJ-SEN-004)",
    )
    acute.add_argument("--input", type=Path, help="Local All_Acute.xlsx path")
    acute.add_argument("--download", action="store_true", help="Download the official workbook")
    acute.add_argument("--dry-run", action="store_true", help="Parse and match without writing")
    acute.add_argument("--execute", action="store_true", help="Write identities to the database")
    acute.add_argument("--inspect-only", action="store_true", help="Print source inspection JSON")
    acute.add_argument("--probe-service-area", action="store_true")
    acute.add_argument("--timeout", type=float, default=120)
    acute.add_argument("--database-url", default=os.environ.get("CARE_DATABASE_URL"))
    rematch = commands.add_parser(
        "rematch-nj-doh-enforcement",
        help="Rerun NJDOH enforcement identity attachment against All_LTC + All_Acute",
    )
    rematch.add_argument("--ltc-xlsx", type=Path)
    rematch.add_argument("--acute-xlsx", type=Path)
    rematch.add_argument("--index-html", type=Path)
    rematch.add_argument("--pdf-dir", type=Path)
    rematch.add_argument("--dry-run", action="store_true")
    staff_recon = commands.add_parser(
        "reconcile-nj-staffing-facids",
        help="Classify staffing FacIDs that do not match current All_LTC",
    )
    staff_recon.add_argument("--staffing-dir", type=Path)
    staff_recon.add_argument("--ltc-xlsx", type=Path)
    staff_recon.add_argument("--acute-xlsx", type=Path)
    staff_recon.add_argument("--output", type=Path)
    ccrc = commands.add_parser("discover-nj-ccrc", help="Inspect DCA CCRC sources (NJ-SEN-004)")
    ccrc.add_argument("--input", type=Path)
    ccrc.add_argument("--download", action="store_true")
    ccrc.add_argument("--timeout", type=float, default=45)
    snap = commands.add_parser(
        "nj-sen-004-snapshot", help="Write the internal NJ state snapshot and metric contract"
    )
    snap.add_argument("--acute-xlsx", type=Path)
    snap.add_argument("--ltc-xlsx", type=Path)
    snap.add_argument("--output", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(
        level=logging.INFO if args.verbose else logging.WARNING,
        format="%(levelname)s %(name)s: %(message)s",
    )
    data_root = args.data_root.resolve()

    if args.command == "cms-refresh":
        from .refresh import run_refresh
        from .refresh_policy import topological_refresh_order

        selected = None if args.source == "all" else [args.source]
        if selected:
            known = topological_refresh_order()
            missing = [key for key in selected if key not in known]
            if missing:
                parser.error(f"unknown or unimplemented refresh source: {missing}")
        report = run_refresh(
            mode=args.mode,
            database_url=args.database_url,
            data_root=data_root,
            trigger=args.trigger,
            sources=selected,
        )
        print(report.to_json(), end="")
        if args.mode == "refresh" and not report.writes_enabled:
            logging.warning("CARE_CMS_REFRESH_WRITES is not true; no evidence writes occurred")
        return 0 if report.health != "FAILED" else 1
    if args.command == "ingest-nj-doh-ltc":
        from .nj_doh_ltc import fetch_official_workbook, inspect_payload
        from .nj_doh_ltc_database import ingest_nj_doh_ltc

        if args.input:
            payload = Path(args.input).read_bytes()
        elif args.download:
            payload = fetch_official_workbook(timeout=args.timeout)
            archive = data_root / "raw" / "nj-doh-ltc"
            archive.mkdir(parents=True, exist_ok=True)
            (archive / "All_LTC.xlsx").write_bytes(payload)
        else:
            parser.error("ingest-nj-doh-ltc requires --input or --download")
        if args.inspect_only:
            print(json.dumps(inspect_payload(payload), indent=2, default=str))
            return 0
        if not args.execute:
            args.dry_run = True
        if args.execute and not args.database_url:
            parser.error("execute mode requires CARE_DATABASE_URL or --database-url")
        report = ingest_nj_doh_ltc(
            payload,
            database_url=args.database_url,
            dry_run=not args.execute,
        )
        print(report.to_json(), end="")
        return 0
    if args.command == "ingest-nj-doh-enforcement":
        from .nj_doh_enforcement import (
            PENALTY_LETTERS_URL,
            fetch_bytes,
            inspect_index,
        )
        from .nj_doh_enforcement_database import (
            ingest_nj_doh_enforcement,
            load_identities_from_db,
            load_identities_from_xlsx,
        )

        archive = data_root / "raw" / "nj-doh-enforcement"
        archive.mkdir(parents=True, exist_ok=True)
        if args.index_html:
            html = Path(args.index_html).read_text(encoding="utf-8", errors="replace")
        elif args.download_index:
            _status, body, _ctype = fetch_bytes(PENALTY_LETTERS_URL, timeout=args.timeout)
            (archive / "penalty_letters.html").write_bytes(body)
            html = body.decode("utf-8", errors="replace")
        elif (archive / "penalty_letters.html").is_file():
            html = (archive / "penalty_letters.html").read_text(encoding="utf-8", errors="replace")
        else:
            parser.error("ingest-nj-doh-enforcement requires --index-html or --download-index")
        if args.inspect_only:
            print(json.dumps(inspect_index(html), indent=2, default=str))
            return 0
        identities = []
        if args.identity_xlsx:
            identities = load_identities_from_xlsx(Path(args.identity_xlsx).read_bytes())
        elif args.database_url and not args.dry_run:
            with __import__("psycopg").connect(args.database_url) as connection:
                identities = load_identities_from_db(connection)
        elif (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx").is_file():
            identities = load_identities_from_xlsx(
                (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx").read_bytes()
            )
        inspection_gate: dict = {}
        extra = []
        if args.sample_inspections:
            from .nj_doh_inspection import probe_inspection_sample

            inspection_gate, extra = probe_inspection_sample(
                timeout=min(args.timeout, 45), identities=identities
            )
        if not args.execute:
            args.dry_run = True
        if args.execute and not args.database_url:
            parser.error("execute mode requires CARE_DATABASE_URL or --database-url")
        pdf_dir = args.pdf_dir or (archive / "pdfs")
        retry_payload = None
        if args.download_pdfs:
            from .nj_doh_enforcement import parse_penalty_index
            from .nj_doh_enforcement_acquire import acquire_pdfs

            index_rows, _modified = parse_penalty_index(html)
            retry_payload = acquire_pdfs(index_rows, pdf_dir, timeout=args.timeout)
            print(retry_payload.to_json(), end="")
        report = ingest_nj_doh_enforcement(
            html,
            identities=identities,
            database_url=args.database_url,
            dry_run=not args.execute,
            pdf_dir=pdf_dir,
            download_pdfs=False,
            pdf_limit=args.pdf_limit,
            inspection_gate=inspection_gate,
            extra_documents=extra,
        )
        print(report.to_json(), end="")
        if args.write_reports:
            from .nj_doh_enforcement import parse_penalty_index
            from .nj_doh_enforcement_acquire import (
                acquire_pdfs,
                build_corpus_summary,
                complete_ledger,
                dedupe_hashes,
                write_reports,
            )

            index_rows, _modified = parse_penalty_index(html)
            retry_for_ledger = retry_payload or acquire_pdfs(
                index_rows, pdf_dir, retry_missing_only=False, timeout=args.timeout
            )
            ledger = complete_ledger(index_rows, retry_for_ledger, pdf_dir)
            summary = build_corpus_summary(html, identities, pdf_dir, ledger)
            dedupe = dedupe_hashes(ledger)
            paths = write_reports(ledger, summary, dedupe, retry_for_ledger, args.write_reports)
            print(json.dumps(paths, indent=2))
        return 0
    if args.command == "ingest-nj-nh-staffing":
        from .nj_doh_enforcement_database import load_identities_from_xlsx
        from .nj_doh_staffing import (
            build_staffing_report,
            fetch_form,
            parse_staffing_html,
            post_staffing_report,
        )

        identities = []
        if args.identity_xlsx:
            identities = load_identities_from_xlsx(Path(args.identity_xlsx).read_bytes())
        elif (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx").is_file():
            identities = load_identities_from_xlsx(
                (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx").read_bytes()
            )
        if args.input:
            html = Path(args.input).read_text(encoding="utf-8", errors="replace")
        elif args.download:
            if not args.year or not args.quarter:
                parser.error("download mode requires --year and --quarter")
            form = fetch_form(timeout=args.timeout).decode("utf-8", errors="replace")
            payload = post_staffing_report(form, str(args.year), args.quarter, timeout=args.timeout)
            archive = data_root / "raw" / "nj-doh-staffing"
            archive.mkdir(parents=True, exist_ok=True)
            dest = archive / f"report_{args.year}_{args.quarter}.html"
            dest.write_bytes(payload)
            html = payload.decode("utf-8", errors="replace")
        else:
            parser.error("ingest-nj-nh-staffing requires --input or --download")
        rows = parse_staffing_html(html, year=args.year, quarter=args.quarter)
        if args.inspect_only:
            period = {
                "rows": len(rows),
                "year": rows[0].year if rows else None,
                "quarter": rows[0].quarter if rows else None,
            }
            print(json.dumps(period, indent=2))
            return 0
        if args.execute and not args.database_url:
            parser.error("execute mode requires CARE_DATABASE_URL or --database-url")
        report = build_staffing_report(rows, identities, html=html, dry_run=not args.execute)
        print(report.to_json(), end="")
        return 0
    if args.command == "ingest-nj-assisted-living-rates":
        from .nj_doh_enforcement import fetch_bytes
        from .nj_doh_enforcement_database import load_identities_from_xlsx
        from .nj_medicaid_al_rates import (
            OFFICIAL_SFY_2026_URL,
            build_rate_report,
            match_rate_row,
            parse_rate_pdf,
        )

        identities = []
        if args.identity_xlsx:
            identities = load_identities_from_xlsx(Path(args.identity_xlsx).read_bytes())
        elif (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx").is_file():
            identities = load_identities_from_xlsx(
                (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx").read_bytes()
            )
        if args.input:
            payload = Path(args.input).read_bytes()
            url = str(args.input)
        elif args.download:
            _status, payload, _ctype = fetch_bytes(OFFICIAL_SFY_2026_URL, timeout=args.timeout)
            archive = data_root / "raw" / "nj-medicaid-al"
            archive.mkdir(parents=True, exist_ok=True)
            (archive / "SFY_2026_Assisted_Living_Rates.pdf").write_bytes(payload)
            url = OFFICIAL_SFY_2026_URL
        else:
            parser.error("ingest-nj-assisted-living-rates requires --input or --download")
        schedule = parse_rate_pdf(payload, official_url=url, source_class="OFFICIAL")
        if args.inspect_only:
            print(
                json.dumps(
                    {
                        "fiscal_year": schedule.fiscal_year,
                        "rows": len(schedule.rows),
                        "sha256": schedule.content_sha256,
                    },
                    indent=2,
                )
            )
            return 0
        if args.execute and not args.database_url:
            parser.error("execute mode requires CARE_DATABASE_URL or --database-url")
        matches = [match_rate_row(row, identities) for row in schedule.rows]
        print(build_rate_report(schedule, matches, dry_run=not args.execute).to_json(), end="")
        return 0
    if args.command == "ingest-nj-pace":
        from datetime import UTC, datetime

        from .nj_doh_enforcement import fetch_bytes, sha256_bytes
        from .nj_pace import DOAS_URL, build_pace_report, parse_doas_page

        if args.input:
            html = Path(args.input).read_text(encoding="utf-8", errors="replace")
        elif args.download:
            _status, body, _ctype = fetch_bytes(DOAS_URL, timeout=args.timeout)
            archive = data_root / "raw" / "nj-pace"
            archive.mkdir(parents=True, exist_ok=True)
            (archive / "doas_pace.html").write_bytes(body)
            html = body.decode("utf-8", errors="replace")
        else:
            parser.error("ingest-nj-pace requires --input or --download")
        corpus = parse_doas_page(
            html,
            retrieved=datetime.now(tz=UTC).isoformat(),
            sha256=sha256_bytes(html.encode("utf-8")),
        )
        if args.inspect_only:
            print(
                json.dumps(
                    {
                        "organizations": len(corpus.organizations),
                        "centers": len(corpus.centers),
                    },
                    indent=2,
                )
            )
            return 0
        if args.execute and not args.database_url:
            parser.error("execute mode requires CARE_DATABASE_URL or --database-url")
        print(build_pace_report(corpus, dry_run=not args.execute).to_json(), end="")
        return 0
    if args.command == "ingest-nj-doh-acute":
        from .nj_doh_acute import fetch_official_workbook, inspect_payload, probe_service_area_page
        from .nj_doh_acute_database import ingest_nj_doh_acute

        if args.input:
            payload = Path(args.input).read_bytes()
        elif args.download:
            payload = fetch_official_workbook(timeout=args.timeout)
            archive = data_root / "raw" / "nj-doh-acute"
            archive.mkdir(parents=True, exist_ok=True)
            (archive / "All_Acute.xlsx").write_bytes(payload)
        else:
            parser.error("ingest-nj-doh-acute requires --input or --download")
        if args.inspect_only:
            print(json.dumps(inspect_payload(payload), indent=2, default=str))
            return 0
        service_area_status = "SOURCE_ACCESS_BLOCKED"
        if args.probe_service_area:
            from .nj_doh_acute import parse_acute_rows, parse_acute_xlsx

            _headers, rows, _sheets = parse_acute_xlsx(payload)
            parsed, _ = parse_acute_rows(rows)
            sample = next(
                (
                    row.source_facility_id
                    for row in parsed
                    if row.facility_type_canonical == "NJ_HHA"
                ),
                None,
            )
            if sample:
                probe = probe_service_area_page(sample, timeout=min(args.timeout, 20))
                service_area_status = (
                    "ACQUIRED_CURRENT_SNAPSHOT" if not probe.blocked else "SOURCE_ACCESS_BLOCKED"
                )
                print(
                    json.dumps(
                        {
                            "facid": probe.facid,
                            "url": probe.url,
                            "http_status": probe.http_status,
                            "blocked": probe.blocked,
                            "barrier": probe.barrier,
                            "counties_served": probe.counties_served,
                        },
                        indent=2,
                    )
                )
        if not args.execute:
            args.dry_run = True
        if args.execute and not args.database_url:
            parser.error("execute mode requires CARE_DATABASE_URL or --database-url")
        report = ingest_nj_doh_acute(
            payload,
            database_url=args.database_url,
            dry_run=not args.execute,
            service_area_status=service_area_status,
        )
        print(report.to_json(), end="")
        return 0
    if args.command == "rematch-nj-doh-enforcement":
        from .nj_doh_enforcement import assemble_documents, load_local_pdfs, parse_penalty_index
        from .nj_sen_004 import load_identities_from_paths, rematch_documents

        ltc_path = args.ltc_xlsx or (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx")
        acute_path = args.acute_xlsx or (data_root / "raw" / "nj-doh-acute" / "All_Acute.xlsx")
        ltc, acute = load_identities_from_paths(ltc_path, acute_path)
        documents: list[dict] = []
        if args.index_html and args.index_html.is_file():
            html = args.index_html.read_text(encoding="utf-8", errors="replace")
            rows, _modified = parse_penalty_index(html)
            pdf_dir = args.pdf_dir or (data_root / "raw" / "nj-doh-enforcement" / "pdfs")
            payloads = load_local_pdfs(pdf_dir) if pdf_dir.is_dir() else {}
            assembled = assemble_documents(rows, identities=ltc + acute, pdf_payloads=payloads)
            documents = [
                {
                    "printed_license_number": item.printed_license_number,
                    "printed_source_facility_id": item.printed_source_facility_id,
                    "printed_facility_name": item.printed_facility_name,
                    "printed_street": item.printed_street,
                    "printed_city": item.printed_city,
                }
                for item in assembled
            ]
        report = rematch_documents(documents, ltc, acute)
        print(report.to_json(), end="")
        return 0
    if args.command == "reconcile-nj-staffing-facids":
        from .nj_sen_004 import (
            audit_staffing_facids,
            load_identities_from_paths,
            write_staffing_audit_csv,
        )

        ltc_path = args.ltc_xlsx or (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx")
        acute_path = args.acute_xlsx or (data_root / "raw" / "nj-doh-acute" / "All_Acute.xlsx")
        staffing_dir = args.staffing_dir or (data_root / "raw" / "nj-doh-staffing")
        ltc, acute = load_identities_from_paths(ltc_path, acute_path)
        audits = audit_staffing_facids(staffing_dir, ltc, acute)
        dest = args.output or Path("artifacts/nj-sen-004-staffing-facid-reconciliation.csv")
        write_staffing_audit_csv(audits, dest)
        print(json.dumps({"rows": len(audits), "path": str(dest)}, indent=2))
        return 0
    if args.command == "discover-nj-ccrc":
        from datetime import UTC
        from datetime import datetime as dt

        from .nj_sen_004 import CCRC_LANDING_URL, discover_ccrc, fetch_url

        if args.input:
            html = Path(args.input).read_text(encoding="utf-8", errors="replace")
        elif args.download:
            _status, body, _ctype = fetch_url(CCRC_LANDING_URL, timeout=args.timeout)
            archive = data_root / "raw" / "nj-ccrc"
            archive.mkdir(parents=True, exist_ok=True)
            (archive / "ccrc.shtml.html").write_bytes(body)
            html = body.decode("utf-8", errors="replace")
        else:
            parser.error("discover-nj-ccrc requires --input or --download")
        print(json.dumps(discover_ccrc(html, retrieved_at=dt.now(tz=UTC).isoformat()), indent=2))
        return 0
    if args.command == "nj-sen-004-snapshot":
        from datetime import UTC
        from datetime import datetime as dt

        from .nj_doh_acute import inspect_payload
        from .nj_sen_004 import (
            build_internal_snapshot,
            default_coverage,
            load_identities_from_paths,
        )

        acute_path = args.acute_xlsx or (data_root / "raw" / "nj-doh-acute" / "All_Acute.xlsx")
        ltc_path = args.ltc_xlsx or (data_root / "raw" / "nj-doh-ltc" / "All_LTC.xlsx")
        inspect = inspect_payload(acute_path.read_bytes()) if acute_path.is_file() else {}
        ltc, _acute = load_identities_from_paths(ltc_path, acute_path)
        snapshot = build_internal_snapshot(
            acute_inspect=inspect,
            ltc_rows=len(ltc),
            rematch=None,
            staffing_audits=[],
            coverage=default_coverage(),
            retrieved_at=dt.now(tz=UTC).isoformat(),
        )
        dest = args.output or Path("artifacts/nj-sen-004-audited-state-snapshot.json")
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(json.dumps(snapshot, indent=2, default=str) + "\n", encoding="utf-8")
        print(json.dumps({"path": str(dest)}, indent=2))
        return 0
    if args.command == "cms-freshness":
        if not args.database_url:
            parser.error("cms-freshness requires CARE_DATABASE_URL or --database-url")
        from .refresh import query_source_freshness

        print(json.dumps(query_source_freshness(args.database_url), indent=2, default=str))
        return 0
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
    if args.command == "audit-ownership":
        if not args.database_url:
            parser.error("audit-ownership requires CARE_DATABASE_URL or --database-url")
        print(json.dumps(audit_ownership_database(args.database_url), indent=2, sort_keys=True))
        return 0
    if args.command == "derive-cms-designations":
        if not args.database_url:
            parser.error("derive-cms-designations requires CARE_DATABASE_URL or --database-url")
        from .cms_designations import derive_cms_designations_json

        print(derive_cms_designations_json(args.database_url), end="")
        return 0
    if args.command == "derive-facility-npi":
        if not args.database_url:
            parser.error("derive-facility-npi requires CARE_DATABASE_URL or --database-url")
        from .facility_npi import derive_facility_npi_json

        print(derive_facility_npi_json(args.database_url), end="")
        return 0
    if args.command == "derive-ownership-graph":
        if not args.database_url:
            parser.error("derive-ownership-graph requires CARE_DATABASE_URL or --database-url")
        from .ownership_graph_database import derive_ownership_graph_json

        print(derive_ownership_graph_json(args.database_url), end="")
        return 0
    if args.command == "derive-ownership-change-events":
        if not args.database_url:
            parser.error(
                "derive-ownership-change-events requires CARE_DATABASE_URL or --database-url"
            )
        from .ownership_change_database import derive_ownership_change_events_json

        print(derive_ownership_change_events_json(args.database_url), end="")
        return 0
    if args.command == "derive-senior-intelligence":
        if not args.database_url:
            parser.error("derive-senior-intelligence requires CARE_DATABASE_URL or --database-url")
        from .senior_intelligence_database import materialize_senior_intelligence_json

        print(materialize_senior_intelligence_json(args.database_url), end="")
        return 0
    if args.command == "provider-intelligence":
        if not args.database_url:
            parser.error("provider-intelligence requires CARE_DATABASE_URL or --database-url")
        from .provider_intelligence_database import provider_intelligence_json

        print(
            provider_intelligence_json(args.database_url, args.provider_type, args.canonical_id),
            end="",
        )
        return 0
    if args.command == "derive-directory-status":
        if not args.database_url:
            parser.error("derive-directory-status requires CARE_DATABASE_URL or --database-url")
        from .directory_status import derive_directory_status_json

        print(derive_directory_status_json(args.database_url), end="")
        return 0
    if args.command == "derive-facility-history":
        if not args.database_url:
            parser.error("derive-facility-history requires CARE_DATABASE_URL or --database-url")
        from .facility_history import derive_facility_history_json

        print(derive_facility_history_json(args.database_url), end="")
        return 0
    if args.command == "derive-ownership-portfolios":
        if not args.database_url:
            parser.error("derive-ownership-portfolios requires CARE_DATABASE_URL or --database-url")
        from .ownership_portfolio import derive_ownership_portfolios_json

        print(derive_ownership_portfolios_json(args.database_url), end="")
        return 0
    if args.command == "ingest-state-enforcement":
        if not args.database_url:
            parser.error("ingest-state-enforcement requires CARE_DATABASE_URL or --database-url")
        from .state_enforcement import ingest_all_state_enforcement, ingest_state_enforcement

        if args.state_code == "ALL":
            print(
                json.dumps(ingest_all_state_enforcement(args.database_url, args.timeout), indent=2)
            )
        else:
            print(
                ingest_state_enforcement(
                    args.database_url, args.state_code, timeout=args.timeout
                ).to_json(),
                end="",
            )
        return 0
    if args.command == "persist-assisted-living":
        if not args.database_url:
            parser.error("persist-assisted-living requires CARE_DATABASE_URL or --database-url")
        from datetime import UTC, datetime

        from .assisted_living_database import (
            audit_assisted_living_database,
            persist_assisted_living_records,
        )
        from .assisted_living_pilot import (
            load_local_pilot_payloads,
            parse_pilot_records,
            qa_publication_sample,
        )

        retrieved = datetime.now(UTC).isoformat()
        ca_csv, ny_general, ny_certs, tx_xlsx = load_local_pilot_payloads(data_root)
        records = parse_pilot_records(ca_csv, ny_general, ny_certs, tx_xlsx, retrieved)
        first = persist_assisted_living_records(args.database_url, records)
        second = persist_assisted_living_records(args.database_url, records) if args.twice else None
        print(
            json.dumps(
                {
                    "retrieved_at": retrieved,
                    "google_places_requests": 0,
                    "first": first,
                    "second": second,
                    "audit": audit_assisted_living_database(args.database_url),
                    "qa": qa_publication_sample(records),
                },
                indent=2,
                default=str,
            )
        )
        return 0
    if args.command == "ingest-state":
        if not args.database_url:
            parser.error("ingest-state requires CARE_DATABASE_URL or --database-url")
        from .state_regulator_database import ingest_state_source

        print(
            ingest_state_source(
                args.database_url, args.dataset_key, timeout=args.timeout
            ).to_json(),
            end="",
        )
        return 0
    if args.command == "load-chain-membership":
        if not args.database_url:
            parser.error("load-chain-membership requires CARE_DATABASE_URL")
        source_file, manifest_path = _release_paths(
            data_root, "skilled-nursing-facility-enrollments", args.release
        )
        manifest = ReleaseManifest.from_path(manifest_path)
        print(
            load_chain_membership(
                args.database_url,
                get_source("skilled-nursing-facility-enrollments"),
                manifest,
                source_file,
            ).to_json(),
            end="",
        )
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
        else ingest_mds_source
        if args.dataset_key == MDS_KEY
        else ingest_pbj_source
        if args.dataset_key == PBJ_NURSE_KEY
        else ingest_chain_source
        if args.dataset_key == CHAIN_KEY
        else ingest_ownership_source
        if args.dataset_key in OWNERSHIP_KEYS
        else ingest_post_acute_source
        if args.dataset_key in POST_ACUTE_KEYS
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
            else load_mds_source
            if args.dataset_key == MDS_KEY
            else load_pbj_source
            if args.dataset_key == PBJ_NURSE_KEY
            else load_chain_source
            if args.dataset_key == CHAIN_KEY
            else load_ownership_source
            if args.dataset_key in OWNERSHIP_KEYS
            else load_post_acute_source
            if args.dataset_key in POST_ACUTE_KEYS
            else load_regulatory_source
        )
        result = loader(
            args.database_url, get_source(args.dataset_key), manifest, source_file, normalized
        )
        print(result.to_json(), end="")
        return 0
    parser.error("unsupported command")
    return 2
