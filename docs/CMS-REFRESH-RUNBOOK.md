# CMS nursing-home refresh runbook

**SEN-NAT-002.** This is an executable manual runbook, not a scheduler.

There is **no automatic CMS refresh job**. If nobody runs these commands, production stays on the last successful ingest vintage. SEN-NAT-005 is the scheduler.

All commands run from the repository root with `CARE_DATABASE_URL` set. Ingest service:

```powershell
cd services/ingest
python -m pip install -e .
```

Archive root defaults to `data/` or `$env:CARE_DATA_ROOT`.

## Dependency order

1. Provider Information (`4pq5-n9py`)
2. Inspection Dates (`svdt-c123`)
3. Health Deficiencies (`r5ix-sfxw`)
4. Fire Safety Deficiencies (`ifjz-ge4w`)
5. Penalties (`g6vv-u9sr`)
6. PBJ Daily Nurse Staffing (`7e0d53ba-8f02-4c66-98a5-14a1c997c50d`) — quarterly
7. Ownership (`y2hd-n93e`)
8. SNF All Owners (`afe44b85-cc6d-40d7-b5df-00ae8910d1d2`)
9. SNF Enrollments (`5f2c306f-3b1c-42cd-b037-187b2ce22126`)
10. SNF CHOW (`f557a6ed-95b3-4a22-8433-4175db2dec1c`)
11. SNF CHOW owner information (`a4358712-e910-4eaf-8f24-5e90ba3cf8d0`)
12. Chain Performance (`97ecfad1-d3f1-4d42-b774-d74661d830bc`)
13. Chain membership load from enrollments
14. MDS Quality Measures (`djen-97ju`)
15. Derive SFF / abuse-icon, directory status, facility NPI
16. Optional: `derive-facility-history`, `derive-ownership-portfolios`

Inspections must load before deficiencies/fire citations so survey linking can occur. Ownership/enrollments should load before NPI derivation.

## Command pattern

Replace `{dataset}` and `{release}` with the archived release key (usually the CMS modified date).

```powershell
python -m care_ingest download {dataset}
python -m care_ingest validate {dataset} --release {release}
python -m care_ingest ingest {dataset} --release {release}
python -m care_ingest load {dataset} --release {release} --database-url $env:CARE_DATABASE_URL
```

PBJ also accepts `--source-period 2026Q1` on download.

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

## Per-source notes

| Dataset | Cadence | Freshness field | Historical preservation | Rollback |
| --- | --- | --- | --- | --- |
| Provider Information | Monthly | `source_release.source_modified_at` | New snapshot rows; do not delete prior CCNs | Failed ingest does not mark succeeded; checksum conflict blocks overwrite |
| Inspection Dates | Monthly | source_modified_at / published_at | New release rows; unique `(release, event_key)` | Same |
| Health Deficiencies | Monthly | same | Unlinked findings stay unlinked | Same |
| Fire Safety Deficiencies | Monthly | same | Distinct `fire_safety_citation` table | Same |
| Penalties | Monthly | same | Fine vs payment denial remain separate | Same |
| PBJ | Quarterly | `source_period` + coverage dates | Additional quarters are additional releases | Same |
| Ownership / All Owners / Enrollments / CHOW | Monthly or quarterly | source_modified_at | Additive relationships | Same |
| Chain Performance | Monthly | release month | Multiple months retained | Same |
| MDS Quality Measures | Monthly | source_modified_at + measure period | `(release, ccn, measure, period_component)` unique | Same |

## Validation

```powershell
python -m care_ingest audit-regulatory --database-url $env:CARE_DATABASE_URL
python -m care_ingest audit-staffing --database-url $env:CARE_DATABASE_URL
python -m care_ingest audit-ownership --database-url $env:CARE_DATABASE_URL
cd ../..
npm test --workspace=@care/domain
cd services/ingest && pytest tests/test_sen_nat_002.py tests/test_regulatory.py
```

A CCN missing from a newer Provider Information extract must remain stored and must be marked `ABSENT_FROM_CURRENT_DIRECTORY`, never auto-deleted or auto-closed.

## Product freshness

Do not display one global “last updated” for all evidence. Profiles already separate Provider Information freshness from PBJ quarters; MDS and fire releases are additional independent vintages.
