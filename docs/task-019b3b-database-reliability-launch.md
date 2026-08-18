# Task 019B.3B — Database reliability verification

## Connection architecture deployed

Web runtime from 019B.3A (`90fa37b`):

- Process-global `pg` Pool
- Prefer Supabase **transaction** pooler (rewrite `*.pooler.supabase.com:5432` → `6543` unless `CARE_DATABASE_POOL_MODE=session`)
- Per-instance `max=1` (hard cap 2)
- 4s connect timeout, 5s idle timeout, `allowExitOnIdle`
- One retry for `EMAXCONNSESSION` / connect timeout, logged as `DB_POOL_EXHAUSTED` or `DB_CONNECT_TIMEOUT`

Ingest/migrations may keep session or direct URLs.

## Preview test matrix

A CLI Preview deploy from this monorepo was not usable (Root Directory vs cwd; a full-root upload is huge). The same commit was verified on the GitHub Production deploy after CI passed.

Mixed facility, search, and ownership URLs. No write routes. No Google enrichment.

| Stage | Concurrency | Requests | Successes | 5xx | EMAXCONNSESSION | p50   | p95   |
| ----- | ----------: | -------: | --------: | --: | --------------: | ----- | ----- |
| A     |           2 |       20 |        20 |   0 |               0 | 270ms | 533ms |
| B     |           5 |       25 |        25 |   0 |               0 | 230ms | 347ms |
| C     |          10 |       30 |        30 |   0 |               0 | 299ms | 994ms |
| D     |          15 |       30 |        30 |   0 |               0 | 425ms | 917ms |

## Connection behavior

Not directly instrumented on Supabase. Behavior inferred from the client: one session per warm instance, idle release at 5s, no rising 5xx or `EMAXCONNSESSION` as concurrency went from 2 to 15. That is inconsistent with a leak that keeps opening dedicated session-pooler clients.

## Error results

**EMAXCONNSESSION: 0**

**database-related 5xx: 0**

## Production verification

- Deployment Ready (`90fa37b`)
- Smoke 200: homepage, Navigator, Cost Planner, CA facility (license + history + ownership), NY facility, search, organization portfolio
- Small concurrent validation included in the table above (stages A–B are the production-safe set; C–D stayed clean)

## Rollback

Not used. Restore previous session-pooler URL behavior with `CARE_DATABASE_POOL_MODE=session` and a redeploy, or promote the prior Vercel deployment.

## Remaining capacity

Transaction pooling multiplexes many requests onto fewer Postgres backends. Extreme crawls can still stress the database. Do not raise the Supabase plan on theory alone. A later capacity change should be based on measured backend saturation, not session-pooler client count.

## Google

Google Places API requests: 0
