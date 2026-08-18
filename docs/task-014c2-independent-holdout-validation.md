# SeniorTrustHub Task 014C.2 — Independent Holdout Validation

## Decision

**READY FOR 014D.** Frozen Resolver `facility-identity-pilot-v2.2` passed every holdout safety gate on 100 previously unseen CMS facilities. National enrichment was not started.

## Cohort

The deterministic manifest `FACILITY_IDENTITY_HOLDOUT_2026_08_V1` contains exactly 100 unique CCNs excluded from the original 200-facility pilot. Its fingerprint is `ab1984ff01960e5c6a6b398241c45e7f07da49034d4774f4b211d9981fefef47`.

- Representative: 60
- Difficult: 30
- Extreme edge: 10
- States: 36
- Regions: Northeast 24, Southeast 27, Midwest 31, Southwest 7, West 11

## Google Usage

- Real requests: 198
- Discovery: 100
- Details: 98
- Retries: 0
- Cache hits during first unseen acquisition: 0
- Facilities with one request: 2
- Facilities with two requests: 98
- p50/p95/maximum: 2/2/2
- Hard ceiling: 210; not reached

No reviews, photos, hours, review text, sentiment, or unrelated Places fields were requested.

## Resolution

- `VERIFIED`: 70
- `PROBABLE`: 0
- `REVIEW_REQUIRED`: 30
- `UNRESOLVED`: 0
- `REJECTED` candidates: 0

Every verified decision retained reconstructable matching features and an explicit V2.2 rule path. All Google-derived claims remain publication-ineligible.

## Independent Audit and Accuracy

All 70 automatically verified identities passed a separate audit requiring compatible facility name, state, and physical location with no care-type, competing-candidate, shared-Place, rejected-candidate, or unaudited-campus gate.

- Identity precision: 70/70 (100%)
- Critical wrong-facility verified matches: 0
- Explainable verified decisions: 70/70 (100%)
- Independently corroborated website claims: 45/45 (100% measured precision); five website candidates were withheld
- Exact CMS-corresponding phone claims among verified identities: 65/65 (100% measured precision)
- Critical field contamination: 0

The website check was bounded to HTTPS candidates attached to verified identities. It required the returned site to independently corroborate the CMS phone or facility name plus location. A correct Place identity alone did not verify a website. Phone verification required exact normalized agreement with the CMS phone; disagreements remained withheld.

## Main Review Reasons

Primary, mutually exclusive reasons for the 30 review-required identities:

- `NAME_CONFLICT`: 9
- `INSUFFICIENT_EVIDENCE`: 8
- `PHONE_CONFLICT`: 5
- `CAMPUS_AMBIGUITY`: 3
- `MULTIPLE_PLAUSIBLE_RESULTS`: 3
- `ADDRESS_CONFLICT`: 1
- `CARE_TYPE_CONFLICT`: 1

No resolver rule or threshold was changed after observing these results.

## Data Safety

- Canonical facilities: 14,693
- Unique current CMS CCNs: 14,693
- Canonical CMS identity changed: no
- Canonical merge or split: none
- Publication-eligible V2/holdout Google claims: 0

## National Projection

For approximately 14,393 remaining facilities, observed request behavior projects approximately 28,500 Google requests. At the holdout's 70% verified rate, the simple expected result is approximately 10,075 verified and 4,318 review-required/unresolved facilities. A practical sampling range is roughly 9,350–10,800 verified and 3,600–5,040 review-required/unresolved. These are estimates, not authorization beyond the separately controlled Task 014D run.

## Tests

- Targeted Resolver V2/claim tests: PASS — 16/16.
- Targeted Google adapter/cache tests: PASS — 7/7.
- `npm run check`: PASS on final run — formatting, ESLint, strict TypeScript, 73 web tests, 21 domain tests, and the production build. Five live-database web tests were intentionally skipped by the normal no-database suite.
- An earlier full-suite attempt recorded one unrelated five-second staffing-component test timeout under local load; its immediate isolated rerun passed 2/2, and the complete final `npm run check` then passed 73/73 web tests.

No migration was created, so isolated migration/PostGIS tests were not rerun. No destructive database test was pointed at production.

## Recommendation

Proceed to Task 014D as a controlled national enrichment job using the frozen V2.2 resolver, explicit global and per-run budgets, resumability, persistent caching, publication disabled by default, and ongoing sampled audit. The holdout met all stated precision, contamination, explainability, and request-efficiency gates. Do not treat this report itself as authorization to start the run automatically.
