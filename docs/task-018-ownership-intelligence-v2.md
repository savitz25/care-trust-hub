# Task 018 — Ownership Intelligence V2

Makes existing CMS ownership, chain, and CA/NY/TX state licensee/operator evidence easier to read. No Secretary of State scrape. No ultimate-beneficial-owner database. No portfolio score.

## Consumer model

Facility pages can add **Ownership & Operation** above the existing CMS party list:

- facility operator (state, when VERIFIED)
- state licensee (when VERIFIED)
- management company (when VERIFIED and distinct)
- CMS ownership type
- connected organization / individual counts
- chain / common-control group
- recorded ownership changes

Empty categories are omitted. Operator, licensee, owner, manager, and chain stay separate.

**Who is behind this facility?** lists only evidence that exists. Individual owners stay a count, not profiles.

## Related facilities and portfolio metrics

If a CMS `organization_id` connects at least **3** current facilities, the page shows:

- related facilities (name, city/state, CMS overall and staffing ratings, penalty indicator, relationship type)
- rating averages only from valid 1–5 values, with sample size
- a 1–5 star distribution
- facilities with CMS monetary penalties and total recorded fines
- average RN / total nurse HPRD when at least 3 valid observations exist

Missing ratings are never treated as 0. Related facilities are listed alphabetically, not ranked.

## Entity resolution

Organizations are connected only through existing CMS `organization_id`. `ABC Healthcare LLC` and `ABC Healthcare, L.L.C.` are treated as compatible labels. `ABC Healthcare` and `ABC Health Holdings` are not collapsed.

## Kill switch

`CARE_ENABLE_OWNERSHIP_INTELLIGENCE_V2=true` plus the existing ownership and real-provider flags. Disabling V2 leaves the original ownership section in place.

## Next

Use later work only if a specific organization still cannot be explained from this CMS + state evidence. Do not start a national corporate-records project from here.
