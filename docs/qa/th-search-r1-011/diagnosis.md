# TH-SEARCH-R1-011 diagnosis and bounded contract

Starting main: `1d0e33deb30ac0e7ca07c7b9b4056553c0a8681d`. Remote: `savitz25/care-trust-hub`. Production baseline deployment: `dpl_C9kjzMJh5yrq457T4W9rJe4g7nt6`, canonical `https://www.seniortrusthub.com`.

Astra was user-confirmed earlier. Active model/effort metadata and a running-session switch are unavailable; Medium is the ticket recommendation, not an independently verified active setting.

## Ownership and protected work

Fresh isolated `th-search-r1-011` worktree; original dirty checkout and closed R1-007 worktree untouched. No overlapping R1-011 assignment or PR was initially visible. Illinois PR #33 appeared during work. It shares the parser file for state capability text but is a separate assignment; it was inspected read-only, not merged or modified. Fresh main reconciliation is required before release.

## Baseline observations and roots

- `Who owns this nursing home?` bypassed the narrow pronoun guard and became a nursing-home ownership-category cohort. The old golden corpus incorrectly called it PASS.
- `Has this nursing home been fined?`, `Did this facility change owners?`, and `Who owns this facility?` already stopped before retrieval, but offered no identity-entry continuation. Preserve this guard and strengthen it; these cases were not manufactured as red.
- Named ownership questions retained neither a safe evidence task nor a revalidated selected provider. The repair extracts a bounded subject and retains the task through provider entry/name candidates/CCN selection.
- Labeled CCN misses were empty completed searches without the relevant official CMS action. They now explain corpus absence, show the complete CCN, and link to maintained Care Compare without guessed parameters.
- State assisted-living alternatives were English strings re-submitted to Ask, rather than links to the maintained Virginia/New York/Arizona/Florida research routes. Memory care must not become a CMS class.
- Browser testing found generic `care in Austin Texas` could enter the bare-name branch. A real class clarification now precedes any retrieval, and the typed choice retains Austin/TX.
- The existing regulatory report discarded deficiency rows without a linked inspection from its public projection. The additive exact-provider deficiency projection preserves those rows; existing nested inspection rendering remains unchanged.

The initial unchanged-runtime gate was 3 failing / 2 passing tests. See `red-before.log` and `baseline-browser.json`. Four golden expectations change to NEEDS_CLARIFICATION, with zero provider/evidence calls asserted independently. No test was deleted.

## Existing boundary and identity rules

`executeSeniorResearchQuery` / `executeSeniorRequest` / `executeSeniorResearchPlan` remain authoritative. Page and API use the same request validation. New optional typed provider/CCN/selection fields retain the original evidence question. A selection reruns the bounded source-name/class/location query, verifies the candidate belongs to that set, and resolves its exact CCN again before loading evidence. Client names/statuses/URLs never supply evidence.

A unique exact source name may resolve immediately only when the bounded search is not truncated. Multiple exact names and relaxed matches require selection. At most ten candidates are displayed; this is not a population count. Existing escaped ILIKE predicates run before limits; exact source-name ordering precedes relaxed candidates. No similar-name identity merge, source ingestion, new publication, or database write occurs.

Exact CCN misses do not broaden. Bare six-character strings remain ambiguous. Missing source releases and loader failures return SOURCE_UNAVAILABLE, not evidence absence. A source-backed identity may remain useful when its class does not support the requested evidence.

## Source / evidence matrix

| Path                               | Identity / grain                                      | Source semantics and limits                                                                                            |
| ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Identity                           | Current CMS class directory; CCN/provider ID          | Existing successful release selection; class and compound recorded location preserved                                  |
| Ownership                          | Exact provider ID; separate relationship observations | CMS ownership, SNF all owners/enrollments; existing latest releases, 75 observation cap; category is not a named owner |
| CHOW                               | Exact provider ID; historical source event            | Existing CHOW repository, 20 events, separate event/source dates; no sale/current-owner inference                      |
| Penalty                            | Exact CCN/provider ID; penalty observation            | Current accepted penalties source, 100 rows; no all-time clean-history claim                                           |
| Inspection                         | Exact CCN/provider ID; survey                         | Existing current inspection source, 20 rows                                                                            |
| Deficiency                         | Exact CCN/provider ID; finding                        | Existing current deficiency source, 200 rows, including unlinked findings                                              |
| Home Health / Hospice evidence gap | Identity retained in its own class                    | Does not inherit Nursing Home ownership/CHOW/regulatory evidence                                                       |
| Assisted living / memory care      | State capability, not CMS class                       | Maintained state intelligence actions; no city-filtered or memory-care-service claim                                   |

Independent source selection and fingerprints are in `source-oracle.json`. For CCN 455799 the pinned source has nine NH ownership plus one enrollment relationship observation, and three penalty observations. These are source-window QA expectations, not production constants or unique-owner totals. No ultimate owner was inferred.

## Publication, recovery and privacy

Existing profile validation and public feature flags remain intact. Profile question links are built only after the server resolves the canonical public provider CCN. Held/private records are not published. Candidate evidence is empty until selection. New API fields are additive; existing successful fields and provider routes remain.

The CMS recovery destination is exact HTTPS `https://www.medicare.gov/care-compare/`, with no invented CCN deep link. `official-link-check.json` records actual access, including any rendering restriction. State recovery is internal to already published routes; their source distinctions remain unchanged. No new analytics dimensions, account operations, raw private payloads, source writes, or external redirects were added.

## Review and rollback

Separate self-review plus executable automated checks; not independent human review. Review covers identity precedence, ambiguity, CCN equality, source-specific ownership roles, absence semantics, class/location preservation, current releases, API projection, recovery URLs, and stale form selection. R1-007 gates protect ratings/header/location. Rollback is a reviewed Senior-only revert/deployment of this ticket, with no database rollback. Prior Move/Lender/Contractor/Ask releases and pending Move correction are outside scope.

Release identity and final browser observations are recorded only after they exist in the result/receipt artifacts. This diagnosis is not a Production certificate.
