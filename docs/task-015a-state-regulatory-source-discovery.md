# Task 015A — State Regulatory Source Discovery & Adapter Framework

Discovery of eight official state nursing-home regulators plus a reusable adapter contract. No production state claims, no consumer-page changes, no 50-state ingestion.

## Executive Summary

Authoritative structured data exists today in California (CKAN/CSV with explicit CMS CCN) and New York (Socrata HFIS). Texas publishes an official Excel directory plus closures and CHOW reports. North Carolina publishes official XLSX lists. Florida, Ohio, New Jersey, and Pennsylvania have useful official consumer/search systems that are harder to automate safely.

Recommended 015B cohort: **California, New York, Texas**.

CMS CCN remains canonical. State evidence is an observation → claim layer. Google and facility websites must not override state license/enforcement claims.

## Eight-State Source Matrix

| State | Regulator                              | Primary official source                                                                                                                                                                                              | Access                           | Automation                     | CMS bridge                         | AL/memory-care later?                              |
| ----- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------ | ---------------------------------- | -------------------------------------------------- |
| CA    | CDPH CHCQ Licensing & Certification    | [Licensed and Certified Healthcare Facility Listing](https://data.chhs.ca.gov/dataset/healthcare-facility-locations)                                                                                                 | CKAN CSV / API                   | LOW                            | EXCELLENT (explicit `CCN`)         | Partial — SNF/ICF on this file; RCFE is CDSS CCL   |
| NY    | NYS DOH                                | [HFIS General Information](https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r) + [Certification](https://health.data.ny.gov/Health/Health-Facility-Certification-Information/2g9y-7kqm) | Socrata API                      | LOW                            | STRONG (no CCN; op-cert + address) | Yes — Adult Home / Enriched Housing on HFIS        |
| TX    | HHSC Long-Term Care Regulatory         | [NF directory Excel](https://apps.hhs.texas.gov/providers/directories/NF.xlsx) + [NF program page](https://www.hhs.texas.gov/providers/long-term-care-providers/nursing-facilities-nf)                               | XLSX download; TULIP HTML search | LOW (directory) / HIGH (TULIP) | STRONG                             | Yes — TULIP also covers ALF                        |
| NC    | NCDHHS DHSR NHLCS                      | [Licensed Facilities lists](https://info.ncdhhs.gov/dhsr/reports.htm) (`Nhlist_a.xlsx`, updated 2026-08-06)                                                                                                          | XLSX                             | LOW                            | MODERATE                           | Yes — Adult Care Home listing is a sibling file    |
| FL    | AHCA                                   | [FloridaHealthFinder locator](https://quality.healthfinder.fl.gov/Facility-Search/FacilityLocateSearch) + inspection document search                                                                                 | HTML search / PDF reports        | HIGH                           | MODERATE                           | Yes — same locator includes ALF                    |
| PA    | PA DOH                                 | [Nursing Home Reports](https://www.pa.gov/agencies/health/health-statistics/health-facilities/nursing-home-reports) + [locator](https://sais.health.pa.gov/commonpoc/nhlocatorie.asp)                                | Annual XLSX/CSV; ASP search      | MEDIUM                         | MODERATE                           | No — personal care is DHS, not this DOH NH program |
| OH    | ODH Bureau of Survey and Certification | [Nursing Homes program](https://odh.ohio.gov/know-our-programs/nursing-homes-facilities) + [eID](http://publicapps.odh.ohio.gov/eid/default.aspx)                                                                    | HTML search                      | HIGH                           | MODERATE                           | Yes — Residential Care Facilities are ODH-licensed |
| NJ    | NJ DOH Health Facilities               | [LTC search](https://healthapps.nj.gov/facilities/fsSearch.aspx) + [enforcement](https://www.nj.gov/health/healthfacilities/)                                                                                        | HTML search                      | HIGH                           | MODERATE                           | Yes — AL residences are the same DOH program       |

### Field availability (nursing homes / SNFs)

Marks: **S** structured · **U** unstructured/PDF · **P** partial · **N** not public · **?** unknown

| Field                           | CA                                     | NY                                  | TX                              | NC            | FL                         | PA                        | OH          | NJ             |
| ------------------------------- | -------------------------------------- | ----------------------------------- | ------------------------------- | ------------- | -------------------------- | ------------------------- | ----------- | -------------- |
| State facility/license ID       | S                                      | S                                   | S                               | S             | S                          | P                         | S           | S              |
| Name / address / phone / county | S                                      | S                                   | S                               | S             | S                          | S                         | S           | S              |
| Coordinates                     | S                                      | S                                   | P                               | N             | P                          | P                         | ?           | P              |
| License status / type / dates   | S                                      | P                                   | P                               | P             | S                          | P                         | P           | P              |
| Capacity                        | S                                      | S                                   | S                               | S             | S                          | S                         | P           | P              |
| Licensee / operator / admin     | S                                      | S                                   | P                               | P             | P                          | P                         | P           | P              |
| Explicit CMS CCN                | S                                      | N                                   | P                               | P             | P                          | P                         | P           | P              |
| Inspections / deficiencies      | U                                      | P/U                                 | U                               | U             | U                          | P                         | U           | U              |
| Complaints                      | N                                      | P                                   | N                               | N             | P                          | N                         | P           | P              |
| Enforcement / fines / orders    | P                                      | P                                   | P                               | P             | U                          | P                         | P           | S/U            |
| Closures / CHOW                 | P                                      | P                                   | S/P                             | P             | P                          | P                         | P           | P              |
| Historical depth                | monthly snapshot + limited across-time | current HFIS; profiles have history | directory + quarterly CHOW PDFs | current lists | multi-year inspection PDFs | annual reports from ~2002 | current eID | current search |
| Refresh                         | monthly (DATA_DATE)                    | weekly/daily metadata               | irregular                       | monthly       | unknown                    | annual                    | unknown     | unknown        |

Tiny official fetches used: CA CKAN `datastore_search` limit=1; NY Socrata view metadata. No bulk download.

## State Priority Score

Internal implementation-priority only. Not a consumer Trust Score. Max 35.

| State | License | Enforcement | Inspection/complaint | Operator | History | Automation | CMS bridge |  Total |
| ----- | ------: | ----------: | -------------------: | -------: | ------: | ---------: | ---------: | -----: |
| CA    |       5 |           2 |                    2 |        4 |       3 |          5 |          5 | **26** |
| NY    |       4 |           2 |                    3 |        5 |       3 |          5 |          4 | **26** |
| TX    |       4 |           3 |                    2 |        3 |       3 |          4 |          4 | **23** |
| FL    |       4 |           4 |                    4 |        3 |       4 |          2 |          3 | **24** |
| NC    |       4 |           2 |                    2 |        2 |       2 |          4 |          3 | **19** |
| PA    |       3 |           2 |                    2 |        2 |       3 |          3 |          3 | **18** |
| OH    |       3 |           2 |                    3 |        2 |       2 |          2 |          3 | **17** |
| NJ    |       3 |           3 |                    2 |        2 |       2 |          2 |          3 | **17** |

Florida scores high on consumer-facing inspection/order value but low on safe automation.

## Tier Ranking

- **Tier A — Build first:** California, New York
- **Tier B — Build next:** Texas, Florida, North Carolina
- **Tier C — Difficult / specialized:** Pennsylvania, Ohio, New Jersey

## Adapter Architecture

Existing 014B `FacilitySourceAdapter` / `FacilitySourceObservation` remain the persistence contract.

015A adds, without eight unfinished adapters:

- TypeScript `STATE_CLAIM_TYPES` and `resolveStateLicenseToCms()`
- Python `StateRegulatorAdapter` protocol, `StateLicenseRecord`, `resolve_against_canonical_cms()`, observation emitter
- Discovery registry `state_regulator_sources.json` (`implemented=false`)
- Official CA sample fixture + tests

Flow: official release → parse/normalize → emit append-only state observations → deterministic CMS bridge → state claims with publication eligibility later. CMS rows are never overwritten.

## Claim Types

`STATE_LICENSE_ID`, `STATE_LICENSE_STATUS`, `STATE_LICENSE_TYPE`, `STATE_LICENSE_ISSUE_DATE`, `STATE_LICENSE_EXPIRATION_DATE`, `STATE_LICENSE_CAPACITY`, `STATE_LICENSEE`, `STATE_OPERATOR`, `STATE_MANAGEMENT_ENTITY`, `STATE_ADMINISTRATOR`, `STATE_INSPECTION`, `STATE_COMPLAINT`, `STATE_ENFORCEMENT_ACTION`, `STATE_FINE`, `STATE_ORDER`, `STATE_RESTRICTION`, `STATE_CLOSURE_ACTION`, `STATE_OWNERSHIP_CHANGE`.

## Conflict Policy

Preserve both sources. Example: CMS participation remains a federal observation if the state license is suspended; the state suspension is the authoritative `STATE_LICENSE_STATUS`. Do not replace the CMS facility name with the state legal entity; emit `STATE_LICENSEE` / public DBA as related claims.

A state-license relationship requires stronger evidence than Google. CCN match verifies. Name similarity alone never verifies.

## Existing Google Review Cases by State

Cheap latest-per-provider analysis. No resolver changes. National latest `REVIEW_REQUIRED`: **4,307** (vs ~4,216 from the 014D run-level count).

| State | REVIEW_REQUIRED | VERIFIED | PROBABLE | UNRESOLVED | Enriched in state |
| ----- | --------------: | -------: | -------: | ---------: | ----------------: |
| OH    |             380 |      535 |        4 |          0 |               922 |
| CA    |             295 |      868 |        0 |          0 |             1,165 |
| TX    |             288 |      885 |        1 |          3 |             1,177 |
| NY    |             238 |      352 |        4 |          0 |               594 |
| PA    |             201 |      449 |        3 |          0 |               656 |
| FL    |             181 |      510 |        2 |          1 |               694 |
| NC    |             118 |      300 |        0 |          0 |               419 |
| NJ    |             109 |      237 |        2 |          0 |               348 |

State evidence may later help some of these cases. It must not auto-resolve Google identity in 015A.

## Recommended 015B States

1. **California** — richest structured license file and explicit CCN.
2. **New York** — different architecture (Socrata HFIS, no CCN) to prove the address/operator bridge.
3. **Texas** — official Excel + closures/CHOW, large market, different file shape.

Do not ingest all eight.

## Major Risks / Access Constraints

- FL / OH / NJ: session or HTML search; do not bypass CAPTCHA or robots.
- NY HFIS has no CCN; do not invent one from name.
- TX TULIP and FL inspection PDFs are not bulk-safe in 015B; start with downloadable directories.
- PA locator is classic ASP; prefer annual official extracts.
- Assisted living is often a sibling license type, not this CMS SNF universe. Do not ingest it in 015B.
