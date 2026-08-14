# Engineering Constitution

## Project mission

Build an independent, high-trust care research and decision-intelligence platform in the Ask Trust Hub network. Help families investigate evidence and make decisions without being sold care. Internal product key: `care`. The public brand remains configurable.

## Trust principles

- The operating philosophy is exact and permanent: “We cite. You decide.” Facilities cannot pay for rank or organic placement.
- Never sell consumer contact information to facilities as leads.
- Keep editorial and commercial decisions independent and disclose material relationships.
- Do not create a black-box ranking or score without an explicitly approved, public methodology.

## Data integrity and provenance

- Never invent provider data, ratings, inspections, ownership, penalties, staffing, costs, or findings.
- Every material provider claim must trace to source organization, dataset, immutable release, source record, provider identifier where applicable, retrieval time, effective/observation date, and transformation version.
- Never silently remove provenance. Preserve immutable raw releases and historical snapshots.
- Keep official-source, facility-reported, and derived information explicitly distinguishable.
- Never overwrite an official-source record because a facility disputes it; record corrections and responses separately.

## Architecture boundaries

- `apps/web`: Next.js presentation and server-side orchestration; no ingestion logic.
- `services/ingest`: Python acquisition, validation, normalization, and adapter pipelines; no consumer UI.
- `packages/domain`: framework-neutral types and rules. `packages/ui`: accessible reusable presentation.
- `db`: reviewed PostgreSQL/PostGIS migrations and development-only seeds.
- Inspect existing architecture and working-tree changes before changing foundational patterns.

## Web development rules

- Use strict TypeScript, App Router, React Server Components by default, and minimal client state.
- Never hard-code the final public brand name. Read public identity and metadata from centralized brand configuration.
- Prefer accessible semantic HTML. Build mobile-first, with resilient layouts and calm, readable copy.
- Do not add auth, payments, tracking, or broad dependencies without a demonstrated need.

## Data engineering rules

- Treat downloads as immutable source releases; store checksums and retrieval metadata.
- Make ingestion idempotent, observable, restartable, and explicit about transformations.
- Validate before promotion. Quarantine invalid rows; do not silently coerce material values.
- CMS-certified nursing homes are the first national normalized type. Assisted living and memory care require state-specific regulatory adapters.
- Never mix facility-reported information with government-verified information without provenance labels.

## Accessibility and SEO

- Target WCAG 2.2 AA: keyboard operation, visible focus, semantic landmarks, labels, contrast, reduced-motion respect, and large touch targets.
- Render indexable public research server-side. Provide unique metadata, canonical URLs, structured headings, stable identifiers, and accurate structured data only when supported.
- Never generate thin location pages or misleading programmatic content.

## Testing requirements

- Run relevant format, lint, type, unit, accessibility-aware, and production-build checks before declaring work complete.
- Test domain rules and ingestion validation at boundaries. Add regression tests for defects.
- Tests must not depend on live government endpoints or fabricated claims presented as real.

## Security and privacy

- Collect the minimum data needed. Never commit secrets, production records, or sensitive family information.
- Validate untrusted input, parameterize database access, use least privilege, and avoid logging personal data.
- Treat uploaded contracts and family workspaces as sensitive by default.

## AI-generated explanations

- AI text may explain verified evidence but is never authoritative evidence.
- Link explanations to evidence, label generation where appropriate, avoid unsupported conclusions, and make uncertainty clear.
- Never let generated prose create or mutate a factual provider claim.

## What Codex must never do

- Invent provider facts or source details; guess dataset IDs or schemas; remove provenance.
- Build facility-paid ranking logic, lead-selling flows, dark patterns, fake urgency, or deceptive availability claims.
- Present a proprietary score without approval and transparent methodology.
- Treat AI output as evidence or merge disputed facility assertions into official records.
- Deploy, push, ingest production-scale data, or begin a later roadmap phase unless explicitly asked.

## Definition of done

Scope and trust rules are satisfied; provenance remains intact; UI is mobile-first and accessible; docs and migrations match behavior; no secrets or real provider claims are introduced; relevant checks pass; and status, limitations, and follow-up work are reported.
