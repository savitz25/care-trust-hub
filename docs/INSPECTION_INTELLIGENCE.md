# CMS inspection intelligence

## Scope

This layer preserves three distinct CMS record types: survey/inspection events, health-deficiency findings, and penalties/enforcement actions. It does not create a facility score or infer quality beyond the published record. Event history (when an inspection or penalty occurred) remains separate from release history (when CMS published a record).

## Verified source contracts

All three sources are official CMS Provider Data datasets, published monthly. The July 2026 files were released July 29, 2026 and carry a CMS source-modified date of July 1, 2026.

| Contract                         | CMS dataset ID | Official source                                      |
| -------------------------------- | -------------- | ---------------------------------------------------- |
| Nursing Home Inspection Dates    | `svdt-c123`    | https://data.cms.gov/provider-data/dataset/svdt-c123 |
| Nursing Home Health Deficiencies | `r5ix-sfxw`    | https://data.cms.gov/provider-data/dataset/r5ix-sfxw |
| Nursing Home Penalties           | `g6vv-u9sr`    | https://data.cms.gov/provider-data/dataset/g6vv-u9sr |

The versioned machine-readable registry is authoritative for retrieval configuration. Release dates, filenames, checksums, and retrieval timestamps belong to immutable release manifests, not application constants.

## Identity and relationships

CMS does not publish one shared inspection identifier across these files. An inspection event therefore uses a documented deterministic key derived from the verified Inspection Dates fields: exact CCN, survey date, survey type, and survey cycle. Processing date is retained as metadata but is not identity. A deficiency uses its full verified citation attributes plus a deterministic occurrence ordinal to retain duplicate official rows without collapsing evidence.

A deficiency is linked to an inspection only when CCN, survey date, cycle, and exactly one compatible survey-type indicator establish one match. Ambiguous findings remain preserved with a null `inspection_event_id`; they are not forced into an event. The current July 2026 load retains 30,374 such findings for future contract refinement.

Penalty identity is a deterministic key over the verified penalty fields and occurrence ordinal. Monetary values use PostgreSQL `numeric(14,2)` and Python `Decimal`-safe strings, never floating point.

## CMS scope and severity

The application uses the official CMS A-L matrix:

- A-C: no actual harm with potential for minimal harm; isolated, pattern, widespread.
- D-F: no actual harm with potential for more than minimal harm that is not immediate jeopardy; isolated, pattern, widespread.
- G-I: actual harm that is not immediate jeopardy; isolated, pattern, widespread.
- J-L: immediate jeopardy to resident health or safety; isolated, pattern, widespread.

Unknown codes stop normalization. Consumer surfaces show the published code, official scope, and official severity wording. They do not translate these into proprietary low/medium/high labels.

## Load and provenance

Load order is Inspection Dates, Health Deficiencies, then Penalties. Validated JSONL records are transported to an operational staging relation, resolved set-wise to durable CMS CCN provider identities, and inserted in one final transaction per release. Pooler environments that terminate long COPY streams use bounded `executemany` transport batches; the evidence insert and ingest success marker remain atomic.

Every normalized record retains provider, source dataset, immutable source release, raw object, ingest run, source-record locator, transformation version, and its exact raw CMS row. Re-running an identical successful release is idempotent. A logical release with different bytes fails checksum validation.

## Consumer boundaries

The server-only read model returns bounded, parameterized views and never raw JSON. It selects only successfully ingested current releases by source semantics, not insertion time. The feature requires both:

```text
CARE_ENABLE_REAL_PROVIDER_UI=true
CARE_ENABLE_INSPECTION_INTELLIGENCE=true
```

The second flag defaults off and is never public. The UI uses progressive disclosure, factual chronology, explicit loaded-dataset coverage, and official source details. It does not say a facility “failed,” declare a winner, or imply that no loaded record means an event never occurred.

## Developer workflow

```powershell
python -m care_ingest download nursing-home-inspection-dates
python -m care_ingest validate nursing-home-inspection-dates --release 2026-07-01
python -m care_ingest ingest nursing-home-inspection-dates --release 2026-07-01
python -m care_ingest load nursing-home-inspection-dates --release 2026-07-01
python -m care_ingest audit-regulatory
```

Repeat for `nursing-home-health-deficiencies` and `nursing-home-penalties`. Raw and derived data directories remain ignored by Git.
