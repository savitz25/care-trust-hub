# NJ-SEN-005 — New Jersey state intelligence publication

Public route: `/new-jersey` (`index,follow`, canonical `https://www.seniortrusthub.com/new-jersey`).

Deterministic snapshot:

- `artifacts/nj-sen-005-public-snapshot.json`
- `packages/domain/src/nj-public-snapshot.ts`
- fingerprint `92e0742f77f2f55a5ccd6217c5caa779f3281fd26b1d91c14e2df11ae144011a`
- generator `scripts/build-nj-public-snapshot.py` (reads official workbooks from the NJ-SEN-001 raw cache; raw xlsx/html/pdf are not committed)

## What is public

NJDOH All_LTC and All_Acute licensed identities, 21-county location intelligence, staffing residents-per-staff charts, NJDOH enforcement corpus summaries, NJMMIS listed assisted-living rates, PACE organizations/centers, CMS class overlays, source catalog, and explicit coverage gaps.

## What is not inferred

- All_LTC + All_Acute + CMS is not one senior-provider denominator
- HHA office ≠ service area
- Hospice Program ≠ Branch ≠ Inpatient
- Hospice Branch does not inherit a CCN
- listed Medicaid rate ≠ participation or quality
- PACE operating ≠ awarded; organization ≠ center
- missing CCRC roster ≠ zero CCRCs
- unresolved enforcement ≠ facility adverse history
- absence of attached action ≠ clean history

## Profile modules

`NjProfileEvidenceModule` is wired on Nursing Home, Home Health, and Hospice profiles. It renders only exact or approved deterministic identity joins. This snapshot has zero attachments because production DB joins are not available. Unresolved enforcement is withheld. There is no “Verified by New Jersey” badge.

## Non-blockers

No production DB execute, incomplete CMS HHA/Hospice crosswalks, incomplete Medicaid identity matching, missing CCRC roster, missing service areas, and unresolved enforcement identity do not block `/new-jersey`.

## Recommended next ticket

NJ-SEN-006 — CCRC, Medicaid identity, service-area and CMS crosswalk enrichment when official source data arrives.
