# Database foundation

Migrations target PostgreSQL and are forward-only after release. PostGIS is enabled for eventual geographic queries. Task 001 establishes durable provider identity, immutable source releases, and effective-dated snapshots; later concepts are added only with verified data contracts.

Apply migrations with a future migration runner in filename order inside a transaction where supported. Seeds must be explicitly synthetic, safe to rerun, and never resemble a real provider. No database is needed to run the development page.
