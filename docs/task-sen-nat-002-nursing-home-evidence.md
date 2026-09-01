# SEN-NAT-002 — Nursing-home national evidence completion

Finishes high-value missing pieces of the CMS nursing-home spine. No Florida AHCA, no assisted-living expansion, no home health/hospice.

## Delivered

- First-class SFF / SFF candidate / NOT_SFF observations from Provider Information `Special Focus Status`
- Independent abuse-icon observations from `Abuse Icon`
- Directory status: `CURRENT_ACTIVE` vs `ABSENT_FROM_CURRENT_DIRECTORY` (missing PI ≠ closed)
- CONFIRMED CCN↔NPI from the same SNF enrollment row only (organization NPI is not auto-promoted to “facility NPI”)
- MDS quality-measure ingest (`djen-97ju`) with Q1–Q4 plus four-quarter average history
- Fire-safety citations (`ifjz-ge4w`) in a table distinct from health deficiencies
- Refresh runbook (no scheduler)
- `DATA_SOURCES.md` corrected so implemented ownership/regulatory sources are no longer labeled planned

## Commands

See [CMS-REFRESH-RUNBOOK.md](./CMS-REFRESH-RUNBOOK.md).

Derived:

```text
python -m care_ingest derive-cms-designations
python -m care_ingest derive-facility-npi
python -m care_ingest derive-directory-status
```

## PI raw-field classification (this task)

| Field                                           | Decision                                                                    |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| Special Focus Status                            | **P0 — normalized**                                                         |
| Abuse Icon                                      | **P0 — normalized**                                                         |
| Turnover / RN turnover / administrator turnover | **P1** — keep raw; PBJ already covers staffing history with clearer periods |
| Chain ID / chain name on PI                     | **LOW VALUE / REDUNDANT** — official chain dataset already ingested         |
| Reported HPRD columns on PI                     | **LOW VALUE / REDUNDANT** vs PBJ                                            |
| Date first approved                             | **P1**                                                                      |

## Terminated / missing policy

No authoritative CMS termination extract is loaded. Provider Information is a current listing. Therefore:

- In latest PI → `CURRENT_ACTIVE`
- Previously stored CCN, not in latest PI → `ABSENT_FROM_CURRENT_DIRECTORY`
- `TERMINATED_CONFIRMED` is reserved for a future termination/POS source

Do not delete facilities, history, or regulatory evidence when they drop out of PI.
