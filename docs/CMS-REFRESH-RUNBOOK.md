# CMS nursing-home refresh runbook

**SEN-NAT-005.** Registry-driven check and ingest for the completed national nursing-home spine.

Scheduled production **writes** are not enabled. GitHub Actions runs a daily **check-only** job. Evidence writes require `CARE_CMS_REFRESH_WRITES=true` on a durable worker (not a GitHub-hosted runner for MDS / fire / PBJ).

Do not ingest Home Health, Hospice, Florida AHCA, additional assisted-living states, PACE, IRF, or LTCH from this runbook.

## Commands

From `services/ingest` with `CARE_DATABASE_URL` set. Archive root is `data/` or `$env:CARE_DATA_ROOT`.

```powershell
python -m pip install -e .
```

### Check only (all nursing-home CMS sources)

```powershell
python -m care_ingest cms-refresh --mode check --source all --trigger manual
```

### Check one source

```powershell
python -m care_ingest cms-refresh --mode check --source nursing-home-provider-information
```

### Dry run (no database writes of governance rows)

```powershell
python -m care_ingest cms-refresh --mode dry_run --source all
```

### Refresh writes (explicit guard)

```powershell
$env:CARE_CMS_REFRESH_WRITES = "true"
python -m care_ingest cms-refresh --mode refresh --source all --trigger manual
```

One source:

```powershell
$env:CARE_CMS_REFRESH_WRITES = "true"
python -m care_ingest cms-refresh --mode refresh --source nursing-home-mds-quality-measures
```

Retry a failed source is the same refresh command for that `dataset_key`. Failed `cms_source_run` rows remain auditable; a later `COMPLETE` or `NO_CHANGE` supersedes them for freshness.

### Reconciliation / freshness

```powershell
python -m care_ingest cms-freshness
```

Queryable product API: `GET /api/cms-source-freshness`. SQL view: `cms_source_freshness`. There is no global last-updated timestamp.

## Manual per-source path (unchanged SEN-NAT-002 importers)

The orchestrator calls these; they remain the shared ingest path.

```powershell
python -m care_ingest download {dataset}
python -m care_ingest validate {dataset} --release {release}
python -m care_ingest ingest {dataset} --release {release}
python -m care_ingest load {dataset} --release {release} --database-url $env:CARE_DATABASE_URL
```

After a new Provider Information load:

```powershell
python -m care_ingest derive-directory-status --database-url $env:CARE_DATABASE_URL
python -m care_ingest derive-cms-designations --database-url $env:CARE_DATABASE_URL
```

After enrollments load:

```powershell
python -m care_ingest derive-facility-npi --database-url $env:CARE_DATABASE_URL
python -m care_ingest load-chain-membership --release {release} --database-url $env:CARE_DATABASE_URL
```

## Dependency order

1. Provider Information (`4pq5-n9py`) — derives directory status and SFF/abuse
2. Inspection Dates (`svdt-c123`) — failure pauses health deficiencies and fire
3. Health Deficiencies (`r5ix-sfxw`)
4. Fire Safety Deficiencies (`ifjz-ge4w`)
5. Penalties (`g6vv-u9sr`)
6. PBJ Daily Nurse Staffing (`7e0d53ba-8f02-4c66-98a5-14a1c997c50d`) — quarterly; additional quarter = additional release
7. Ownership (`y2hd-n93e`)
8. SNF All Owners (`afe44b85-cc6d-40d7-b5df-00ae8910d1d2`)
9. SNF Enrollments (`5f2c306f-3b1c-42cd-b037-187b2ce22126`) — derives NPI (same-row CCN+NPI only) and chain membership
10. SNF CHOW (`f557a6ed-95b3-4a22-8433-4175db2dec1c`)
11. SNF CHOW owner information (`a4358712-e910-4eaf-8f24-5e90ba3cf8d0`) — depends on CHOW
12. Chain Performance (`97ecfad1-d3f1-4d42-b774-d74661d830bc`)
13. MDS Quality Measures (`djen-97ju`)

A CCN missing from a newer Provider Information extract remains stored and is marked `ABSENT_FROM_CURRENT_DIRECTORY`, never auto-deleted or auto-closed.

## Change detection

Unchanged vs changed uses, in order: content SHA-256, then CMS version identifier, then `source_modified_at`. Check mode does not download full files. A write that downloads a checksum matching the last successful release records `NO_CHANGE` and does not load duplicates.

## Failure and locking

- Schema drift (missing required columns) → `QUARANTINED` (`VALIDATION`). No load.
- Row-count floor or drop ratio → `FAILED` (`VALIDATION`). No load.
- Disk / out-of-memory → `CAPACITY`.
- Overlapping `FETCHED` / `VALIDATED` / `INGESTING` for the same `dataset_key` → `ALREADY_RUNNING` (unique index). Stale locks older than 3 hours expire to `FAILED`.
- Failed parent with `pause_dependents_on_failure` → dependents `SKIPPED_DEPENDENCY`. The parent `COMPLETE` is not recorded. Platform health is not HEALTHY.
- Load succeeded, derive failed → `DATA_LOADED_DERIVE_FAILED`.

Do not enable GitHub Actions scheduled writes. MDS, fire, and PBJ need `statement_timeout = 0`, COPY, and disk headroom. Do not delete historical evidence to free space.

## Observability

- Parent: `cms_refresh_run`
- Per source: `cms_source_run`
- Daily check: GitHub Actions workflow `CMS refresh check` (`.github/workflows/cms-refresh.yml`). Failures annotate the job; `FAILED` health exits 1.
- Product query: `GET /api/cms-source-freshness`
