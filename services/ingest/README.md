# Ingestion service

Python foundation for immutable acquisition, validation, normalization, and jurisdiction-specific adapters. It currently performs no network access and ingests no real data.

Adapters implement the protocol in `contracts.py`. A future runner will record source release, raw-object checksum, transformation version, and validation results before normalized records are promoted. Keep source-specific semantics inside adapters and domain normalization outside acquisition code.
