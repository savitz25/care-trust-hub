# Delaware senior-care licensing audit (DE-SEN-001)

Checked and acquired: 2026-10-12. Source classes were audited before adding the Delaware route. Only statewide DHSS facility/service directories are in scope; CMS and local populations are excluded.

## Existing coverage

- No Delaware SeniorTrustHub route or DHSS source snapshot existed in the isolated worktree.
- The DHSS facility-class index exposes nursing homes, assisted living, adult day, home-health aides-only, skilled home health, hospice, and personal assistance services as separate directory classes. It does not expose a standalone residential-care roster in the reviewed facility index.
- Seven raw public HTML directory pages and class-specific summaries are retained under `data/delaware-sen-001/`.

## Observed class populations

| DHSS source class                     | Directory observations | Distinct license identifiers | Expiration-date observations at/before 2026-10-12 |
| ------------------------------------- | ---------------------: | ---------------------------: | ------------------------------------------------: |
| Nursing facilities                    |                     47 |                           47 |                   Not displayed in directory rows |
| Assisted living                       |                     38 |                           38 |                   Not displayed in directory rows |
| Adult day care                        |                     10 |                           10 |                                                 2 |
| Home health agencies – aides only     |                     13 |                           13 |                                                 4 |
| Home health agencies – skilled        |                     35 |                           35 |                          8 (34 of 35 show a date) |
| Hospice                               |                     13 |                           11 |                                                 0 |
| Personal assistance services agencies |                     91 |                           91 |                         20 (89 of 91 show a date) |

Hospice identifier `HSPC-010C` occurs on three directory entries. These entries were not collapsed. Expiration dates at or before the retrieval date are flags from the source page, not proof that the business stopped operating or that the state has not renewed a license. Conversely, the directory may not expose a renewal update. Current license validity for every entry remains NOT_RECONCILED. The script `scripts/summarize_de_sen_001.py` parses the preserved pages and writes class-specific observation counts; it intentionally produces no cross-class total.

## Official sources

- [DHSS facility-class index](https://dhss.delaware.gov/dhcq/index/)
- [Nursing homes](https://dhss.delaware.gov/dhcq/dhcq/licensed-nursing-homes/)
- [Assisted living](https://dhss.delaware.gov/dhcq/dhcq/licensed-assisted-living-facilities/)
- [Adult day care](https://dhss.delaware.gov/dhcq/dhcq/adult-day-care-centers/)
- [Home health agencies – aides only](https://dhss.delaware.gov/dhcq/dhcq/home-health-agencies-aides-only/)
- [Home health agencies – skilled](https://dhss.delaware.gov/dhcq/dhcq/home-health-agencies-skilled/)
- [Hospice](https://dhss.delaware.gov/dhcq/dhcq/hospice-providers/)
- [Personal assistance services agencies](https://dhss.delaware.gov/dhcq/dhcq/personal-assistance-services-agencies/)

Current facility administrators, inspection findings, enforcement orders, and CMS facility records were not acquired. A survey or inspection is not treated as an enforcement finding; facility and administrator populations remain distinct.
