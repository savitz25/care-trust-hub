# NJ-SEN-COUNTY-001 — Four-county New Jersey senior-care publication

Public routes (`index,follow`, self-canonical):

- `/new-jersey/monmouth-county`
- `/new-jersey/middlesex-county`
- `/new-jersey/somerset-county`
- `/new-jersey/union-county`

Generator: `scripts/build-nj-county-snapshots.py`

Deterministic snapshots:

- `packages/domain/src/nj-county-public-snapshots.ts`
- `packages/domain/src/nj-county-public-snapshots/*.json`
- `artifacts/nj-sen-county-001/*.json`

Frozen NJ-SEN-005 fingerprint remains `92e0742f77f2f55a5ccd6217c5caa779f3281fd26b1d91c14e2df11ae144011a`.

## County fingerprints

- Monmouth `5c1dbcdea4bfa3f15dad4285d4b6cbecf745c12c06a016209460edc894446006`
- Middlesex `13225785ddd9fffa4299232d477e410a7c42ac1a1c897e84d3f004c46f2d369c`
- Somerset `6a1ad037274fa6990d50c2c7727a699185c4cfbccdda84639b47a18a2e491ac4`
- Union `72cb9792d6ad078639e36c27e5c4794197ec0c08ff4eee6e55251610854cb441`

## What is public

NJDOH All_LTC and All_Acute identities located in each county, official type breakdowns, the searchable state inventory filtered to that county, PACE centers whose published address county matches, and small county-resource fixtures (ADRC, senior centers, meals, Somerset Housing Options, Union Senior Home Improvement Grant).

## What is not inferred

- All_LTC + All_Acute + CMS is not one senior-provider denominator
- COUNTY RESOURCE ≠ LICENSED FACILITY
- PLANNING HOUSING INVENTORY ≠ NJDOH LICENSE
- CMS DIRECTORY ≠ NJDOH identity join
- Staffing is statewide NH context only; county aggregate omitted
- Enforcement exact county counts omitted without FacID assignment in this snapshot
- Medicaid listed rates are statewide; name-only rows are not county-assigned
- PACE operating ≠ awarded; organization ≠ center; center address ≠ service area
- Missing CCRC roster ≠ zero CCRCs
- Union grant terms are dated county program information, not guaranteed eligibility
- No municipality routes
- No rankings, Trust Scores, or “Verified by New Jersey” badge
