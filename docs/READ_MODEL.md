# Provider read model

## Boundary

Consumer code may read real provider data only through `apps/web/src/server/care`. The repository imports `server-only`, uses parameterized SQL, and returns narrow domain objects. Route components must not query ingestion tables directly. The read model never returns `facility_snapshot.raw_record`, checksums, storage keys, database identifiers for releases/runs, or unrestricted ingest metadata.

Supabase is used only as managed PostgreSQL/PostGIS. The web app does not use Supabase Auth, Storage, Realtime, a browser SDK, anon-key access, or service-role access.

## Approved shapes

`CareProviderSummary` includes the exact CMS CCN, provider name, approved location fields, certified beds, and the four verified CMS rating dimensions. `CareProviderDetail` adds legal business name, telephone, ownership descriptor, participation fields, and `CareSourceDisclosure`. Internal provider UUIDs remain inside the repository.

The disclosure answers who published the fact, which dataset/release/record supplied it, the provider CCN, the official source URL, and distinct source-modified, published, retrieval, and ingest-completion dates. The source-record locator is allowed; raw JSON is not.

Null values stay `null` through the repository. Presentation may render a null as “Not available in this CMS release,” but must not invent a zero, one-star value, average, or reason for absence.

## Current snapshot rule

The current Provider Information release is the successful ingest for the configured dataset ordered by:

1. CMS source modified date, descending, with undocumented dates last;
2. CMS source release date;
3. stable release key;
4. ingest completion and transformation version only as tie-breakers within the same source release.

Only snapshots belonging to that selected successful ingest are current. Database insertion time alone never selects a release. `getProviderHistoryMetadata` separately returns every successful historical snapshot for a CCN.

## Intent-specific repository operations

- `getProviderByCcn` and `getProviderCurrentSnapshot`
- `getProviderHistoryMetadata`
- `getProvidersByState`
- `getProviderSourceDisclosure`
- `searchProvidersDevelopmentOnly` with name/CCN/state/city/ZIP filters and a 50-row hard ceiling
- `providersWithinRadius` with validated coordinates, a 250-mile ceiling, a 50-row ceiling, indexed PostGIS geography, and miles as the documented output unit

Do not replace these with a generic arbitrary-query function.

## Development inspection

`/development/providers` and `/development/providers/[ccn]` inspect approved real-data mappings. They have no public navigation, are `noindex`, require `CARE_ENABLE_DEVELOPMENT_DATA=true`, and return `notFound()` whenever `NODE_ENV=production`. They expose neither raw rows nor unrestricted SQL.

## Controlled consumer integration

`CARE_ENABLE_REAL_PROVIDER_UI=true` switches only approved Provider Information-backed consumer surfaces to the real read model. It is server-only, defaults off, and must never use a `NEXT_PUBLIC_` prefix. Synthetic fixtures remain the default and are never combined with real results.

Real provider URLs use `/facility/cms/[ccn]/[slug]`. The static `cms` segment keeps the route distinct from the synthetic Experience Lab's `/facility/[slug]` route. CCN is authoritative; the slug is presentation-only. A stale slug resolves by CCN and redirects to the current canonical name slug. Real search is limited to 25 records and real comparison to three providers.

The Node PostgreSQL pool is reused on `globalThis` within a warm runtime and capped at five connections per runtime instance. No pool is created per route component or per metric. Before deployment, confirm the aggregate instance-to-pool limit against the managed pooler capacity.
