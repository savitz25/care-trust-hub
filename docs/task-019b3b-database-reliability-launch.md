# Task 019B.3B — Database reliability verification

Uses the 019B.3A web runtime: transaction-pooler preference, one `pg` client per Vercel instance, 4s connect / 5s idle, one retry for pool exhaustion.

## Preview

A CLI Preview deploy from this monorepo was not usable (Root Directory vs local cwd; a full-root upload is too large). Verification ran against the GitHub Production deploy of `90fa37b` after CI passed.

## Bounded concurrency

Mixed facility, search, and ownership URLs. No write routes. No Google enrichment.

| Stage | Concurrency | Requests | 200 | 5xx | EMAXCONNSESSION |   p50 |   p95 |
| ----- | ----------: | -------: | --: | --: | --------------: | ----: | ----: |
| A     |           2 |       20 |  20 |   0 |               0 | 270ms | 533ms |
| B     |           5 |       25 |  25 |   0 |               0 | 230ms | 347ms |
| C     |          10 |       30 |  30 |   0 |               0 | 299ms | 994ms |
| D     |          15 |       30 |  30 |   0 |               0 | 425ms | 917ms |

## Production smoke

Homepage, Navigator, Cost Planner, CA facility (license + history + ownership), NY facility, search, and organization portfolio all 200. Page composition for Redlands still shows CMS identity, CA license, Facility History, and ownership sources.

## Google

Google Places API requests: 0

## Remaining

A dedicated Preview URL was not exercised. Extreme crawl bursts can still stress Postgres; the session-pooler 15-client trap is no longer the default web path.
