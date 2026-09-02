# NJ-SEN-003 — staffing, Medicaid AL rates, and PACE

Three evidence families. Do not combine them. Do not publish `/new-jersey`.

```text
python -m care_ingest ingest-nj-nh-staffing --input data/raw/nj-doh-staffing/report_2026_Q1.html --identity-xlsx data/raw/nj-doh-ltc/All_LTC.xlsx --dry-run
python -m care_ingest ingest-nj-nh-staffing --download --year 2026 --quarter Q1 --dry-run
python -m care_ingest ingest-nj-assisted-living-rates --input data/raw/nj-medicaid-al/SFY_2026_Assisted_Living_Rates.pdf --dry-run
python -m care_ingest ingest-nj-pace --download --dry-run
python -m care_ingest apply-migration 0034_state_program_metrics.sql --database-url "$CARE_DATABASE_URL"
```

Staffing ratios are residents per one staff member (`1RN:#Res`). Not CMS PBJ. Not attached to ALR/CPCH/ALP/PACE.

Medicaid listed rates are reimbursement evidence as of the schedule date, not consumer prices. Default unlisted ALP/ALR/CPCH rates do not create participation.

PACE organizations, centers, counties, and ZIPs are separate. Awarded is not operating. East Brunswick and Plainfield/Union moved from in-development (2026-01-08) to operating on the current DoAS page; open date unknown.
