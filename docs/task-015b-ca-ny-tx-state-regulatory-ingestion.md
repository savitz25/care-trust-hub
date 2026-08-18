# Task 015B — CA / NY / TX State Regulatory Ingestion

Production adapters ingested the current official nursing-home licensing files for California, New York, and Texas. State claims are **non-public**. CMS identity is unchanged. No consumer UI.

## Official sources

| State | Regulator | Source                                                                                                                                                                                                                    | Retrieved  |
| ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| CA    | CDPH CHCQ | [Licensed and Certified Healthcare Facility Listing](https://data.chhs.ca.gov/dataset/healthcare-facility-locations) (CKAN)                                                                                               | 2026-08-18 |
| NY    | NYS DOH   | [HFIS General Information](https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r) + [Certification beds](https://health.data.ny.gov/Health/Health-Facility-Certification-Information/2g9y-7kqm) | 2026-08-18 |
| TX    | HHSC      | [Directory of Nursing Facilities with an Active License](https://apps.hhs.texas.gov/providers/directories/NF.xlsx) (as of 2026-08-17)                                                                                     | 2026-08-18 |

SNF/nursing-facility rows only. No TULIP, PDFs, assisted living, or other states.

## Adapter implementation

Shared parse → `match_against_cms_universe` → append-only observations → VERIFIED external state license IDs → `publication_eligible=false` claims.

- CA: explicit `CCN` (leading-zero padded). Invalid CCNs are not fuzzy-matched.
- NY: no CCN. VERIFIED only with exact address + city/ZIP + name or phone. Multiple equally strong matches stay REVIEW_REQUIRED.
- TX: `Medicare Provider Number` as CCN when valid; title row in the XLSX is skipped.

Parser version: `state-regulator-v1`. Resolver: `state-cms-bridge-v1`.

## Source / reconciliation metrics

|                              |            CA |          NY |            TX |
| ---------------------------- | ------------: | ----------: | ------------: |
| Eligible NH records          |         1,186 |         606 |         1,175 |
| VERIFIED                     | 1,158 (97.6%) | 525 (86.6%) | 1,134 (96.5%) |
| PROBABLE                     |             1 |          21 |             0 |
| REVIEW_REQUIRED              |            13 |          58 |             0 |
| UNRESOLVED                   |            14 |           2 |            41 |
| REJECTED                     |             0 |           0 |             0 |
| Outside current CMS universe |            12 |           0 |            41 |
| Ambiguous multi-match        |            10 |          41 |             0 |

CMS facilities / unique CCNs after ingest: **14,693 / 14,693**.

## QA precision

Audits treat CCN agreement (CA/TX) or address agreement (NY) as identity ground truth. Licensee/legal-entity names are not facility names.

|     |                    Audited VERIFIED | Failures | Critical wrong-facility | Measured precision |
| --- | ----------------------------------: | -------: | ----------------------: | -----------------: |
| CA  |                 30 random CCN links |        0 |                       0 |               100% |
| NY  | 50 random + all 525 address-checked |        0 |                       0 |               100% |
| TX  |     40 random Medicare-number links |        0 |                       0 |               100% |

NY: 0 address mismatches among 525 VERIFIED links.

## Claim counts (non-public)

| Claim             |    CA |  NY |    TX |
| ----------------- | ----: | --: | ----: |
| License ID        | 1,159 | 546 | 1,134 |
| Status            | 1,159 |   0 |     0 |
| Type              | 1,159 | 546 | 1,134 |
| Capacity          | 1,159 | 546 | 1,134 |
| Licensee          | 1,158 |  51 | 1,133 |
| Operator          |     0 | 546 |     0 |
| Administrator     | 1,101 |   0 |    44 |
| Management entity |     0 |   0 |    14 |

TX status is not a regulatory category in the Excel (only licensed/certified flags). NY has no status column.

## State vs CMS conflicts (preserve both)

Among VERIFIED links:

|                                              |  CA |  NY |                        TX |
| -------------------------------------------- | --: | --: | ------------------------: |
| Name differs (often DBA vs legal)            | 960 |  51 | many licensee vs CMS name |
| Address formatting/value differs             | 234 |   0 |                       137 |
| Phone differs                                | 220 |  49 |                        30 |
| State licensed capacity ≠ CMS certified beds |  87 |  52 |                       819 |

Do not collapse these. Capacity especially is a different concept in Texas.

## Google review-queue overlap (measurement only)

Resolver V2.2 was not changed.

|     | Google REVIEW_REQUIRED | Now also VERIFIED state identity |
| --- | ---------------------: | -------------------------------: |
| CA  |                    295 |                              290 |
| NY  |                    238 |                              198 |
| TX  |                    288 |                              272 |

## Data integrity

- Canonical facilities: 14,693
- Unique CMS CCNs: 14,693
- State claims `publication_eligible`: **0**
- Google claim rows unchanged as a class (90,687 `google_*`)
- Re-run of the same bytes is skipped via release fingerprint

## Issues

- TX Excel has a title row; parser now promotes the real header row.
- TX administrator and management-company columns are sparsely populated.
- NY coverage is lower because matching is address-based by design.
- 41 TX Medicare numbers are outside the current CMS universe (kept as observations, not forced).

## Recommendation

**READY FOR 015C.** Publication can expose field-level VERIFIED license/status/capacity/licensee/operator/administrator for CA/NY/TX only. Keep claims fail-closed and do not overwrite CMS beds or names.
