# Ingestion service

Python foundation for immutable acquisition, validation, normalization, and jurisdiction-specific adapters. It currently performs no network access and ingests no real data.

Adapters implement the protocol in `contracts.py`. A future runner will record source release, raw-object checksum, transformation version, and validation results before normalized records are promoted. Keep source-specific semantics inside adapters and domain normalization outside acquisition code.

`python -m care_ingest --help` exposes the dependency-free CLI. Only `nursing-home-provider-information` is enabled. Downloads are restricted to official CMS HTTPS hosts, archived immutably, and normalized to ignored JSON Lines with raw rows and provenance intact. Unit tests use small synthetic CSV fixtures and never require network access.
