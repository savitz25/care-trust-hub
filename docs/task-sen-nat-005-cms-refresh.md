# SEN-NAT-005 — Automated CMS refresh + freshness governance

Operational hardening of the completed nursing-home national spine at SHA `3e71c062577acc8fd35e561e9b9de9b99853a0a8`. No Florida AHCA, Home Health, Hospice, extra AL states, PACE, IRF, or LTCH.

## Delivered

- Registry program `cms_refresh_program.json` (cadence, SLA, dependencies, row-count floors)
- Migration `0022_cms_refresh_governance.sql`: `cms_refresh_run`, `cms_source_run`, `cms_refresh_source_policy`, view `cms_source_freshness`
- Orchestrator `python -m care_ingest cms-refresh --mode check|refresh|dry_run`
- Shared write path: existing download / validate headers / ingest / load / derive
- Unique in-progress lock per `dataset_key`; stale locks expire after 3 hours
- GitHub Actions daily **check-only** (`.github/workflows/cms-refresh.yml`)
- Product query `GET /api/cms-source-freshness`
- Reconciliation tests R1–R15

## Not enabled

Scheduled production evidence writes. GitHub-hosted runners are not a safe MDS / fire / PBJ worker. Set `CARE_CMS_REFRESH_WRITES=true` only on a durable operator machine after check-only shows a changed source.

## Commands

See [CMS-REFRESH-RUNBOOK.md](./CMS-REFRESH-RUNBOOK.md).
