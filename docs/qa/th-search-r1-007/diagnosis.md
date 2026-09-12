# TH-SEARCH-R1-007 — diagnosis and bounded source contract

Model: GPT-6 Astra / High, **USER-CONFIRMED**. The running model controls were not independently inspectable.

Fresh base: `eaff708dd7459c8ca24eca00c1ce0039100b5979`, `savitz25/care-trust-hub`. Production baseline: `dpl_671sc68ApSMqMHLna9D3XGuP2Wnq`, canonical `www.seniortrusthub.com`. The original checkout and unrelated worktrees were left untouched. No overlapping open Senior PR or visible active ticket assignment was found; absence of an open PR was not the sole ownership check.

## Reproduced causes

- `detectCity` only recognized three Florida cities. Austin retained Texas alone; Houston lost geography altogether. The former city-or-state contract could not express both predicates. The native page also appended filter prose and sliced the question while the API used a different input surface.
- Home Health/Hospice selected the latest row per CCN across snapshots, rather than selecting the latest succeeded dataset release first. Their scoped counts used a different path. The replacement uses the same parameterized cohort builder for list/count, with release selection before geography and pagination.
- Search cards parsed `Number(item.value[0])` from sentences beginning “Overall” or “Quality”. This produced NaN. Ratings now carry a source metric and validated numeric value independently of compatible presentation text.
- The desktop header put nine state links inline. Actual baseline bounding boxes and screenshot show Ask overlapping the real logo. The modal compact drawer initially focused its outside trigger. One shared published-state list and link disclosure replace the inline list; the compact native dialog contains focus and restores it on dismissal.

Baseline reproduction is in `before-production.json`, `before-austin-header-1280.png`, and `red-before-search.log`. Five initial geography tests failed before runtime changes. The initial UI gate had seven failing cases (invalid numeric values and missing By state disclosure) and one valid-rating control.

## Independent source oracle

`source-oracle.json` records read-only SQL, UTC retrieval, exact fields, release keys and content fingerprints. It does not call the production parser or executor. It selects the latest succeeded ingest for each dataset, then independently applies normalized city and exact state and counts distinct source CCNs.

| Class/source                      | Release / source date | Retrieved  | Grain / selected predicates              |                      Observed count |
| --------------------------------- | --------------------- | ---------- | ---------------------------------------- | ----------------------------------: |
| Nursing Home Provider Information | 2026-08-01            | 2026-08-26 | Current facility CCN; AUSTIN + TX        |                                  25 |
| Home Health Care Agencies         | 2026-05-27            | 2026-08-26 | Current agency CCN; HOUSTON + TX         |                                 260 |
| Nursing Home Provider Information | 2026-08-01            | 2026-08-26 | Current facility CCN; TAMPA + FL         |                                  18 |
| Hospice General Information       | 2026-08-19            | 2026-08-26 | Current hospice CCN; recorded city/state | Fixture and source-contract control |

These are observations of the fingerprinted corpus, not permanent expected production constants or counts of all real-world providers. Recorded address/office geography does not establish service territory, radius, availability, or care quality. Uppercase/trim normalization combines `Austin` and `AUSTIN`; no city/state dictionary special case was added.

The existing location-reference table supplies ZIP coordinates, not a national city gazetteer. City-only names therefore retain the city and request an explicit state. The previous Boca Raton/Miami golden cases now expect `NEEDS_CLARIFICATION`, with separate tests proving state selection completes the city/state plan. They are not classified as unsupported known-positive searches. Existing explicit Florida city and county controls remain supported. Published state-page navigation is separate from all-jurisdiction CMS search coverage.

## Execution and compatibility

`executeSeniorRequest` validates full input and typed overrides once, then delegates to the existing `executeSeniorResearchPlan`. Homepage/native/API share it; structured specialist requests validate into the same plan. City and state are independent bound SQL predicates applied before ordering, limits and counts. Overlong/duplicate/malformed parameters fail explicitly. A selected state can resolve a city-only question; it cannot silently replace an explicitly supplied compound state. Broadening requires the `broaden=state` user action and is recorded as `USER_APPROVED_RELAXATION`.

Nursing Home, Home Health and Hospice remain separate. Incompatible class/evidence criteria retain the original class and location in an explicit limitation. Identity lookup stays an identity operation; extra geographic evidence is not asserted unless returned fields agree. Missing source releases/outages return unavailable, not zero. Valid scoped empty cohorts remain honest corpus misses.

The existing Ask parent `lib/network/senior-ask.ts` was inspected read-only. Its contract, result shapes and failure fields remain; `geography.state`, recorded-location fields, typed rating evidence, terminal state and source provenance are additive. No parent routing or other hub was edited. Structured city-only callers must supply/choose a state rather than receive an unqualified cross-state cohort.

## Rating contract

NH overall, staffing and inspection remain distinct source metrics with integer 1–5 values. Home Health Quality of Patient Care permits 1–5 in half-star increments, as documented by [CMS methodology](https://www.cms.gov/files/document/quality-patient-care-star-ratings-methodologyapril-2020.pdf) and [CMS national data fields](https://data.cms.gov/provider-data/dataset/97z8-de96). Missing, nonfinite, out-of-range and unsupported fractional values are unavailable, never clamped to zero. The acquired agency snapshot's typed source column is used as stored; this ticket does not rewrite the ingestion schema or fabricate missing half-star observations. Hospice receives no NH overall rating.

## Review and operating boundary

Review method: separate self-review of the full diff plus automated behavioral, TypeScript, lint and browser checks; **not independent human review**. Review checked predicates, release selection, parameterization, class preservation, missing-source semantics, source clocks, trusted API fields, rating families, disclosure semantics and focus.

The optimized browser caught two implementation defects before release: an incorrect fingerprint column name (`content_hash`, corrected to the actual `content_sha256`) and Shift+Tab escaping the compact dialog's initially focused scroll container. Failed receipts are retained. No failure was relabeled as successful browser proof.

No production data/schema writes, ingestion, identity merges, publication expansion, account operations, new paid resources or cross-repository edits were performed. Local database verification uses Supabase's public CA with `verify-full`; no TLS verification reduction or production environment changes were required.

## Limited closure and rollback

Only this ticket's compound recorded-location, typed rating and shared-header paths are candidates for closure after the actual release receipt. Ask senior-care routing, radius/service-area resolution, broader class/ownership work, and Move's unapproved canonical docket correction remain separate.

Rollback: reviewed revert of this ticket's code commits and normal deployment; no database rollback. Preserve the evidence and explicitly disclose any temporarily unavailable local research rather than claiming wider results satisfy a city request.
