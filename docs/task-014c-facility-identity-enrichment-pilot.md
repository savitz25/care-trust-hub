# Executive Summary

SeniorTrustHub completed a deterministic adversarial identity pilot over exactly **200 canonical CMS facilities**. The pilot made **391 real Google Places requests**—200 discovery and 191 details—with no retries and no request outside the persisted cohort. After an independent second pass over every automatic VERIFIED result, 120 facilities remain VERIFIED and 80 remain REVIEW_REQUIRED. No pilot-derived claim is publication eligible or connected to consumer reads.

Measured VERIFIED Place ID, address, and exact-phone precision is 100% in the audited cohort; 64 website candidates were independently corroborated and six remain unverified. There were zero confirmed false positives and zero `CRITICAL_WRONG_FACILITY` VERIFIED matches. The resolver was appropriately cautious in 54 review cases but appears overly conservative in 26 additional cases. National enrichment should not begin until those conservative cases inform a versioned resolver update and bounded re-test.

Status: **READY FOR 014D WITH RESOLVER CHANGES**.

# Pilot Purpose

The experiment tested identity precision, ambiguity handling, request economics, resumability, provenance, review behavior, and publication isolation—not national coverage. CMS CCN remained canonical throughout.

# Cohort Selection Method

The cohort generator uses version `FACILITY_IDENTITY_PILOT_2026_08_V1`, stable SHA-256 ranking over CCN/stratum, fixed quotas, and a final deterministic manifest order. Both the zero-call dry run and live pilot produced fingerprint `f3a6c67876146b865b0e2aed4958078175ca34ae908a10a9d587be48e29b72e2`.

The dry-run and live runs each persisted 200 manifest rows containing CCN, canonical CMS name/address/state/ZIP/coordinates/phone, ownership/chain context, strata, region, and selection reason. Dry-run Google requests: 0.

# Cohort Difficulty Distribution

Primary selection quotas were met exactly:

| Primary selection group            | Count |
| ---------------------------------- | ----: |
| Straightforward independent        |    25 |
| Large national chain               |    25 |
| Regional chain                     |    20 |
| Common/generic name                |    25 |
| Similar name in same market        |    20 |
| Recent ownership/rename            |    20 |
| Hospital/campus associated         |    15 |
| Rural/sparse-web proxy             |    15 |
| Address/phone inconsistency proxy  |    15 |
| Business-status complication proxy |    10 |
| Deliberately difficult edge        |    10 |

Because strata overlap, the final manifest also contains 162 address/legal-name inconsistency proxies, 109 common/generic names, 85 regional-chain facilities, 75 business-status-risk proxies, 74 ownership-change cases, 61 independents, 48 large-chain facilities, 45 rural-market proxies, 33 same-market name collisions, 19 hospital/campus cases, and 14 deliberate edges.

# Geographic Distribution

The cohort spans **44 states** and all five target regions:

| Region    | Count |
| --------- | ----: |
| Southeast |    64 |
| Midwest   |    55 |
| West      |    32 |
| Northeast |    30 |
| Southwest |    19 |

Largest state counts were Texas 13, Florida 13, California 13, Ohio 12, Georgia 11, and Illinois 11. The selection includes major markets, suburbs, small cities, and low-facility-count markets.

# Google Request Strategy

Discovery used only Place ID, display name, formatted address, and location. Details were requested only for a plausible top discovery candidate and used display name, address, location, national phone, website URI, and business status. Reviews, ratings, photos, opening hours, and reputation data were not requested.

The live run had a hard ceiling of 450. Retry attempts now reserve budget individually. No deployment or background hook can start the job; the CLI requires an explicit persisted run ID.

# API Request Counts

| Metric                          | Result |
| ------------------------------- | -----: |
| Real Google requests            |    391 |
| Discovery                       |    200 |
| Details                         |    191 |
| Retries                         |      0 |
| Mean per facility               |  1.955 |
| Median/p50                      |      2 |
| p95                             |      2 |
| Maximum                         |      2 |
| Facilities with 0 real requests |      0 |
| Facilities with 1               |      9 |
| Facilities with 2               |    191 |
| Facilities with more than 2     |      0 |

No authoritative billing/SKU cost data was available to this job, so no dollar estimate is asserted.

# Cache Performance

The run produced 200 search and 191 details cache rows. Recovery and restart checks recorded 161 cache hits and no additional billed requests for completed/cached work, a measured operational hit share of 29.2% across all cache lookups during the failure/recovery sequence.

The five-entry restart probe exposed and preserved a JSONB serialization failure. The first ten requests remained counted. After correction, cached responses resumed persistence without new calls. A completed-run replay left `used_requests` unchanged at 391, skipped all 200 completed manifest entries, created no duplicate candidates, and retained the two rejected candidates.

# Resolution Results

Final facility-level results:

| State           | Count | Percent |
| --------------- | ----: | ------: |
| VERIFIED        |   120 |   60.0% |
| PROBABLE        |     0 |    0.0% |
| REVIEW_REQUIRED |    80 |   40.0% |
| UNRESOLVED      |     0 |    0.0% |

There are 227 persisted candidates: 120 VERIFIED, 105 REVIEW_REQUIRED, and two REJECTED. The rejected-candidate frequency is 0.88%. Three candidate-level VERIFIED states were downgraded because their facilities had competing plausible candidates.

# VERIFIED Audit Results

All **139** automatic VERIFIED facilities received a second pass that independently checked CMS/candidate name compatibility, street/location, state, ZIP/address evidence, phone, care-type conflicts, campus risk, business status, and competing candidates.

- `AUDIT_PASS`: 120
- `AUDIT_FAIL`: 0
- `AUDIT_REQUIRES_REVIEW`: 19
- Final measured VERIFIED precision: 120/120, **100%**
- Explainable VERIFIED decisions: 120/120, **100%**

The audit only retained or downgraded; it never promoted a review case.

# Place ID Precision

All 120 retained Place IDs passed the independent evidence audit. Three Place IDs appeared as candidates for more than one CMS facility; two were review-only across both facilities, and the third correctly represented one separately named building while the nearby facility remained REVIEW_REQUIRED. No shared candidate was used to auto-verify two facilities.

Measured retained Place ID precision: **100%**.

# Website Precision

- HTTPS website candidates across all candidate rows: 111
- Top-candidate HTTPS websites across the cohort: 107
- Websites attached to retained VERIFIED identities: 70
- Independently corroborated official facility/operator/system pages: 64
- Unverified/blocked/unavailable: 6
- Incorrect verified websites: 0
- Precision among verified websites: **100%**

Non-HTTPS values remain inside immutable source payload evidence but are not placed into typed website fields or claims. No website was published.

# Phone Precision

- Candidate rows containing phones: 190
- Top facility candidates containing phones: 183
- Retained VERIFIED identities containing phones: 120
- Exact normalized CMS/Google phone matches: 120
- Incorrect verified phones: 0
- Precision among verified phones: **100%**

Twenty-six review cases retained explicit phone conflicts. Google phones never overwrite CMS phones.

# False Positives

Confirmed false-positive VERIFIED identities: **0**. Overall measured false-positive rate: **0%**.

# Critical Wrong-Facility Errors

`CRITICAL_WRONG_FACILITY`: **0**.

The audit specifically checked same-market siblings, shared campuses, care-type conflicts, hospitals, corporate/campus substitutions, and shared Place IDs.

# False Negatives

All 80 final review cases received a separate conservative-case review:

- Appropriate REVIEW_REQUIRED: 54
- Likely valid but conservatively withheld: 26

The estimated false-negative/under-resolution share is therefore 26/200 (**13.0%**) of the full adversarial cohort, or 26/80 (**32.5%**) of review cases. These are not published as matches. Most need claim-type-specific handling of phone differences, legal/public-name differences, or campus context rather than a global threshold reduction.

# Review-Required Analysis

The production queue contains 80 pilot review items:

| Review type                          | Count |
| ------------------------------------ | ----: |
| Multiple-candidate/general ambiguity |    45 |
| Phone conflict                       |    22 |
| Address conflict                     |     8 |
| Authority/campus conflict            |     5 |

Each item includes canonical CMS facts, candidates, feature evidence, conflicts/reason codes, commercial source authority, resolver version, and timestamps.

# Unresolved Analysis

No facility finished UNRESOLVED and no discovery returned zero results. This is not evidence that national coverage will be complete: the query included a full CMS name and address, and the adversarial sample is too small to establish a national no-result rate.

# Failure/Conflict Taxonomy

Facility-level reason codes may overlap:

| Code                         | Count |
| ---------------------------- | ----: |
| `PHONE_CONFLICT`             |    26 |
| `INSUFFICIENT_EVIDENCE`      |    14 |
| `NAME_CONFLICT`              |    13 |
| `ADDRESS_CONFLICT`           |    11 |
| `CAMPUS_AMBIGUITY`           |    10 |
| `MULTIPLE_PLAUSIBLE_RESULTS` |     3 |
| `CARE_TYPE_CONFLICT`         |     2 |
| `NO_GOOGLE_RESULT`           |     0 |
| `POSSIBLE_CLOSURE`           |     0 |
| `API_ERROR` final            |     0 |

# Closure Conflicts

Google reported 192 candidate rows as operational and 35 without a business status. It reported zero `CLOSED_PERMANENTLY` candidates, so no Google/CMS closure authority conflict was created.

# Campus Ambiguities

Ten facilities received `CAMPUS_AMBIGUITY`. These remain reviewable rather than inheriting a hospital, system, or neighboring-building identity.

# Resolver Weaknesses

1. Twenty-six likely valid candidates remain withheld, showing that a single global confidence calculation is too coarse for alternate phone and campus-name cases.
2. Initial cache persistence passed JavaScript arrays directly to JSONB; responses were cached only after explicit serialization. Request counters preserved the ten consumed probe calls.
3. Non-HTTPS Google websites violated the typed HTTPS constraint. They are now retained only in raw observation payloads while typed fields remain null.
4. Source observations initially carried a candidate facility association. Because three Place IDs were candidates for multiple facilities, 224 source-scoped superseding observations were appended and all candidates/identifiers were relinked. The original 226 observations remain immutable.
5. Candidate-level VERIFIED must be gated by facility-level competing-candidate analysis. Three such candidates were downgraded.
6. Only two clearly wrong secondary candidates met the current deterministic rejection rule; rejection coverage should be expanded carefully without turning ambiguity into rejection.

# Recommended Resolver Changes

Create resolver `facility-identity-pilot-v2` in Task 014D and re-test the 26 conservative cases plus all campus/shared-Place cases. Add claim-type-specific phone handling, explicit public-name/legal-name alias evidence, source-scoped Google observations by default, a non-HTTPS website classification, and a competing-candidate gate before any candidate can remain VERIFIED. Preserve v1 outcomes to avoid tuning away adversarial evidence.

# Estimated National Request Volume

For the approximately 14,493 facilities outside the pilot:

| Scenario                                         | Requests/facility | Estimated requests |
| ------------------------------------------------ | ----------------: | -----------------: |
| Conservative/lower with cache reuse              |              1.80 |             26,087 |
| Expected from pilot                              |             1.955 |             28,334 |
| Upper planning bound with modest retry allowance |              2.10 |             30,435 |

These are request-volume estimates, not authorization.

# Estimated National Resolution Distribution

Applying the adversarial pilot rates mechanically to 14,493 remaining facilities gives:

- VERIFIED: approximately 8,696
- PROBABLE: 0
- REVIEW_REQUIRED: approximately 5,797
- UNRESOLVED: 0
- Projected review queue: approximately 5,797

These estimates are uncertain because the cohort intentionally overweights difficult cases. No national requests were made.

# Data Integrity

Post-pilot production remains:

- canonical facilities: 14,693;
- unique CMS CCNs: 14,693;
- ownership evidence: 674,063;
- chain evidence: 10,231;
- staffing summaries: 57,873;
- CMS identity observations: 14,693;
- canonical CMS name claims: 14,693;
- Google-derived public claims: 0.

Pilot-specific records are two runs, 400 manifest rows (200 dry-run and 200 live), 450 Google observations including immutable original plus source-scoped superseding evidence, 120 verified external identifiers, 227 candidates, 80 review items, 344 resolution audit events, and 391 cache rows. Consumer code does not query these pilot records.

# Security

The Google key and database credentials remained server-only. Exact-secret scans found zero matches in database observations/cache, tracked files, and build output. Cache keys and request fingerprints are opaque and contain no request URL or credential. Production development routes remain inaccessible, and no public review/admin route was added.

# Test Results

Before the live pilot, `npm run check` passed with 73 web tests, 11 domain tests, strict TypeScript, ESLint, formatting, and the production build. Ruff format/check passed; Python reported 42 passed and eight isolated database tests skipped in the non-database run. Isolated PostGIS CI applied Migrations 0012 and 0013 and passed all eight database integration tests. Final post-pilot results are recorded with the concluding commit/CI run.

# Recommendation for Task 014D

**READY FOR 014D WITH RESOLVER CHANGES.**

The precision, critical-error, request-efficiency, explainability, publication-safety, and data-integrity gates passed. National enrichment should not proceed yet. Task 014D should implement resolver v2, re-run the bounded affected cases entirely from cache where possible, and confirm that the 26 likely-valid conservative cases improve without reducing the 100% audited precision or increasing shared-campus risk.
