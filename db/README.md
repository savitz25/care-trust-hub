# Database foundation

Migrations target PostgreSQL and are forward-only after release. PostGIS is enabled for eventual geographic queries. Task 001 establishes durable provider identity, immutable source releases, and effective-dated snapshots; later concepts are added only with verified data contracts.

Apply migrations with a future migration runner in filename order inside a transaction where supported. Seeds must be explicitly synthetic, safe to rerun, and never resemble a real provider. No database is needed to run the development page.

For optional local validation, `docker compose up -d postgres` starts PostgreSQL 16 with PostGIS. Apply `0001` then `0002` using `psql` as documented in the root README. The file-based ingestion pipeline deliberately validates and normalizes before any future database-promotion command.
