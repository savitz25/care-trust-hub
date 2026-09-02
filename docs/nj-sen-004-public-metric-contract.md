# NJ-SEN-004 internal metric contract

Internal only. Not a public page. Metrics stay unpublished until production execution and a separate publication decision.

Do not sum CMS nursing homes, Home Health agencies, and Hospice providers.
Do not show zero CCRCs while the roster is `SOURCE_AVAILABLE_BY_REQUEST`.
Do not treat office county as service area.
Do not call Medicaid listed rates consumer prices.
Do not create enforcement, staffing, or CCRC scores.

Every metric below is **NOT_PUBLIC**. Values in the companion snapshot are local-file derived until `CARE_DATABASE_URL` execution.

## NJDOH long-term care

| Field | Contract |
| --- | --- |
| Display label | New Jersey NJDOH long-term-care licensed identities |
| Definition | Count of current All_LTC source identities |
| Numerator | Rows in the current All_LTC snapshot |
| Denominator | Official All_LTC workbook |
| Population | NJDOH LTC licensed facilities |
| Included | All 19 official NJDOH LTC types in the snapshot |
| Excluded | All_Acute, PACE, CCRC, CMS-only |
| Source | https://healthapps.nj.gov/facilities/documents2/All_LTC.xlsx |
| Geographic grain | state / county |
| Identity rule | `dataset_key = nj-doh-all-ltc` |
| Trace | `SELECT official_facility_type_canonical, COUNT(*) FROM state_facility_identity WHERE dataset_key='nj-doh-all-ltc' GROUP BY 1` |

Counts by official licensed type and licensed beds/slots by type use the same source and identity rule.

## NJDOH acute care

| Field | Contract |
| --- | --- |
| Display label | New Jersey NJDOH acute-care licensed identities |
| Definition | Count of current All_Acute source identities |
| Population | NJDOH acute licensed facilities |
| Included | Every official All_Acute type, stored separately |
| Excluded | All_LTC identities |
| Source | https://healthapps.nj.gov/facilities/documents2/All_Acute.xlsx |
| Identity rule | `dataset_key = nj-doh-all-acute` |
| Trace | `SELECT official_facility_type_canonical, COUNT(*) FROM state_facility_identity WHERE dataset_key='nj-doh-all-acute' GROUP BY 1` |

Separate metrics, never combined:

- Home Health Agency (`NJ_HHA`)
- Hospice Care Program (`NJ_HOSPICE_PROGRAM`)
- Hospice Care Branch (`NJ_HOSPICE_BRANCH`)
- Hospice Care – Inpatient (`NJ_HOSPICE_INPATIENT`)
- Other acute-care types

County distribution is **physical location**, not service area.

Service-area coverage is a different measure and is `SOURCE_ACCESS_BLOCKED`.

## CMS national class overlay

Keep three class metrics. Do not add them.

- Current NJ CMS nursing homes
- Current NJ CMS Home Health agencies
- Current NJ CMS Hospice GI providers

State-license match coverage is class-scoped. State-only and CMS-only counts stay separate.

## NJDOH enforcement

Indexed occurrences, canonical documents, documents by official action type, unique facilities with attached documents, LTC versus acute/other coverage, source availability, OCR backlog.

Do not create an enforcement score.

## Staffing

Latest populated quarter, reporting nursing facilities, RN/LPN/CNA ratios by shift, missing/suppressed values, statewide comparators, historical quarter coverage.

Do not create a staffing rank. Do not attach staffing to ALR/CPCH/ALP/HHA/Hospice/PACE/CCRC.

## Medicaid assisted living

Listed providers in the official SFY schedule, rate range, printed subtype counts, identity-match coverage, unknown subtype count, source effective date.

A listed rate is reimbursement evidence, not a consumer price. Unlisted facilities are not labeled non-participating.

## PACE

Distinct operating organizations, centers, full-county service areas, partial-county/ZIP service areas, awarded or in-development territories, historical status changes.

Awarded future coverage is not operating.

## CCRC

Registered/certificated providers only when acquired. Current coverage state: `SOURCE_AVAILABLE_BY_REQUEST`.

Do not display zero CCRCs as a published count.

## Publication status

All metrics: `NOT_PUBLIC`. Feature flag remains false. Route remains unbuilt. Sitemap unchanged.
