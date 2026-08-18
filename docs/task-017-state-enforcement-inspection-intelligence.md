# Task 017 — CA / NY / TX State Enforcement & Inspection Intelligence

State enforcement and inspection events now appear inside existing Facility History. CMS events are unchanged. No score.

## Sources used

| State | Official source                                                                                                                           | Access                                              | What was published                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------- |
| CA    | CDPH / CHHS [Health Facilities State Enforcement Actions](https://data.chhs.ca.gov/dataset/healthcare-facility-state-enforcement-actions) | CKAN datastore                                      | SNF citations and administrative penalties, 1999–2024                        |
| NY    | NYS DOH [Nursing Home Profile](https://health.data.ny.gov/Health/Nursing-Home-Profile/dypu-nabu)                                          | official ZIP (Surveys, ENFORCEMENTS, Facility_Info) | Complaint/standard surveys and state fines through July 2026                 |
| TX    | HHSC [NF closures Excel](https://apps.hhs.texas.gov/providers/directories/Closures/nf_closures.xlsx)                                      | XLSX                                                | Parsed; **0 published** (facility IDs do not match VERIFIED license numbers) |

Identity bridge: VERIFIED 015B state license IDs only. No CMS name-matching.

## Sources deferred

- **CA CalHealthFind / citation PDFs** and 2012–2017 narrative dump — stale or unstructured.
- **NY profiles.health.ny.gov HTML** — not needed once the official profile extract was available.
- **TX TULIP** — session portal.
- **TX Immediate Jeopardy PDF** — official but not a reliable bulk table (403 on direct fetch; would need brittle PDF work).
- **TX quarterly CHOW PDFs** — multiple inconsistent PDFs; CMS ownership-change events already exist.
- **TX closures publication** — official file uses a different facility-ID space than the VERIFIED license IDs.

## Event types published

`STATE_FINE`, `STATE_ENFORCEMENT_ACTION`, `STATE_COMPLAINT_INSPECTION`, `STATE_INSPECTION`. Closures/IJ/suspensions are modeled but not populated from the deferred TX/CA PDF sources.

NY surveys that share a date with an existing CMS inspection are stored as `POSSIBLE_DUPLICATE` and **not published**, so one incident does not appear twice.

## Coverage

|                                        |        CA |        NY |  TX |
| -------------------------------------- | --------: | --------: | --: |
| Facilities with published state events |       272 |       505 |   0 |
| Published events                       |     3,317 |     4,485 |   0 |
| Fines                                  |     3,238 |       792 |   0 |
| Other enforcement actions              |        79 |         0 |   0 |
| Complaint inspections                  |         0 |     2,704 |   0 |
| Other state inspections                |         0 |       989 |   0 |
| Earliest / latest published            | 1999–2024 | 2003–2026 |   — |

Unpublished NY possible-duplicates: 1,599. Unresolved CA historical FACIDs with no current VERIFIED license: 22,438.

## Facility History

State events use family `state`, show the official regulator label, and can appear in **What changed recently?** when HIGH/MEDIUM. Kill switch: `CARE_ENABLE_STATE_ENFORCEMENT_INTELLIGENCE`. CMS history and the 015C license section stay up if the flag is off.

## QA

Full published-set license-link audit: **0** mismatches to VERIFIED `STATE_LICENSE_ID`. Cross-state provider links: **0**. Representative recent CA fines and NY fines/complaint inspections reviewed; all CCNs are in the matching state.

## Data safety

CMS facilities / CCNs: 14,693 / 14,693. CMS history events remain 147,396. Google claims 90,687. State license claims 16,406.

## Next

**Task 018 — Ownership Intelligence V2.** Do not start it here.
