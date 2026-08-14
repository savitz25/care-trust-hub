# Architecture

## Web

The Next.js App Router app is server-first. Route components fetch or orchestrate read models on the server; interactive islands are introduced only when interaction requires them. Brand metadata is centralized. Framework-neutral concepts live in `packages/domain`, while reusable accessible presentation belongs in `packages/ui`.

## Ingestion and database

The Python service owns acquisition, checksums, validation, normalization, and adapter execution. Pipelines will promote data only after validation and will be idempotent by release. PostgreSQL is the transactional and analytical source for normalized records; PostGIS supports geographic queries. The web app never parses bulk source files.

Source files will be archived immutably under a content-addressed object key. The foundation migration uses `source_dataset` to describe a source contract and `source_release` to record publication/retrieval and checksum. Later migrations will add `raw_object` pointers to exact archived bytes and `ingest_run` records for code/transformation versions and outcomes before real ingestion begins.

## Identity, evidence, and time

A stable internal provider UUID is separate from identifiers issued by CMS or states. `provider_identifier` includes issuer, type, value, and validity dates; aliases preserve prior names. Entity resolution proposes and audits links rather than overwriting identities.

An evidence assertion connects a normalized claim to its source release and source record locator, provider identifier, observation/effective dates, retrieval timestamp, and transformation version. Derived analysis references its supporting assertions and remains distinct from source facts.

Provider attributes are stored as effective-dated snapshots, not overwritten current rows. Corrections and facility responses are append-only companions to official records.

## Extension boundaries

State adapters implement a common acquisition/validation interface but retain jurisdiction-specific semantics. Florida AHCA assisted-living support will be the first such adapter after the national nursing-home product. A later ownership graph will represent organizations and time-bounded ownership edges without assuming names alone prove identity.
