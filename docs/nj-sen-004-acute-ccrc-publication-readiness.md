# NJ-SEN-004 — All_Acute, Home Health, Hospice, CCRC, identity bridges

Official All_Acute workbook: https://healthapps.nj.gov/facilities/documents2/All_Acute.xlsx

Landing page: https://healthapps.nj.gov/facilities/acSearch.aspx

Do not commit the workbook. Store it under the ignored `data/raw/nj-doh-acute/` tree.

```text
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --inspect-only
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --dry-run
python -m care_ingest ingest-nj-doh-acute --download --inspect-only
python -m care_ingest rematch-nj-doh-enforcement --ltc-xlsx data/raw/nj-doh-ltc/All_LTC.xlsx --acute-xlsx data/raw/nj-doh-acute/All_Acute.xlsx --dry-run
python -m care_ingest reconcile-nj-staffing-facids --output artifacts/nj-sen-004-staffing-facid-reconciliation.csv
python -m care_ingest discover-nj-ccrc --input data/raw/nj-ccrc/ccrc.shtml.html
python -m care_ingest nj-sen-004-snapshot --output artifacts/nj-sen-004-audited-state-snapshot.json
python -m care_ingest apply-migration 0035_state_service_area_regulated_org.sql --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --execute --database-url "$CARE_DATABASE_URL"
python -m care_ingest ingest-nj-doh-acute --input data/raw/nj-doh-acute/All_Acute.xlsx --execute --database-url "$CARE_DATABASE_URL"
```

First snapshot is baseline-only. `public_eligible` stays false. No `/new-jersey` page.

All_Acute identities use `dataset_key=nj-doh-all-acute` and do not overwrite All_LTC identities.

Home Health Agency, Hospice Care Program, Hospice Care Branch, and Hospice Care – Inpatient remain separate. Physical office county is `PHYSICAL_LOCATION`, not inferred service area.

The official search states that a Home Health Agency county search returns agencies physically located in the selected county. Counties served are on the facility listing, which is an ASP.NET POST search. Direct FacID GET URLs are not a public bulk API. Service-area coverage is `SOURCE_ACCESS_BLOCKED`.

CCRC is a DCA Certificate of Authority program, not an NJDOH facility type. The program page has no public roster. Coverage is `SOURCE_AVAILABLE_BY_REQUEST`.
