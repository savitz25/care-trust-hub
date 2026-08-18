# Task 014D — National Facility Identity Enrichment

## Executive Summary

Frozen Resolver V2.2 processed all 14,393 eligible CMS facilities outside the prior pilot and holdout cohorts. The controlled run completed without a safety stop: sampled identity precision was 100%, no critical wrong-facility or field-contamination event was found, p95 Google usage was two requests per facility, and all Google-derived claims remained non-public.

Status: **READY FOR 014D.1 PUBLICATION REVIEW**.

## Canary Result

The deterministic 500-facility canary used 984 real Google requests (500 discovery and 484 details), with zero retries and p50/p95/max of 2/2/2. Frozen V2.2 produced 359 VERIFIED, 1 PROBABLE, 138 REVIEW_REQUIRED, 1 REJECTED, and 1 UNRESOLVED result. Twenty-two VERIFIED identities (2 high-risk and 20 deterministic-random) passed independent evidence audit. All 12 audited website claims and all 22 audited phone claims passed. Publication remained disabled, so the canary advanced automatically.

## National Run

- Scope: 14,393 eligible facilities; the existing 300 pilot/holdout facilities were skipped.
- Batches: 15 total — one 500 canary, thirteen 1,000-facility batches, and one 893-facility remainder.
- Resolver: `facility-identity-pilot-v2.2`, unchanged.
- Acquisition window: 2026-08-18 13:11:35 UTC through 15:44:09 UTC; final QA/orchestration completed at 15:47:52 UTC (approximately 2 hours 36 minutes).
- Coverage: 50 states plus DC, Guam, and Puerto Rico. Regional totals were Midwest 4,612; Southeast 3,742; Northeast 2,332; West 2,055; Southwest 1,642; and 10 territorial records classified as Other. Later batches naturally concentrated in regions with remaining eligible facilities.
- Resume safety: each acquisition and resolution batch used a persisted fingerprint and manifest; completed facilities were excluded from later manifests and cached requests were reused.

## API Usage

- Real requests: 28,362 of the 31,000 ceiling.
- Discovery: 14,393.
- Details: 13,969.
- Retries: 0.
- Cache hits: 34.
- Requests per facility p50/p95/max: 2/2/2.

Only approved identity/contact field masks were used. Reviews, photos, opening hours, review text, stars, and sentiment were not requested.

## Resolution Distribution

| State               | Facilities |
| ------------------- | ---------: |
| VERIFIED            |     10,103 |
| PROBABLE            |         36 |
| REVIEW_REQUIRED     |      4,216 |
| UNRESOLVED          |         13 |
| REJECTED candidates |         25 |

Claim-specific results included 13,780 VERIFIED physical addresses, 12,195 VERIFIED phones, 10,873 VERIFIED public names, 13,553 PROBABLE business-status observations, and 162 independently audited VERIFIED websites. A verified Place identity did not automatically verify its phone, website, or business status.

## QA / Audit Results

- VERIFIED identities audited: 323.
- High-risk audits: 23.
- Deterministic-random audits: 300.
- Audit failures: 0.
- Measured sampled identity precision: 100% (323/323).
- Critical wrong-facility errors: 0.
- Audited verified websites: 162/162 correct (100%).
- Audited verified phones: 294/294 correct (100%).
- Critical field contamination: 0.

These are sampled measurements and are not represented as a census-level guarantee.

## Review Queue

The 4,216 facility identity review cases remain persisted for later work. Primary reasons were:

- insufficient evidence: 2,271
- name conflict: 852
- address conflict: 389
- phone conflict: 273
- multiple plausible results: 172
- campus ambiguity: 144
- care-type conflict: 115

The separate Google-closure observation reason appeared in 24 cases but did not override CMS regulatory identity or status.

## Accuracy

All Task 014D safety gates passed: sampled identity precision exceeded 99%; audited website and phone precision exceeded 98%; p95 request use was two; no critical wrong-facility match, critical field contamination, systematic matching defect, retry storm, or uncontrolled duplication was observed.

## Data Integrity

- Canonical facilities: 14,693.
- Unique active CMS CCNs: 14,693.
- Canonical CMS identity was unchanged; no facility was merged or split.
- Publication-eligible Resolver V2.2 Google claims: 0.
- Google Place IDs, phones, websites, and business status remain internal to Facility Intelligence pending publication review.

## Issues

- The 4,216 REVIEW_REQUIRED cases intentionally remain unresolved; this is expected conservative behavior, not a reason to weaken the resolver.
- The first national execution exposed two mechanical persistence issues in the new batch tooling (an enum parameter cast and JSON `null` coercion). Both transactions rolled back, fixes were limited to persistence code, cached evidence prevented repeated Google calls, and resolver rules were not changed.
- Production batch execution depends on running from the repository environment that loads the server-only database configuration; the reporting helper follows the existing centralized local environment-loading convention.

## Validation

- Targeted frozen Resolver V2.2 domain suite: 16/16 passed.
- Google adapter/cache suite: 7/7 passed.
- `npm run check`: passed formatting, ESLint, TypeScript, 94 tests (73 web and 21 domain), and the production Next.js build. Five optional web database integration tests were skipped by the normal check process because it does not inject the production database URL; no destructive database suite was pointed at production.
- Final production aggregate: 14,393 national facilities resolved, 14,693 canonical facilities and unique CCNs intact, and zero publication-eligible Resolver V2.2 claims.

## Recommendation for Publication Phase

Proceed to **Task 014D.1 publication review**. That phase should define field-by-field publication policy and consumer provenance presentation before enabling any Google-derived claim. It should not auto-publish REVIEW_REQUIRED, PROBABLE, or UNRESOLVED data, and it should retain CMS CCN as canonical identity.
