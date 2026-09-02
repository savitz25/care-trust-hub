# NJ-SEN-001 — NJDOH facility identity spine

Official bulk source: https://healthapps.nj.gov/facilities/documents2/All_LTC.xlsx

Do not commit the workbook. It is stored under the ignored `data/raw/` tree.

```text
python -m care_ingest ingest-nj-doh-ltc --input data/raw/nj-doh-ltc/All_LTC.xlsx --inspect-only
python -m care_ingest ingest-nj-doh-ltc --input data/raw/nj-doh-ltc/All_LTC.xlsx --dry-run
python -m care_ingest apply-migration 0032_nj_doh_facility_identity.sql --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-ltc --input data/raw/nj-doh-ltc/All_LTC.xlsx --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-ltc --input data/raw/nj-doh-ltc/All_LTC.xlsx --execute --database-url "$CARE_DATABASE_URL"
```

First snapshot is baseline-only. `public_eligible` stays false. No `/new-jersey` page.
Enforcement, SOD/POC, and penalty letters are NJ-SEN-002 (`ingest-nj-doh-enforcement`).
