# Data provenance

Every material evidence item must be reproducible through this chain:

`evidence assertion → normalized entity/observation → source record locator → immutable source release → source dataset → source organization`

Required fields include source organization and dataset; release identifier and source publication date when supplied; raw-object checksum and record locator; retrieval timestamp; effective/observation date; provider identifier where applicable; ingest run; transformation name and version; and assertion creation time.

Source dates must not be substituted for retrieval dates. Missing dates are explicit unknowns. Transformations are versioned and reruns produce new lineage, not rewritten history. Official, facility-reported, and derived assertions carry distinct origin types. Consumer pages should show a concise citation near claims and expose detailed lineage on demand.

## Provider Information implementation

The local archive stores exact CMS bytes under `data/raw/cms/<dataset-key>/<source-modified-date>/`, beside a JSON manifest. The normalized JSON Lines record preserves the complete raw CSV row, normalized fields, CMS CCN identity, release checksum, retrieval timestamp, transformation version, and locator `csv-row:<physical-row>:ccn:<CCN>`. Physical row includes the header as row 1 and is deterministic for the archived bytes.

Rejected rows are written separately under `data/rejected/` with the raw row, physical row number, and reason. They are never counted as normalized providers. Multiple release directories coexist; no command replaces an earlier checksum for the same logical release.

Provider Information field and date semantics are defined in [PROVIDER_INFORMATION_FIELDS.md](./PROVIDER_INFORMATION_FIELDS.md). CMS source modification, publication, retrieval, and record observation dates are distinct and must never be collapsed into a generic `updated_at`.

# Regulatory lineage

Each inspection, deficiency, and penalty row directly references its provider, source release, raw object, ingest run, source-record locator, raw record, and transformation version. Ambiguous deficiency-to-inspection relationships remain null without losing the deficiency's independent lineage.
