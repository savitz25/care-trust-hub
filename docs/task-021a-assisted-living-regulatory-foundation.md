# Task 021A — Assisted living & memory-care regulatory foundation

Architecture and source discovery only. No national ingest. No public AL pages. No change to the 14,693 CMS SNFs.

Version: `assisted-living-identity-v1`

## State matrix

| State | Regulator                                         | Official terms                                         | Source                                                                                                                                                                                                               | Format              | ID                            | Memory evidence                       | Automation |
| ----- | ------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------- | ------------------------------------- | ---------- |
| CA    | CDSS Community Care Licensing                     | Residential Care Facility for the Elderly              | [CHHS CCL facilities](https://data.chhs.ca.gov/dataset/ccl-facilities)                                                                                                                                               | CSV                 | Facility Number               | Usually not in the listing            | High       |
| NY    | NYS DOH Adult Care / Assisted Living Surveillance | Adult Care Facility, Adult Home, ALR, ALP, EALR, SNALR | [HFIS General Information](https://health.data.ny.gov/Health/Health-Facility-General-Information/vn5v-hh5r) + [Certification](https://health.data.ny.gov/Health/Health-Facility-Certification-Information/2g9y-7kqm) | Socrata API         | Facility ID                   | SNALR is official                     | High       |
| TX    | HHSC                                              | Assisted Living Facility Type A/B                      | [ALF directory Excel](https://www.hhs.texas.gov/providers/long-term-care-providers/assisted-living-facilities-alf)                                                                                                   | XLSX                | Directory facility/license ID | Alzheimer's Certified when present    | Medium     |
| FL    | AHCA                                              | Assisted Living Facility                               | FloridaHealthFinder ALF export                                                                                                                                                                                       | XLSX / locator      | AHCA license/file number      | ECC/LMH/LNS are not dementia licenses | Medium     |
| NC    | DHHS DHSR Adult Care Licensure                    | Adult Care Home                                        | [DHSR listings](https://info.ncdhhs.gov/dhsr/acls/faclistings.html)                                                                                                                                                  | XLSX                | License number                | Special Care Unit if listed           | High       |
| PA    | DHS Bureau of Human Services Licensing            | Personal Care Home, Assisted Living Residence          | Human Services Provider Directory                                                                                                                                                                                    | Search, no bulk API | DHS license ID                | Not a statewide dementia license      | Low        |
| OH    | Ohio Department of Health                         | Residential Care Facility                              | eID / provider extract                                                                                                                                                                                               | Portal extract      | ODH facility ID               | No separate dementia license          | Medium     |
| NJ    | NJ DOH                                            | Assisted Living Residence, CPCH, ALP                   | LTC search + Excel                                                                                                                                                                                                   | Search / XLSX       | NJ facility number            | Not a distinct dementia license       | Medium     |

Commercial senior-living directories are not regulatory evidence.

## Selected pilots

**California, New York, Texas.**

- Consumer value is high in all three.
- Each has an official machine-readable listing (CSV, Socrata, or HHSC Excel).
- NY supplies the cleanest official memory/dementia certification (SNALR).
- TX supplies an Alzheimer's-certified field in the ALF directory.
- CA is the largest RCFE universe; memory designation is mostly `not_reported` until a later official column exists.

Florida is the next-best automation candidate but weaker on explicit memory evidence. NC is easy to parse but smaller. PA/OH/NJ stay later because bulk official extracts are thinner.

## Identity

Canonical key: `STATE:REGULATOR:SOURCE_FACILITY_ID`.

Internal UUID is assigned only at persistence. CMS CCN is never reused. A state license ID is authoritative only in its issuing jurisdiction. Shared address, brand, or campus does not merge licenses.

`VERIFIED` requires state + regulator + official facility ID + official name. Name-only rows are `REVIEW_REQUIRED`.

Future unpublished route concept: `/assisted-living/[state]/[provider-id]/[slug]`.

## Memory care

Never inferred from the facility name. Allowed values: explicit dementia/memory license or certification, secured/special-care unit, specialty endorsement, general assisted living only, or not reported.

## Organization semantics

Licensee, operator, management company, administrator, owner, and parent stay separate. “Owner” is used only when the source says ownership.

## Events / history

Reuse the existing state history event types (inspection, complaint, fine, restriction, suspension, closure, operator change). Keep regulator terminology in the title/summary. Do not invent severity. Do not attach events without the same state-scoped ID.

## Existing CMS safety

Additive domain only. No CMS ingest, search, ranking, workspace, or Google change.

## Google safeguard

Google Places API requests: 0
