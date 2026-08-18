# Task 019B.3A — Database connection hardening

## Root cause

Production `EMAXCONNSESSION` came from the **Supabase session pooler** (about 15 dedicated clients). The web app already used a process-global `pg` Pool, but each Vercel instance allowed **5** idle/active sessions. Several warm instances times five dedicated session clients exhausted the pooler. Facility pages issue multiple sequential repository queries; some repositories also `Promise.all` two or three reads. That increases latency pressure, not a second independent pool.

## Previous architecture

- Library: `pg` `Pool`
- Singleton via `globalThis.careDatabasePool`
- `max: 5`, 10s connect, 30s idle
- Production URL: Supabase **session** pooler
- All web repositories share that one pool constructor
- Trust writes check out one client, `BEGIN`/`COMMIT`, and `release()` in `finally`

## Fix

- Detect session vs transaction vs direct from the URL shape (host/port only; no credentials logged)
- Default web mode `auto`: rewrite `*.pooler.supabase.com:5432` to **6543 transaction** pooling
- Optional `CARE_DATABASE_POOLER_URL` for an explicit transaction URL
- `CARE_DATABASE_POOL_MODE=session` restores the incoming URL
- Per-instance `max` defaults to **1** (hard cap 2)
- Idle timeout 5s, connect timeout 4s, `allowExitOnIdle`
- One bounded retry for `EMAXCONNSESSION` / connect-timeout, logged as `DB_POOL_EXHAUSTED` or `DB_CONNECT_TIMEOUT`

Facility `React.cache` wrappers already prevent duplicate canonical-facility reads in one request. No evidence-query semantics changed.

## Remaining risks

Transaction pooling rejects named prepared statements and session state. Current web SQL uses ordinary parameterized queries plus one explicit transaction on a checked-out client. Ingest/migrations should keep session or direct URLs.

019B.3B must prove Preview concurrency no longer yields `EMAXCONNSESSION`.
