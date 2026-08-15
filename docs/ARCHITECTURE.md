# Architecture

## Web

The Next.js App Router app is server-first. Route components fetch or orchestrate read models on the server; interactive islands are introduced only when interaction requires them. Brand metadata is centralized. Framework-neutral concepts live in `packages/domain`, while reusable accessible presentation belongs in `packages/ui`.

## Ingestion and database

The Python service owns acquisition, checksums, validation, normalization, and adapter execution. Pipelines will promote data only after validation and will be idempotent by release. PostgreSQL is the transactional and analytical source for normalized records; PostGIS supports geographic queries. The web app never parses bulk source files.

Source files are archived immutably under a release key with a content checksum. The foundation migration uses `source_dataset` to describe a source contract and `source_release` to record publication/retrieval and checksum. Task 003 adds `raw_object` pointers to exact archived bytes and `ingest_run` records for code/transformation versions and outcomes.

CMS source contracts are version-controlled JSON; release facts are runtime manifests. The standard-library downloader resolves only allowlisted `https://data.cms.gov` distributions, streams through a temporary file, computes SHA-256, and atomically finalizes the archive. Provider Information normalization produces ignored JSON Lines and reports; loading those records into PostgreSQL is a separate promotion boundary so validation can finish before database writes.

The Provider Information schema contract stops on missing identity/core columns and warns on additional columns. Raw rows remain intact beside selected normalized values. Rejected rows remain diagnostic artifacts. Consumer routes continue using synthetic fixtures until a later data-review approval.

The transactional loader resolves durable providers only through issuer-scoped CMS CCNs. Validated JSON Lines stream through PostgreSQL `COPY` into a transaction-local staging table; set-based statements resolve identities and insert identifiers and snapshots. It writes one snapshot per provider, source release, and transformation version. Composite foreign keys require every loaded snapshot's raw object and ingest run to belong to that same immutable release.

Real web reads cross a separate server-only repository boundary documented in `READ_MODEL.md`. It returns approved typed projections, never raw CMS JSON, and selects current data from successfully ingested source-release semantics rather than insertion time. Public consumer routes remain synthetic until separately approved.

The controlled consumer integration is selected only by the server-side `CARE_ENABLE_REAL_PROVIDER_UI` flag. With the flag off, Task 002 synthetic search, facility, and comparison experiences remain unchanged. With it on, real search and comparison use bounded repository queries and real detail routes resolve by CCN at `/facility/cms/[ccn]/[slug]`; name slugs are canonicalized but never used as identity. The static `cms` segment avoids conflicting with synthetic `/facility/[slug]` routes.

## Identity, evidence, and time

A stable internal provider UUID is separate from identifiers issued by CMS or states. `provider_identifier` includes issuer, type, value, and validity dates; aliases preserve prior names. Entity resolution proposes and audits links rather than overwriting identities.

An evidence assertion connects a normalized claim to its source release and source record locator, provider identifier, observation/effective dates, retrieval timestamp, and transformation version. Derived analysis references its supporting assertions and remains distinct from source facts.

Provider attributes are stored as effective-dated snapshots, not overwritten current rows. Corrections and facility responses are append-only companions to official records.

## Extension boundaries

State adapters implement a common acquisition/validation interface but retain jurisdiction-specific semantics. Florida AHCA assisted-living support will be the first such adapter after the national nursing-home product. A later ownership graph will represent organizations and time-bounded ownership edges without assuming names alone prove identity.

# Inspection-intelligence boundary

Migration 0004 adds explicit inspection, deficiency, and penalty concepts; migration 0005 adds a non-evidence operational load stage for reliable managed-pooler transport. Regulatory evidence remains separate from Provider Information snapshots. The server-only read model composes current successful source releases into a consumer-safe, bounded view behind an independent feature flag.

## Staffing-intelligence boundary

Migration 0006 adds PBJ daily facts and deterministic quarter summaries. Normalized PBJ rows move through bounded COPY staging, set-based CCN resolution, set-based inserts, and summary calculation in one transaction. Daily source facts, platform-derived HPRD measures, and CMS-published ratings remain separate concepts. The web reads only bounded server-side projections behind `CARE_ENABLE_STAFFING_INTELLIGENCE`; it never parses source files or exposes raw rows. See [STAFFING_INTELLIGENCE.md](./STAFFING_INTELLIGENCE.md).
