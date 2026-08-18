# Task 014A — Environment & Connectivity Validation

Validated 2026-08-17. No secret values are included in this report.

## A. Executive Summary

**READY WITH MINOR ISSUES** for Facility Intelligence V2 design and controlled development. Do not begin national Google Places enrichment yet.

Production is live at `www.seniortrusthub.com`, its health endpoint reports the PostgreSQL database reachable with all approved public evidence flags enabled, and the public sitemap contains exactly 14,693 canonical CMS facility URLs. Read-only Supabase REST checks independently found 14,693 providers, facility snapshots, and unique CMS CCNs. One controlled Google Places Text Search (New) request succeeded.

Minor issues to carry into Task 014B planning:

- this checkout's ignored `apps/web/.env.local` contains only `VERCEL_OIDC_TOKEN`; the claimed local database and Places variables are not present there;
- Vercel Production and Preview have the required variables, but Sensitive Production values are intentionally not recoverable as plaintext through the CLI; runtime health and behavior were used to validate them;
- unresolved source-to-provider links exist (136 staffing summaries across 64 CCNs, 1,361 chain rows, and an estimated 111,977 ownership rows). These are preserved nullable resolution outcomes, not broken foreign keys, but should feed an explicit review queue;
- automated in-app browser QA could not run because no browser instance was connected. Direct HTTP production smoke tests passed.

No migration or database mutation was performed. No bulk Places enrichment was performed.

## B. Environment Matrix

Statuses describe names and scope only.

| Variable                              | Intended scope       | Local web | Vercel Preview        | Vercel Production | Repository use/status                                                        |
| ------------------------------------- | -------------------- | --------- | --------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `CARE_DATABASE_URL`                   | server-only          | missing   | present               | present           | required; active                                                             |
| `CARE_DATABASE_SSL`                   | server-only          | missing   | present               | present           | required; active                                                             |
| `CARE_DATABASE_SSL_CA`                | server-only          | missing   | missing               | missing           | optional for `verify-full`                                                   |
| `GOOGLE_PLACES_API_KEY`               | server-only          | missing   | present               | present           | required for controlled enrichment; adapter added                            |
| `SUPABASE_SERVICE_ROLE_KEY`           | server-only          | missing   | present               | present           | legacy but valid; currently unused by app runtime                            |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`       | intentionally public | missing   | present               | present           | legacy but valid; currently unused by app runtime                            |
| `NEXT_PUBLIC_SITE_URL`                | public origin        | missing   | present               | present           | active metadata fallback; production canonicals use locked production origin |
| `CARE_ENABLE_PUBLIC_LAUNCH`           | server-only          | missing   | intentionally missing | present/effective | active; Production-only gate                                                 |
| `CARE_ENABLE_REAL_PROVIDER_UI`        | server-only          | missing   | present               | present/effective | active                                                                       |
| `CARE_ENABLE_INSPECTION_INTELLIGENCE` | server-only          | missing   | present               | present/effective | active                                                                       |
| `CARE_ENABLE_STAFFING_INTELLIGENCE`   | server-only          | missing   | present               | present/effective | active                                                                       |
| `CARE_ENABLE_OWNERSHIP_INTELLIGENCE`  | server-only          | missing   | present               | present/effective | active                                                                       |
| `CARE_ENABLE_CHAIN_INTELLIGENCE`      | server-only          | missing   | present               | present/effective | active                                                                       |
| `CARE_ENABLE_TRUST_PARTICIPATION`     | server-only          | missing   | missing               | present/effective | active; Preview omission is a sensible fail-closed scope                     |
| `CARE_ENABLE_DEVELOPMENT_DATA`        | server-only          | missing   | missing               | missing           | optional development-only gate; correctly absent from Vercel                 |
| `ADMIN_SECRET`                        | server-only          | missing   | present               | present           | unused by this repository                                                    |
| `VERCEL_OIDC_TOKEN`                   | server-only          | present   | present               | present           | platform-managed                                                             |

Development scope contains only the platform OIDC token. Preview deliberately omits public launch and trust participation. Production contains all required runtime names. Feature flags remain `CARE_*`; no internal rename is recommended.

`.env`, `.env.*`, `.vercel`, and specifically `.env.local` are ignored. Only example files are tracked. Exact-current-secret scanning found no match in Git history, the production build, or client static bundles. No client static bundle contains either secret name. Historical scanning also found only documented/example database URL patterns, not the currently configured credentials.

## C. Supabase Validation

- Production `/api/health`: `200`, `status=ready`, `database=reachable`.
- Existing Node `pg` pool: global reuse, maximum 5 connections, 10-second connection timeout, 30-second idle timeout, explicit TLS modes, and stripped connection-string SSL parameters. This is compatible with the documented Supabase session-pooler/Vercel model and avoids a pool per request.
- Direct SQL from this checkout was unavailable because the CLI returns Sensitive Vercel values as non-plaintext references and the local web env lacks `CARE_DATABASE_URL`. No credential was guessed.
- Independent read-only Supabase REST validation succeeded using the configured server credential: 14,693 providers, 14,693 CMS CCNs, 14,693 facility snapshots, 149,705 inspections, 418,344 deficiencies, 16,166 penalties, 57,873 staffing quarter summaries, 674,063 ownership relationships, and 10,231 chain memberships.
- Representative production facility routes for CCNs `015019`, `015009`, and `015463` returned canonical pages with staffing, inspections, penalties, ownership, chain/source presentation, and neutral missing-data language.
- No migrations or writes were executed.

## D. Google Places Validation

- Implementation: server-only Places Text Search (New) adapter.
- Credential access: server-only, unprefixed, and guarded by `server-only`.
- Controlled external requests made: **1**.
- Result: HTTP 200, valid JSON, and a parseable Place ID.
- Request bounds: one result, `places.id` only, eight-second default timeout, HTTPS, no credential in URL or error text.
- Errors expose only HTTP status, not provider response bodies or credentials.
- The adapter follows Google's current [Text Search (New) request and field-mask guidance](https://developers.google.com/maps/documentation/places/web-service/text-search). No wildcard or billing-expensive enrichment fields are requested.
- The adapter is a future extension point; caching, quotas, retry policy, and persistence are intentionally deferred to 014B.

## E. Security Findings

- No `SUPABASE_SERVICE_ROLE_KEY` or `GOOGLE_PLACES_API_KEY` usage existed in client components, API responses, actions, logs, snapshots, docs, or tracked env files.
- No exact configured secret occurred in Git history or `.next`; no secret name or exact value occurred in `.next/static`.
- The new Places adapter is server-only and never returns or logs its key.
- The environment audit returns only variable name, scope, usage, and present/missing status.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is intentionally browser-public by naming convention but is currently unused. The service-role key remains unprefixed and server-only.
- Existing health output exposes boolean feature state and database reachability only, not configuration values.
- No exposure required remediation.

## F. Canonical Domain Findings

- Locked production origin: `https://www.seniortrusthub.com`.
- Apex `https://seniortrusthub.com/` redirects permanently to the `www` origin.
- Facility and chain pages emit correct `www.seniortrusthub.com` canonicals.
- Robots uses the same host and sitemap; the sitemap index and all sampled entries use that origin.
- Public branding is centralized as SeniorTrustHub. No rendered production page sampled contained CareTrustHub branding, localhost, a Vercel preview hostname, or an obsolete public domain.
- Homepage/core pages rely on `metadataBase` and do not emit explicit canonical link elements; sitemap URLs are correct. Adding explicit core-page canonicals is a low-priority SEO follow-up, not an enrichment blocker.

## G. Existing Architecture Relevant to Enrichment

- Next.js App Router is server-first. Server repositories provide bounded typed projections; interactive shortlist/search islands remain client-side.
- `services/ingest` owns immutable acquisition, checksum, validation, quarantine, normalization, and promotion. The web app contains no ingestion logic.
- `packages/domain` is framework-neutral; `packages/ui` contains reusable presentation.
- Provider identity is an internal UUID plus issuer/type/value rows. For CMS-certified nursing homes, issuer `CMS`, type `CCN`, and the six-character CCN remain canonical. Public routes use `/facility/cms/[ccn]/[slug]`; slugs are presentation only.
- Source datasets/releases, raw objects, ingest runs, record locators, observation/effective dates, checksums, and transformation versions preserve provenance. Official, facility-reported, and derived assertions remain distinct.
- Ownership uses organizations, organization identifiers, source parties, effective relationships, changes, and notices. CMS chain identity and membership are separate source-backed concepts.
- Current provider identifiers support new issuer-scoped identifiers, but no Google Place ID, state license ID, official website observation, or resolved-phone observation is modeled yet.
- Task 014B should extend identity observations instead of placing Google fields on the canonical CMS record or overwriting official snapshots.

## H. Data Integrity Spot Check

| Check                                             |                                                                                             Finding |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------: |
| Providers / CMS CCNs / facility snapshots         |                                                                            14,693 / 14,693 / 14,693 |
| Duplicate CCN values                              |                                                                                                   0 |
| Providers with multiple current CMS CCNs          |                                                                                                   0 |
| Providers without canonical CMS identity          |                                                          0 by one-to-one count and uniqueness check |
| Empty facility names                              |                                                                                                   0 |
| Missing state codes                               |                                                                                                   0 |
| Malformed/half-present coordinates                |                                                                                                   0 |
| Official evidence missing source release          |                                                                                                   0 |
| Official evidence missing source locator          |                                                                                                   0 |
| Inspection/deficiency/penalty FK orphans          |                                             0 structurally; non-null foreign keys enforce integrity |
| Staffing summaries without resolved provider      |                                                                          136 rows, 64 distinct CCNs |
| Chain memberships without resolved provider       |                                                                                          1,361 rows |
| Ownership relationships without resolved provider | approximately 111,977 planned-count estimate; exact count exceeded the managed REST statement limit |

Nullable unresolved ownership/chain/staffing rows retain source identifiers and provenance. They are resolution backlog, not fabricated matches. No silent repair was attempted.

## I. Test Results

| Command/check                          | Result                                                                                                                                                    |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run format:check`                 | pass                                                                                                                                                      |
| `npm run lint`                         | pass                                                                                                                                                      |
| `npm run typecheck`                    | pass                                                                                                                                                      |
| `npm run test`                         | pass: web 68/68, domain 5/5; 5 DB integration tests skipped because local `CARE_DATABASE_URL` is absent                                                   |
| `npm run build`                        | pass, Next.js 16.3.1 production build                                                                                                                     |
| `python -m pytest`                     | pass: 39; 7 PostgreSQL integration tests skipped because local `CARE_DATABASE_URL` is absent                                                              |
| `python -m ruff check services/ingest` | pass                                                                                                                                                      |
| Production HTTP route smoke checks     | pass: homepage, search, compare, shortlist, sources, health, robots, sitemap, three facilities, and one chain                                             |
| In-app browser QA                      | unavailable: no connected browser instance                                                                                                                |
| First combined `npm run check`         | failed before build because new tests initially lacked the repository-standard `server-only` mock; corrected and rerun successfully by component commands |

Shortlist and compare entry points return 200 and remain noindex. No state-changing trust request was submitted.

## J. Recommended Task 014B Architecture

Use an append-only, versioned resolution pipeline:

`CMS CCN → state regulator/license → operator/legal entity → ownership/chain → Google Place candidate → official website/phone → historical observations`

1. Keep `provider.id` plus CMS CCN authoritative. Add issuer-scoped external identifiers/observations with source, retrieved/effective times, release, transformation version, status, and validity interval.
2. Generate candidates deterministically from normalized name, address, phone, coordinates, state license, operator, and website signals. Never auto-match on name alone.
3. Version a public matching methodology. Use explicit confidence bands: auto-accept only high-confidence non-conflicting matches; queue ambiguous/multiple candidates; reject conflicts without mutating CMS identity.
4. Persist immutable request/response observations or policy-compliant normalized evidence with request field mask, API version, retrieval time, and transformation version. Maintain current projections separately.
5. Add a manual review queue with candidate evidence, reason codes, reviewer/audit history, and reversible decisions. Provider-submitted context remains separate.
6. Cache by normalized candidate fingerprint and Place ID; enforce per-run caps, budgets, concurrency limits, backoff, circuit breaking, daily quotas, and dry-run planning. Start with a tiny reviewed cohort.
7. Assign source-specific freshness windows. Refresh secondary attributes without overwriting prior observations; record tombstones/closures as new observations.
8. Resolve conflicts by published source authority per field: CMS/regulator for healthcare identity and regulatory facts; legal/operator sources for entities; official website for self-published contact; Google only for corroboration. Surface unresolved conflict rather than inventing a winner.
9. Promote only validated, versioned releases. Keep raw acquisition immutable, transformation releases reproducible, and consumer projections rollback-capable.
10. Before any national run, reconcile the unresolved ownership/chain/staffing identifiers and add exact indexed audit queries for resolution backlog counts.

## Database Credential Revalidation — 2026-08-17

The database credential reset and Vercel redeploy were acknowledged and validated without exposing the credential.

- **Local connectivity:** PASS. A read-only connection through the existing Node/PostgreSQL architecture succeeded with encrypted TLS using the documented managed-pooler `require` mode. The database contains 14,693 providers and 14,693 CMS CCNs.
- **Environment loading:** Next.js automatically loads `apps/web/.env.local`, but Vitest, plain Node, pytest, and the Python CLI do not automatically load `.env.local`. The updated credential is currently in the ignored `services/ingest/.env.local`, so local test commands require explicit environment injection. No automatic Python loading was added because its seven integration tests truncate core tables and must only receive an isolated test database URL. CI behavior remains explicit and unchanged.
- **Test setup change:** none. Preserving explicit injection is the safe behavior for destructive ingestion tests. Local developer documentation should continue to distinguish the web runtime env location from an explicitly exported isolated integration-test database URL.
- **Web database integration:** 5 executed, 5 passed, 0 failed, 0 skipped. The complete web suite passed 73/73 with the credential explicitly injected.
- **Python database integration (local):** 0 executed, 0 passed, 0 failed, 7 skipped because Docker/PostGIS is unavailable and the only configured URL is not an authorized destructive test target. The normal Python suite passed 39 tests and skipped those same 7 guarded integration tests. The existing CI migrations job provides an isolated PostGIS database and injects `CARE_DATABASE_URL` explicitly; its revalidation result is recorded in the task handoff.
- **Representative data:** the expected facility universe and CCN count were present, and CCN `015019` resolved related staffing, inspection, deficiency, and ownership evidence.
- **Production:** PASS. Homepage, search, a representative facility page, staffing/inspection content, and `/api/health` returned successfully; health reported the database reachable. No connection error or credential appeared in sampled responses.
- **Security:** `CARE_DATABASE_URL` remains server-only and untracked. `.env.local` is ignored at root and service/app scopes. Exact-value scans found no credential in tracked files or `.next` build artifacts.
- **Issue status before isolated CI rerun:** the credential rotation and web/database path are resolved. Final closure of the earlier Python skip is contingent on the safe isolated CI integration run, not on loading a production credential into destructive tests.
