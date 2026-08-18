# Vercel web preview deployment

## SeniorTrustHub launch model

`main` is the Vercel Production branch and deploys automatically. `preview-real-data` remains the stable real-data Preview branch. Random and stable Preview URLs must remain `noindex, nofollow`.

Public canonical/index behavior requires both `VERCEL_ENV=production` and the server-only `CARE_ENABLE_PUBLIC_LAUNCH=true`. Without that explicit gate, robots disallow crawling, sitemap routes return 404, and no `www.seniortrusthub.com` canonical is emitted. The apex and stable Production Vercel alias redirect to `https://www.seniortrusthub.com` only after the gate is active; random Preview URLs never redirect.

Production V1 server flags are:

- `CARE_ENABLE_REAL_PROVIDER_UI=true`
- `CARE_ENABLE_INSPECTION_INTELLIGENCE=true`
- `CARE_ENABLE_STAFFING_INTELLIGENCE=true`
- `CARE_ENABLE_OWNERSHIP_INTELLIGENCE=true`
- `CARE_ENABLE_CHAIN_INTELLIGENCE=true`
- `CARE_ENABLE_TRUST_PARTICIPATION=true`
- `CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE=true`
- `CARE_ENABLE_FACILITY_HISTORY=true`
- `CARE_ENABLE_PUBLIC_LAUNCH=true` (set last)
- `CARE_DATABASE_SSL=require`

All evidence flags default false. Staffing, ownership, chain, and trust participation explicitly require real-provider UI in their feature helpers. No `CARE_ENABLE_*` variable is `NEXT_PUBLIC_` or exposed to browser code. `CARE_ENABLE_DEVELOPMENT_DATA` must remain unset in Preview and Production.

The canonical Production origin is `https://www.seniortrusthub.com`. Do not set Preview canonical configuration to that origin.

Deployment is not a production launch approval. The first Vercel deployment is a private Preview of `apps/web`; `services/ingest` remains an independently operated Python service and must not be packaged or deployed with the web application.

## Architecture

```text
GitHub monorepo
  -> apps/web Vercel project
  -> Next.js Node.js runtime
  -> Supabase PostgreSQL/PostGIS session pooler
```

The web project consumes `packages/domain` and `packages/ui` through the repository's npm workspace. No Supabase browser SDK, authentication product, storage product, or service-role key is used.

## Exact Vercel project settings

Import `https://github.com/savitz25/care-trust-hub.git` as one Vercel project with these settings:

| Setting                                     | Value                                             |
| ------------------------------------------- | ------------------------------------------------- |
| Framework Preset                            | Next.js                                           |
| Root Directory                              | `apps/web`                                        |
| Include source files outside Root Directory | Enabled                                           |
| Install Command                             | `cd ../.. && npm install`                         |
| Build Command                               | `cd ../.. && npm run build --workspace=@care/web` |
| Output Directory                            | Leave unset; use the Next.js default `.next`      |
| Node.js Version                             | `22.x`                                            |

Selecting `apps/web` ensures this is a web-only project. Including files outside that directory is required for the root lockfile and shared workspace packages. The explicit root-relative install and build commands preserve npm workspace resolution without adding an orchestrator or `vercel.json`.

## Environment variables and scopes

All database values are server-only. Never create a `NEXT_PUBLIC_DATABASE_URL` or any `NEXT_PUBLIC_` version of the feature flags.

### Preview

Configure these for the **Preview** environment only:

- `CARE_DATABASE_URL`: the Supabase session-pooler PostgreSQL URL, stored as a Vercel Sensitive Environment Variable;
- `CARE_DATABASE_SSL=require`: encrypted TLS for the currently validated managed pooler connection;
- `CARE_ENABLE_REAL_PROVIDER_UI=true`: explicitly enables the approved CMS review experience;
- `CARE_ENABLE_DEVELOPMENT_DATA`: leave unset;
- `NEXT_PUBLIC_SITE_URL`: optional; use the stable preview origin only if one has been assigned.

### Production

- `CARE_DATABASE_URL`: may be configured server-side in preparation for launch, but is not sufficient to expose real UI;
- `CARE_DATABASE_SSL=require` for the validated pooler until a CA chain supporting `verify-full` is installed and tested;
- `CARE_ENABLE_REAL_PROVIDER_UI`: leave unset/false until explicit launch approval;
- `CARE_ENABLE_DEVELOPMENT_DATA`: leave unset;
- `NEXT_PUBLIC_SITE_URL`: set only when a production canonical origin is approved.

Environment scoping in Vercel must keep the real-provider flag in Preview only. Do not promote Preview variables to Production when promoting or redeploying a build.

## Database connection and TLS

Use the Supabase session-pooler connection rather than a direct database connection for serverless preview traffic. The application keeps one process-global `pg` pool per warm Node.js function instance, capped at five connections, with bounded connection and idle timeouts. This is reasonable for controlled preview traffic, but database connection usage must be monitored before a public launch because Vercel can run multiple concurrent instances.

`CARE_DATABASE_SSL=require` keeps transport encrypted and matches the connection mode validated locally. `verify-full` is preferable once the runtime has the required trusted CA chain; test it in Preview before changing Production. Never use `disable` on Vercel.

## Exposure controls

- `CARE_ENABLE_REAL_PROVIDER_UI` is exact-match opt-in and defaults false.
- `CARE_ENABLE_DEVELOPMENT_DATA` defaults false, and development routes also require `NODE_ENV !== "production"`; therefore they return 404 on Vercel even if accidentally configured.
- Database and repository modules import `server-only`.
- Public/domain types exclude raw CMS records and credentials.
- The prototype retains global `noindex` metadata. Do not add a sitemap, programmatic facility index, or search-engine submission during Preview.

## Preview deployment steps

1. Import the GitHub repository in the Vercel dashboard.
2. Apply the exact project settings above and verify **Include source files outside Root Directory** is enabled.
3. Add the Preview-scoped sensitive variables. Do not paste credentials into build settings, source files, or logs.
4. Confirm the Production scope does not contain `CARE_ENABLE_REAL_PROVIDER_UI=true` or `CARE_ENABLE_DEVELOPMENT_DATA=true`.
5. Create a Preview deployment from the approved commit or a review branch. Do not select **Deploy to Production**.
6. Run the smoke-test checklist below and inspect function/database connection logs without logging connection strings.

## Preview smoke-test checklist

- `/`: homepage renders and retains the prototype trust language.
- `/search?search=1&state=AL&overall=5`: real CMS search is bounded and neutrally ordered unless the CMS sort was explicitly selected.
- `/facility/cms/015009/burns-nursing-home-inc`: numeric CCN route renders.
- `/facility/cms/01A193/father-purcell-memorial-exceptional-children-s-ctr`: alphanumeric CCN survives routing and lookup.
- `/facility/cms/015463/knollwood-healthcare`: missing ratings use the approved neutral language.
- `/compare?real=015009,01A193,105001`: comparison shows only approved Provider Information fields and declares no winner.
- A stale slug for a valid CCN redirects to its canonical slug.
- An unknown CCN returns 404.
- `/development/providers` and `/development/providers/015009` return 404.
- Page source/RSC responses contain no database connection string, password, raw CMS JSON, or unrestricted ingest metadata.
- Source details show actual CMS source and retrieval dates without prominently displaying the source-record locator.
- Search, detail, compare, and source disclosures remain usable at 375, 390, and 430 CSS pixels.
- A controlled invalid-database test fails safely without rendering credentials or raw connection errors to consumers; restore the valid Preview secret immediately afterward.
- A Production-scope deployment with the real-provider flag unset retains synthetic mode and does not expose real CMS routes.

Official Vercel references: [Using Monorepos](https://vercel.com/docs/monorepos), [Monorepos FAQ](https://vercel.com/docs/monorepos/monorepo-faq), and [Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
