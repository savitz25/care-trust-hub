# TH-ENRICH-B2-R1 source-count reconciliation

The immutable Texas workbooks acquired for B2 on 2026-09-30 each state **active-license directory as of 2026-09-28**. The worksheet's first row is a title and its second row is the column header. Every row from row 3 through the final worksheet row is nonblank and has a unique `Facility ID`.

| Official workbook | Worksheet dimensions | Title + header | Nonblank data rows | Unique Facility IDs | Blank data rows | Duplicate Facility IDs | Scout estimate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `ICFIID.xlsx` | 710 × 40 | 2 | 708 | 708 | 0 | 0 | ~709 |
| `DAHS.xlsx` | 391 × 40 | 2 | 389 | 389 | 0 | 0 | ~389 |
| `dahs_issonly.xlsx` | 746 × 40 | 2 | 744 | 744 | 0 | 0 | ~740 |

The current ICF/IID count is **708**, one below Scout's approximate 709. The current ISS-only count is **744**, four above Scout's approximate 740. The full worksheets account for every row; there is no parser omission, footer, hidden blank row, or duplicate native ID explaining a different count. Scout's observations were expressed as approximations and have no saved file checksum or as-of date in this packet, so **source drift cannot be proved or ruled out**. No parser change is warranted.

Other source details:

- ICF/IID has 54 blank license numbers but zero blank Facility IDs. A blank license does not erase the provider's Facility ID. The source has 56 `Facility Licensed=NO` rows despite its title; preserve the row field.
- DAHS has 341 `DAHS` and 48 `DAHS-ISS` program-type rows. ISS-only's separate file has 744 `DAHS-ISSONLY` rows. No Facility ID or nonblank license number repeats across the three files.
- All three staged Texas classes are distinct from the existing TX HHSC assisted-living and nursing-facility sources. Read-only production comparisons found **zero** exact Facility ID or license-number collisions against the 1,996 TX assisted-living rows, 1,175 distinct TX nursing-facility source IDs, and `STATE_TX` external license identifiers. No ICF/IID or DAHS source system exists in those production identity tables as of 2026-09-30 14:09 UTC.

The source hashes and retrieval timestamps remain those in `data/enrichment/th-enrich-b2/source-manifest.json`; no source version changed during R1.
