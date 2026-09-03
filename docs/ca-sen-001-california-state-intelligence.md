# CA-SEN-001 — California senior-care state intelligence

Public route: `/california`

Contract: `senior-ca-state-intel-v1`

Snapshot: `artifacts/ca-sen-001-public-snapshot.json`

Acquisition: `scripts/build-ca-public-snapshot.py`

## Universes (not summed)

- CDPH ELMS locations: 15,097 rows as of 2026-08-17
- CCLD RCFE: 12,522 rows as of 2025-05-25 (7,939 LICENSED)
- HCAI listing: 10,871 rows as of 2026-09-01 (10,856 Open)
- CCLD Home Care Organizations: 3,654 rows as of 2025-05-25
- CMS overlay (national snapshot 2026-08-27): 1,165 NH / 3,213 HHA / 1,913 Hospice

Adult Residential (10,498) is researched-not-published.

## Rules

RCFE ≠ SNF. Home Care Organization ≠ Home Health. CDPH ≠ CMS. HCAI ≠ unique new provider.
LICENSED ≠ CMS certified. OPEN ≠ ACTIVE. Missing ≠ zero. No Trust Score. No county routes.
