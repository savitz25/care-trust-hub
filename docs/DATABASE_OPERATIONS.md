# Database operations

PostgreSQL/PostGIS is optional for web and file-validation work. A managed PostgreSQL service such as Supabase may be used as a development/staging database, but it is only a database host: do not add browser SDKs, authentication, or public credentials for ingestion work.

## Connection and secrets

The ingestion CLI reads the server-side connection string only from `CARE_DATABASE_URL` or the explicit `--database-url` option. Prefer the environment variable so credentials do not enter shell history. Never use a `NEXT_PUBLIC_` variable for database credentials.

The Next.js server read model uses the same canonical `CARE_DATABASE_URL` name. `CARE_DATABASE_SSL` defaults to `verify-full`; use `require` only for an encrypted managed pooler connection whose certificate chain cannot be validated in the runtime, and document that environment decision. `disable` is reserved for controlled local development.

Local `.env` and `.env.local` files are ignored. The CLI intentionally does not load them automatically; export `CARE_DATABASE_URL` into the process environment through the developer shell or an approved secret manager before running database commands. Never print the variable or commit an environment file.

## Migration-controlled schema

Apply committed migrations in numeric order. With `psql` available:

```sh
psql "$CARE_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_foundation.sql
psql "$CARE_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0002_cms_provider_information.sql
psql "$CARE_DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0003_provider_information_load.sql
```

Do not recreate or repair project tables manually in a provider dashboard. Migration failures require a reviewed corrective migration.

Before first load, confirm the core table counts are zero. Unexpected records must be reviewed; never truncate them automatically.

## Provider Information workflow

After download, validation, and normalization:

```sh
cd services/ingest
python -m care_ingest validate nursing-home-provider-information --release YYYY-MM-DD
python -m care_ingest ingest nursing-home-provider-information --release YYYY-MM-DD
python -m care_ingest report nursing-home-provider-information --release YYYY-MM-DD
python -m care_ingest load nursing-home-provider-information --release YYYY-MM-DD
```

Run the identical `load` command again to verify idempotency. It must return the prior successful ingest without changing providers, identifiers, releases, raw objects, or snapshots.

The loader stages validated rows with PostgreSQL `COPY`, then resolves provider identities and inserts snapshots with set-based statements inside one transaction. Performance benchmarks must use an isolated database/schema and must never truncate the validated real-data schema.

## Private web inspection

For local mapping review, set `CARE_DATABASE_URL`, the reviewed TLS mode when needed, and `CARE_ENABLE_DEVELOPMENT_DATA=true`, then run `npm run dev`. Inspect `/development/providers`. The route is absent from navigation, noindex, limited, excludes raw records, and hard-fails with 404 in production.

## Verification and provenance

Use `db/queries/provider_information_verification.sql` with an explicit CCN to inspect:

- issuer-scoped identity;
- current and historical snapshots;
- source-record locator and preserved raw row;
- ingest run and transformation version;
- raw-object checksum and source release;
- official CMS source dataset;
- state and coordinate coverage.

Database integration tests use synthetic fixtures and destructive table cleanup. Run them only against the disposable CI PostGIS service—never against a database containing a real validated release.

# Regulatory releases

Apply `0004_inspection_deficiency_penalty.sql` and `0005_regulatory_load_stage.sql` in sequence. Load Inspection Dates before Health Deficiencies, then Penalties. Use `python -m care_ingest audit-regulatory` after loading. The operational stage is unlogged and contains no durable evidence; durable rows are inserted and marked successful in a final transaction. Never truncate the validated Provider Information baseline.

## PBJ staffing releases

Apply `0006_pbj_staffing.sql` after migrations 0001–0005. Download, validate, and normalize a fixed quarterly PBJ Daily Nurse Staffing CSV before database promotion. The PBJ loader uses bounded COPY staging and set-based inserts and summaries in a single transaction; an idempotent rerun must not create additional daily or summary rows. Run `python -m care_ingest audit-staffing` after loading and review unmatched CCNs, duplicates, invalid census/hours, incomplete quarters, lineage gaps, and detail/summary discrepancies.

Start with one current quarter and record download, normalization, COPY, insert, summary, total, and rerun durations. Review volume and pooler behavior before adding history; never launch a blind multi-quarter load. PBJ raw, normalized, rejected, report, and cache artifacts remain under ignored data storage and must not enter Git.
