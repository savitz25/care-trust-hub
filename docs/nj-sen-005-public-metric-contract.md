# NJ-SEN-005 public metric contract

Public page: `/new-jersey`. Snapshot: `nj-sen-005-public-v1`. Fingerprint: `92e0742f77f2f55a5ccd6217c5caa779f3281fd26b1d91c14e2df11ae144011a`.

Liberal inclusion applies to source-backed state intelligence. Conservative attribution applies to facility profiles. Missing evidence blocks that metric, not New Jersey.

Do not sum All_LTC, All_Acute, and CMS class overlays into one senior-provider denominator.
Do not show zero CCRCs while the roster is `SOURCE_AVAILABLE_BY_REQUEST`.
Do not treat office county as service area.
Do not treat Medicaid listed rates as quality or participation.
Do not create enforcement, staffing, or CCRC scores.
Do not attach unresolved enforcement to profiles.
Do not publish a Trust Score or ranking.

## PUBLIC

| Metric                                               | Source                           | As-of          | Grain                          | Coverage                  |
| ---------------------------------------------------- | -------------------------------- | -------------- | ------------------------------ | ------------------------- |
| All_LTC identities (893)                             | NJDOH All_LTC.xlsx               | 2026-08-31     | licensed LTC identity          | ACQUIRED_CURRENT_SNAPSHOT |
| All_LTC 19 types                                     | same                             | 2026-08-31     | official type                  | ACQUIRED_CURRENT_SNAPSHOT |
| All_Acute identities (1,430)                         | NJDOH All_Acute.xlsx             | 2026-08-31     | licensed acute identity        | ACQUIRED_CURRENT_SNAPSHOT |
| All_Acute 26 types                                   | same                             | 2026-08-31     | official type                  | ACQUIRED_CURRENT_SNAPSHOT |
| HHA offices (39)                                     | All_Acute `NJ_HHA`               | 2026-08-31     | office location                | ACQUIRED_CURRENT_SNAPSHOT |
| Hospice Program (68)                                 | All_Acute `NJ_HOSPICE_PROGRAM`   | 2026-08-31     | program identity               | ACQUIRED_CURRENT_SNAPSHOT |
| Hospice Branch (27)                                  | All_Acute `NJ_HOSPICE_BRANCH`    | 2026-08-31     | branch identity                | ACQUIRED_CURRENT_SNAPSHOT |
| Hospice Inpatient (9)                                | All_Acute `NJ_HOSPICE_INPATIENT` | 2026-08-31     | inpatient identity             | ACQUIRED_CURRENT_SNAPSHOT |
| County location table (21 counties)                  | All_LTC + All_Acute              | 2026-08-31     | physical location              | ACQUIRED_CURRENT_SNAPSHOT |
| Staffing populated quarters (30)                     | NJDOH staffing HTML              | 2026 Q2 latest | residents per one staff member | ACQUIRED_PARTIAL_HISTORY  |
| Enforcement indexed occurrences (1,146)              | NJDOH enforcement corpus         | 2026-09-02     | document occurrence            | ACQUIRED_PARTIAL_HISTORY  |
| Medicaid listed rate rows (236)                      | NJMMIS SFY 2026 PDF              | 2025-07-01     | printed schedule row           | PARTIAL_SOURCE_COVERAGE   |
| PACE organizations (8) / operating (6) / awarded (2) | NJ DoAS                          | 2026-09-02     | organization / center          | ACQUIRED_CURRENT_SNAPSHOT |
| CMS NJ NH / HHA / Hospice overlay (348 / 38 / 61)    | CMS national geography           | 2026-08-27     | CMS CCN                        | ACQUIRED_CURRENT_SNAPSHOT |

## NOT_PUBLIC / Unknown

| Metric                                   | Treatment                                                   |
| ---------------------------------------- | ----------------------------------------------------------- |
| CCRC Certificate of Authority roster     | Unknown / SOURCE_AVAILABLE_BY_REQUEST. Not zero.            |
| Home Health / Hospice service areas      | SOURCE_ACCESS_BLOCKED. Office county is not a service area. |
| CMS Home Health ↔ NJDOH crosswalk       | partial coverage / unavailable identity linkage             |
| CMS Hospice ↔ NJDOH crosswalk           | partial coverage / unavailable identity linkage             |
| Medicaid name-only identity matching     | withheld from profiles                                      |
| Unresolved / review-required enforcement | withheld from profiles                                      |
| Combined senior-provider total           | not a metric                                                |
| Trust Score / ranking                    | never public                                                |
