# Database foundation

Migrations target PostgreSQL and are forward-only after release. PostGIS is enabled for eventual geographic queries. Task 001 establishes durable provider identity, immutable source releases, and effective-dated snapshots; later concepts are added only with verified data contracts.

Apply migrations with a future migration runner in filename order inside a transaction where supported. Seeds must be explicitly synthetic, safe to rerun, and never resemble a real provider. No database is needed to run the development page.

For optional local validation, `docker compose up -d postgres` starts PostgreSQL 16 with PostGIS. Apply `0001`, `0002`, then `0003` using `psql` as documented in the root README. File validation and normalization occur before transactional database promotion.

`queries/provider_information_verification.sql` demonstrates CCN lookup, current and historical snapshots, raw-row retrieval, release lineage, state grouping, and coordinate availability. It requires an explicit psql `ccn` variable and does not power consumer routes.
