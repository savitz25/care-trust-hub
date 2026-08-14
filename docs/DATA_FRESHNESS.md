# Data freshness policy

Freshness dates describe different events and must remain separate.

- **CMS source updated**: `source_release.source_modified_at`, derived from verified CMS source metadata. This is the preferred concise consumer date.
- **CMS published**: `source_published_at` only when CMS explicitly supplies a publication date. It is not inferred.
- **Source period/release date**: the period or dated release identity represented by the archived distribution.
- **Retrieved**: when the immutable source bytes were obtained by this platform.
- **Ingest completed**: when a transformation successfully committed. This is operational metadata, not CMS freshness.
- **Observed/effective**: record-level dates only when the source explicitly provides their semantics. Neither is invented from another date.

Avoid an ambiguous “Last updated.” Consumer surfaces should use centralized formatting such as “CMS source updated July 29, 2026,” with expandable details showing retrieval separately. If the source-modified date is absent, say it is not documented by CMS; do not substitute retrieval time.

The canonical formatter is `apps/web/src/server/care/freshness.ts`. Missing facts remain `null`; presentation language must not imply why CMS did not report a value.
