# Authoritative source registry

Verification date: **August 14, 2026**. Only official CMS pages and APIs were used. The machine-readable contract is `services/ingest/src/care_ingest/resources/cms_sources.json`. “Verified” means the official identity and purpose were checked; it does not mean ingestion is implemented.

| Status                     | Official CMS source                        | CMS identifier                         | Format               | Cadence   | Official documentation                                                                                                                                                                       |
| -------------------------- | ------------------------------------------ | -------------------------------------- | -------------------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **VERIFIED + IMPLEMENTED** | Provider Information                       | `4pq5-n9py`                            | CSV                  | Monthly   | [Dataset](https://data.cms.gov/provider-data/dataset/4pq5-n9py) · [Dictionary](https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf) |
| **VERIFIED, PLANNED**      | Ownership                                  | `y2hd-n93e`                            | CSV                  | Monthly   | [Dataset](https://data.cms.gov/provider-data/dataset/y2hd-n93e)                                                                                                                              |
| **VERIFIED, PLANNED**      | Skilled Nursing Facility All Owners        | `afe44b85-cc6d-40d7-b5df-00ae8910d1d2` | CSV via CMS Data API | Monthly   | [Dataset/API](https://data.cms.gov/provider-characteristics/hospitals-and-other-facilities/skilled-nursing-facility-all-owners/api-docs)                                                     |
| **VERIFIED, PLANNED**      | Nursing Home Chain Performance Measures    | `97ecfad1-d3f1-4d42-b774-d74661d830bc` | CSV via CMS Data API | Monthly   | [Dataset/API](https://data.cms.gov/quality-of-care/nursing-home-chain-performance-measures/api-docs)                                                                                         |
| **VERIFIED, PLANNED**      | Health Deficiencies                        | `r5ix-sfxw`                            | CSV                  | Monthly   | [Dataset](https://data.cms.gov/provider-data/dataset/r5ix-sfxw) · [Dictionary](https://data.cms.gov/provider-data/sites/default/files/data_dictionaries/nursing_home/NH_Data_Dictionary.pdf) |
| **VERIFIED, PLANNED**      | Penalties                                  | `g6vv-u9sr`                            | CSV                  | Monthly   | [Dataset](https://data.cms.gov/provider-data/dataset/g6vv-u9sr)                                                                                                                              |
| **VERIFIED, PLANNED**      | Inspection Dates                           | `svdt-c123`                            | CSV                  | Monthly   | [Dataset](https://data.cms.gov/provider-data/dataset/svdt-c123)                                                                                                                              |
| **VERIFIED, PLANNED**      | Payroll Based Journal Daily Nurse Staffing | **requires verification**              | CSV via CMS Data API | Quarterly | [Dataset](https://data.cms.gov/quality-of-care/payroll-based-journal-daily-nurse-staffing) · [Methodology](https://data.cms.gov/resources/payroll-based-journal-methodology-0)               |
| **VERIFIED, PLANNED**      | MDS Quality Measures                       | `djen-97ju`                            | CSV                  | Monthly   | [Dataset](https://data.cms.gov/provider-data/dataset/djen-97ju)                                                                                                                              |

Provider Information contains one row per currently active nursing home. Its current distribution URL is intentionally not committed: the downloader resolves the official CSV from the CMS metadata API at retrieval time. Release manifests capture the exact resulting URL, source modified date, retrieval time, filename, byte count, and SHA-256.

Provider Data Catalog exposes archived nursing-home topic downloads. Coverage and semantics must be verified per release before use. The All Owners, chain, and PBJ products expose version lists through the CMS Data API. Unknown or unconfirmed identifiers remain `null`/“requires verification” in the registry.

Florida AHCA assisted-living data and other state regulators remain future state-adapter work and are not part of this registry.

# Regulatory source implementation status

The following official CMS monthly sources are VERIFIED and IMPLEMENTED behind a separate review flag:

- Nursing Home Inspection Dates (`svdt-c123`): https://data.cms.gov/provider-data/dataset/svdt-c123
- Nursing Home Health Deficiencies (`r5ix-sfxw`): https://data.cms.gov/provider-data/dataset/r5ix-sfxw
- Nursing Home Penalties (`g6vv-u9sr`): https://data.cms.gov/provider-data/dataset/g6vv-u9sr

Release-specific filenames, dates, and checksums are recorded in immutable local manifests. See [INSPECTION_INTELLIGENCE.md](./INSPECTION_INTELLIGENCE.md).
