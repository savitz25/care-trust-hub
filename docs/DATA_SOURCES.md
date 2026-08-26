# Authoritative source registry

Machine-readable contract: `services/ingest/src/care_ingest/resources/cms_sources.json`.

“Verified” means the official CMS identity was checked. “Implemented” means this repository can download, normalize, and load that source.

Florida AHCA and other state assisted-living regulators are **not** part of this national CMS registry.

Refresh commands and check scheduler: [CMS-REFRESH-RUNBOOK.md](./CMS-REFRESH-RUNBOOK.md). Daily GitHub Actions **check-only** detects changed vs unchanged CMS releases. Production evidence writes are not scheduled; they require `CARE_CMS_REFRESH_WRITES=true`. Per-source freshness: view `cms_source_freshness` and `GET /api/cms-source-freshness`. There is no global last-updated timestamp.

Home Health and Hospice are first-class provider types (`home_health`, `hospice`). They are not nursing homes. Canonical IDs are `HOME_HEALTH_CCN` and `HOSPICE_CCN`. Office location is not service-area proof. HHCAHPS and Hospice CAHPS are surveys, not clinical quality. See [task-sen-nat-003-hh-hospice.md](./task-sen-nat-003-hh-hospice.md).

| Status                     | Official CMS source                        | CMS identifier                         | Cadence   | Ingest command                                                       | Contribution                                                                                         | Limitations                                               |
| -------------------------- | ------------------------------------------ | -------------------------------------- | --------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **VERIFIED + IMPLEMENTED** | Provider Information                       | `4pq5-n9py`                            | Monthly   | `python -m care_ingest download nursing-home-provider-information`   | Current NH identity, location, beds, participation, four star ratings, phone; raw SFF/abuse/turnover | Current-active listing only. Missing row ≠ closed         |
| **VERIFIED + IMPLEMENTED** | Ownership                                  | `y2hd-n93e`                            | Monthly   | `... nursing-home-ownership`                                         | Care Compare ownership/control rows                                                                  | Role text must be preserved; not a tenure graph           |
| **VERIFIED + IMPLEMENTED** | Skilled Nursing Facility All Owners        | `afe44b85-cc6d-40d7-b5df-00ae8910d1d2` | Monthly   | `... skilled-nursing-facility-all-owners`                            | PECOS 855A owners                                                                                    | Self-reported                                             |
| **VERIFIED + IMPLEMENTED** | SNF Enrollments                            | `5f2c306f-3b1c-42cd-b037-187b2ce22126` | Monthly   | `... skilled-nursing-facility-enrollments`                           | Enrollment ID, PAC ID, organization NPI, CCN                                                         | NPI is enrollment-organization NPI, not a CCN replacement |
| **VERIFIED + IMPLEMENTED** | SNF Change of Ownership                    | `f557a6ed-95b3-4a22-8433-4175db2dec1c` | Quarterly | `... skilled-nursing-facility-change-of-ownership`                   | Dated CHOW events                                                                                    | Not a complete operator history                           |
| **VERIFIED + IMPLEMENTED** | SNF CHOW owner information                 | `a4358712-e910-4eaf-8f24-5e90ba3cf8d0` | Quarterly | `... skilled-nursing-facility-change-of-ownership-owner-information` | Buyer/seller parties                                                                                 | Linked by enrollment ID                                   |
| **VERIFIED + IMPLEMENTED** | Nursing Home Chain Performance Measures    | `97ecfad1-d3f1-4d42-b774-d74661d830bc` | Monthly   | `... nursing-home-chain-performance-measures`                        | Official CMS chain aggregates                                                                        | Chain ID ≠ organization UUID                              |
| **VERIFIED + IMPLEMENTED** | Health Deficiencies                        | `r5ix-sfxw`                            | Monthly   | `... nursing-home-health-deficiencies`                               | Health citations, scope/severity, complaint flag                                                     | Some findings cannot link to an inspection                |
| **VERIFIED + IMPLEMENTED** | Penalties                                  | `g6vv-u9sr`                            | Monthly   | `... nursing-home-penalties`                                         | Fines and payment denials                                                                            | No proposed-vs-final disposition                          |
| **VERIFIED + IMPLEMENTED** | Inspection Dates                           | `svdt-c123`                            | Monthly   | `... nursing-home-inspection-dates`                                  | Health, fire, complaint, infection survey dates                                                      | No shared CMS survey ID across files                      |
| **VERIFIED + IMPLEMENTED** | Fire Safety Deficiencies                   | `ifjz-ge4w`                            | Monthly   | `... nursing-home-fire-safety-deficiencies`                          | Fire-safety citations                                                                                | Not health deficiencies; not a fire count                 |
| **VERIFIED + IMPLEMENTED** | Payroll Based Journal Daily Nurse Staffing | `7e0d53ba-8f02-4c66-98a5-14a1c997c50d` | Quarterly | `... payroll-based-journal-daily-nurse-staffing`                     | Daily hours, HPRD, weekend, contract share                                                           | Paid hours; CMS exclusions apply                          |
| **VERIFIED + IMPLEMENTED** | MDS Quality Measures                       | `djen-97ju`                            | Monthly   | `... nursing-home-mds-quality-measures`                              | Individual MDS measures and quarterly scores                                                         | Not the QM star rating; suppressed values remain          |

Provider Information contains one row per currently listed nursing home. Distribution URLs are resolved from CMS metadata at retrieval time. Release manifests capture URL, modified date, retrieval time, filename, bytes, and SHA-256.

# Derived national evidence (not separate CMS datasets)

| Command                   | Input                   | Output                                                                            |
| ------------------------- | ----------------------- | --------------------------------------------------------------------------------- |
| `derive-cms-designations` | Current PI `raw_record` | `cms_facility_designation` (SFF / candidate / abuse icon)                         |
| `derive-facility-npi`     | SNF enrollment rows     | `provider_npi_relationship` (CONFIRMED same-row CCN+NPI only)                     |
| `derive-directory-status` | Current PI membership   | `provider_directory_status` (`CURRENT_ACTIVE` or `ABSENT_FROM_CURRENT_DIRECTORY`) |

# Regulatory implementation notes

Inspection, health-deficiency, fire-citation, and penalty records remain distinct. See [INSPECTION_INTELLIGENCE.md](./INSPECTION_INTELLIGENCE.md). PBJ: [STAFFING_INTELLIGENCE.md](./STAFFING_INTELLIGENCE.md).
