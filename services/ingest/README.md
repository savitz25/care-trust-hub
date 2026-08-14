# Ingestion service

Python service for immutable acquisition, validation, normalization, and transactional promotion. Live network access occurs only when a developer explicitly runs an enabled download command; routine tests remain offline and synthetic.

Adapters implement the protocol in `contracts.py`. Promotion records source release, raw-object checksum, transformation version, and validation results. Keep source-specific semantics inside adapters and domain normalization outside acquisition code.

`python -m care_ingest --help` exposes the CLI. Only `nursing-home-provider-information` is enabled. Downloads are restricted to official CMS HTTPS hosts, archived immutably, and normalized to ignored JSON Lines with raw rows and provenance intact. Unit tests use small synthetic CSV fixtures and never require network access.

After migrations are applied, set `CARE_DATABASE_URL` and run `python -m care_ingest load nursing-home-provider-information --release YYYY-MM-DD`. The load is transactional and idempotent. `report` creates descriptive data-quality output; `summarize` returns ingest counts.
