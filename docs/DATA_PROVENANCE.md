# Data provenance

Every material evidence item must be reproducible through this chain:

`evidence assertion → normalized entity/observation → source record locator → immutable source release → source dataset → source organization`

Required fields include source organization and dataset; release identifier and source publication date when supplied; raw-object checksum and record locator; retrieval timestamp; effective/observation date; provider identifier where applicable; ingest run; transformation name and version; and assertion creation time.

Source dates must not be substituted for retrieval dates. Missing dates are explicit unknowns. Transformations are versioned and reruns produce new lineage, not rewritten history. Official, facility-reported, and derived assertions carry distinct origin types. Consumer pages should show a concise citation near claims and expose detailed lineage on demand.
