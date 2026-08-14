# Care intelligence platform foundation

Foundation for an independent Ask Trust Hub consumer research product. It is designed to explain sourced care-provider evidence—not sell placement or leads. This repository currently contains development scaffolding only and no real provider data.

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

## Structure

- `apps/web` — Next.js App Router web shell
- `packages/domain` — framework-neutral evidence and provider types
- `packages/ui` — shared accessible React components
- `services/ingest` — Python ingestion foundation
- `db` — PostgreSQL/PostGIS migrations and safe development seeds
- `docs` — product, architecture, data, editorial, and policy decisions

Copy scoped `.env.example` files to `.env.local` or the service-specific equivalent. Prefix browser-visible values with `NEXT_PUBLIC_`; secrets must remain server-only and uncommitted. Architectural decisions live in `docs/`; permanent engineering rules live in `AGENTS.md`.
