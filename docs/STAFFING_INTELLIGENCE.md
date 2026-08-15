# PBJ staffing intelligence

## Source contract

Task 008 uses only **CMS Payroll Based Journal Daily Nurse Staffing**, dataset type identifier `7e0d53ba-8f02-4c66-98a5-14a1c997c50d`. CMS publishes quarterly files with one record for each included facility and work date. The current catalog, fixed release URL, fixed API version, coverage dates, source-modified date, retrieval time, byte count, and SHA-256 are captured in each immutable manifest. The downloader selects the fixed CSV distribution; it does not treat the mutable latest API URL as an archived object.

The verified 2026 Q1 schema contains facility identity and location, `CY_Qtr`, `WorkDate`, MDS daily census, and total/employee/contract hour fields for Director of Nursing, administrative RN, RN, administrative LPN/LVN, LPN/LVN, CNA, nurse aide in training, and medication aide. Task 008 does not acquire PBJ Employee Detail.

Official references:

- [Dataset and version history](https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing)
- [PBJ methodology](https://data.cms.gov/resources/payroll-based-journal-methodology-0)
- [Daily Nurse Staffing data dictionary](https://data.cms.gov/sites/default/files/2022-04/ea52956d-b2a3-4b1a-a730-b327fe94eace/Payroll%20Based%20Journal%20Daily%20Nurse%20Staffing%20Data%20Dictionary.pdf)
- [CMS PBJ submission program](https://www.cms.gov/medicare/quality/nursing-home-improvement/staffing-data-submission)

CMS currently exposes fixed quarterly versions from 2017 Q1 onward. The data are quarterly, normally covering 90–92 calendar days. A source period is recorded as `YYYYQn`; its actual coverage start and end remain separate fields.

## Semantics and boundaries

PBJ hours are paid hours reported by facilities, including employee and contract/agency components. Daily census is CMS-derived from Minimum Data Set assessments. Paid hours may not capture unpaid hours worked by salaried staff. CMS excludes facilities that do not meet its submission and facility-level plausibility rules before publishing the public file, but says it does not additionally edit individual daily values. A zero category value means no hours were reported for that category and day; it is not by itself a finding about safety or compliance.

The product keeps three concepts separate:

1. CMS-published raw PBJ daily hours and census.
2. Deterministic calculations made from those published fields.
3. CMS staffing measures and the CMS staffing star rating, which CMS calculates separately using its published case-mix and rating methodology.

The platform does not reproduce CMS staffing stars, infer care quality from staffing alone, rank facilities, or create a staffing score.

## Daily identity and preservation

A durable daily identity is the immutable source release plus CMS CCN plus work date. A second deterministic key hashes CCN and work date to detect duplicate records within a release. CCNs are six-character CMS identifiers and may be alphanumeric. Unmatched official CCNs remain durable with a null internal provider relationship; they are never silently discarded.

Every daily row references its source dataset, fixed source release/version, exact raw object, ingest run, source record locator, transformation version, provider CCN, and work date. The complete raw row remains available to ingestion and audit code but is never returned by the consumer read model.

## Calculations

All hours-per-resident-day (HPRD) calculations use the CMS-supported ratio-of-sums approach over days with positive census:

`sum(included reported hours) / sum(MDS daily census)`

If census is missing or zero, the day remains preserved but is excluded from the denominator and numerator for HPRD. If any required included-hour input is missing on an otherwise eligible day, the affected aggregate is null rather than silently treating the missing value as zero. Negative census or hour values are rejected. Source-file quarter and work-date quarter must agree.

| Measure               | Included source fields                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Total nursing HPRD    | Director of Nursing + administrative RN + RN + administrative LPN/LVN + LPN/LVN + CNA + nurse aide in training + medication aide total hours |
| RN HPRD               | Director of Nursing + administrative RN + RN total hours                                                                                     |
| LPN/LVN HPRD          | administrative LPN/LVN + LPN/LVN total hours                                                                                                 |
| CNA HPRD              | CNA total hours only                                                                                                                         |
| Weekday/weekend HPRD  | The same formula restricted to Monday–Friday or Saturday–Sunday                                                                              |
| Contract share        | contract hours across all eight categories / (employee + contract hours across all eight categories)                                         |
| Zero reported RN days | positive-census days where the combined Director of Nursing, administrative RN, and RN total is exactly zero                                 |

The summary also preserves observed days, positive-census days, census sum/minimum/maximum, hour sums, coverage dates, and formula version. “CNA HPRD” deliberately does not include nurse aides in training or medication aides. Daily variation is not converted into a grade or score.

CMS's public-file exclusion methodology identifies facilities with quarter-level total nurse HPRD equal to zero or greater than 12, nurse aide HPRD greater than 5.25, and equivalent weekend conditions. These are CMS publication rules, not platform thresholds. Task 008 does not re-label a published facility or invent day-level outlier thresholds.

## Read model and consumer copy

The server-only repository provides bounded summary, history, daily-quarter, and weekend projections. The consumer experience shows the current quarter plus up to three preceding quarters, while repository history remains capped at twelve; daily detail validates a quarter and returns at most 92 rows. No page component contains SQL and no consumer shape includes raw PBJ JSON.

The initial one-year window uses four consecutive CMS source periods from April 1, 2025 through March 31, 2026 (CY2025Q2 through CY2026Q1). The quarter selector and accessible trend table use precomputed summaries rather than loading daily rows.

The facility section identifies the source quarter and coverage, distinguishes reported PBJ measurements from the CMS staffing rating, shows a text/table equivalent for the trend, and uses neutral wording. Evidence-linked questions are deterministic: they may note an arithmetically lower weekend RN measure, nonzero contract participation, or an explicit zero combined-RN day, but never call staffing good, bad, unsafe, or deficient.

The section requires both server-only flags:

```text
CARE_ENABLE_REAL_PROVIDER_UI=true
CARE_ENABLE_STAFFING_INTELLIGENCE=true
```

`CARE_ENABLE_STAFFING_INTELLIGENCE` defaults false, is independent of inspection intelligence, is never browser-exposed, and does not enable development routes.

## Loading and operations

Use the immutable download/validate/ingest boundary, apply migration `0006_pbj_staffing.sql`, then promote normalized records with the PBJ loader. The loader uses bounded COPY staging, set-based provider resolution and inserts, set-based summary calculation, and one controlled transaction. An idempotent rerun returns the existing successful ingest.

Routine tests use synthetic records and never contact CMS. A real current-quarter load must be separately measured and audited before historical expansion. The architecture supports multiple quarters; eight quarters is the preferred review history once current-quarter volume, database connection mode, runtime, rejects, matching, and storage have been measured.
