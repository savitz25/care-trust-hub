# Care intelligence platform foundation

Foundation for an independent Ask Trust Hub consumer research product. It is designed to explain sourced care-provider evidence—not sell placement or leads. Real CMS data is confined to ignored local ingestion storage and is not exposed by the synthetic consumer prototype.

The final public product name is unresolved. The heading above is a development label; public identity is configured centrally in `apps/web/src/config/brand.ts` under the stable internal product key `care`.

## Prerequisites

- Node.js 22+ and npm 11+
- Python 3.12+ (for ingestion development)
- PostgreSQL 16+ with PostGIS when database work begins; it is not required for the prototype

## Get started

```sh
npm install
npm run dev
```

Open `http://localhost:3000`. Useful checks are `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

For ingestion work:

```sh
cd services/ingest
python -m venv .venv
# activate the environment, then:
python -m pip install -e ".[dev]"
ruff format --check .
ruff check .
pytest
```

### CMS Provider Information workflow

These commands use official CMS metadata and write only to ignored `data/` directories. No database is required to validate or normalize a release.

```sh
cd services/ingest
python -m care_ingest list-sources
python -m care_ingest inspect-source nursing-home-provider-information
python -m care_ingest download nursing-home-provider-information
python -m care_ingest validate nursing-home-provider-information --release YYYY-MM-DD
python -m care_ingest ingest nursing-home-provider-information --release YYYY-MM-DD
python -m care_ingest summarize nursing-home-provider-information --release YYYY-MM-DD
python -m care_ingest report nursing-home-provider-information --release YYYY-MM-DD
```

Set `CARE_DATA_ROOT` or pass `--data-root` to choose a different local archive. Never edit `data/raw/`; corrections belong in versioned transformations.

### Local PostgreSQL/PostGIS

Docker is optional for web and file-based ingestion work. If available:

```sh
docker compose up -d postgres
psql postgresql://care:care-local-only@localhost:5432/care -f db/migrations/0001_foundation.sql
psql postgresql://care:care-local-only@localhost:5432/care -f db/migrations/0002_cms_provider_information.sql
psql postgresql://care:care-local-only@localhost:5432/care -f db/migrations/0003_provider_information_load.sql
cd services/ingest
$env:CARE_DATABASE_URL = "postgresql://care:care-local-only@localhost:5432/care" # PowerShell
python -m care_ingest load nursing-home-provider-information --release YYYY-MM-DD
cd ../..
psql "$CARE_DATABASE_URL" -v ccn=015001 -f db/queries/provider_information_verification.sql
docker compose down
```

The database URL comes from `CARE_DATABASE_URL`; never commit credentials. Docker remains optional for web and file-only ingestion. The CI migration job applies every migration and runs synthetic database integration tests without contacting CMS.

## Structure

- `apps/web` — Next.js App Router web shell
- `packages/domain` — framework-neutral evidence and provider types
- `packages/ui` — shared accessible React components
- `services/ingest` — Python ingestion foundation
- `db` — PostgreSQL/PostGIS migrations and safe development seeds
- `docs` — product, architecture, data, editorial, and policy decisions

Managed PostgreSQL/Supabase connection, migration, load, secret-handling, and provenance-audit procedures are documented in `docs/DATABASE_OPERATIONS.md`.

Copy scoped `.env.example` files to `.env.local` or the service-specific equivalent. Prefix browser-visible values with `NEXT_PUBLIC_`; secrets must remain server-only and uncommitted. Architectural decisions live in `docs/`; permanent engineering rules live in `AGENTS.md`.
