# SeniorTrustHub Task 014C.1 — Resolver V2 Conservative-Case Retest

## Executive Summary

Resolver V2.2 re-evaluated the original 200-facility pilot without making a Google request. It retained all 120 independently audited V1 identities and recovered 19 of the 26 likely-valid conservative cases. All 19 promotions passed a separate evidence audit, producing 139 final verified identities with 100% measured precision and zero critical wrong-facility errors. Sixty-one facilities remain review-required. Because V2 materially changes entity-versus-field resolution, the appropriate next gate is a fresh, untouched validation cohort rather than national enrichment.

All Google-derived claims remain publication-ineligible. CMS CCNs, canonical names, source observations, ownership, chain, and staffing evidence remain unchanged.

## Resolver V1 Baseline

- Cohort: 200 facilities in 44 states.
- Final identity states: 120 `VERIFIED`, 80 `REVIEW_REQUIRED`.
- Google requests already invested: 200 discovery and 191 detail requests (391 total).
- Likely-valid conservative cases: 26.
- Audited V1 precision: 100%; critical wrong-facility errors: zero.

The V1 run and its evidence, confidence, reasons, audit results, candidates, observations, and actions were not modified.

## Resolver V2 Changes

The final rule version is `facility-identity-pilot-v2.2`. The implementation separates entity identity from field claims, retains explicit hard gates for care type, competing candidates, shared/campus scope, state, and rejected candidates, and records a reconstructable reason and matching features for each result. Phone and website disagreement no longer automatically invalidate an otherwise strongly corroborated entity identity.

Two intermediate V2 rule-evaluation runs are retained as non-public audit history. They revealed that the initial campus gate conservatively downgraded three already audited V1 hospital/campus SNFs. V2.2 permits a campus control to remain verified only when the exact same identity previously passed the independent V1 audit. It does not bypass care-type, shared-identity, competing-candidate, state, or rejection gates.

## Claim-Specific Resolution Design

Each of the 200 facilities received separate, publication-ineligible V2 claims for Place identity, public name, physical address, phone, website, and business status. Final field-state counts are:

| Claim            | VERIFIED | PROBABLE | REVIEW_REQUIRED | UNRESOLVED |
| ---------------- | -------: | -------: | --------------: | ---------: |
| Place identity   |      139 |        0 |              61 |          0 |
| Public name      |      154 |        0 |              16 |         30 |
| Physical address |      188 |        0 |              11 |          1 |
| Phone            |      156 |        0 |              25 |         19 |
| Website          |       64 |        0 |              42 |         94 |
| Business status  |        0 |      183 |               0 |         17 |

Business status remains commercial corroboration and cannot establish regulatory operating or closure status.

## Phone Conflict Policy

A phone conflict is a field conflict, not an automatic identity veto. Identity may be verified when name, state, street/location, ZIP, care type, candidate uniqueness, and Place scope remain safe. The conflicting phone remains `REVIEW_REQUIRED`; neither source overwrites the other. Fifteen of 26 phone-conflict facilities were identity-verified, while 11 remain identity review-required for additional non-phone ambiguity. Across all candidates, 25 phone claims remain review-required and 19 have no usable phone evidence.

## Alias / Rename Policy

V2 normalizes only harmless name presentation differences and requires independent physical-location evidence. Historical/rename evidence remains observational and never creates a new canonical facility. All 13 cases carrying `NAME_CONFLICT` remain review-required; V2 did not use fuzzy naming to promote them. No rename was inferred from name similarity or ZIP alone.

## Address Conflict Policy

Address is decomposed into street/location, state, ZIP, and coordinates. Formatting, abbreviation, and unit differences can corroborate identity, but conflicting streets or locations remain a gate. All 11 `ADDRESS_CONFLICT` cases remain review-required.

## Campus Identity Policy

Campus proximity or a shared street address is insufficient. Seven of ten campus cases remain review-required. Three are retained V1 verified controls whose exact candidate identities already passed independent audit; none is a newly recovered match. Hospital, rehab hospital, assisted living, campus-wide, and facility-specific identities remain distinct.

## Shared Place ID Policy

Place IDs are evaluated by scope: facility-specific, campus-level, organization-level, or ambiguous. One pilot identity is explicitly shared/ambiguous and remains review-required. No CMS facilities were merged or split, and no shared Place ID became a canonical facility identifier.

## Care-Type Conflict Policy

Both care-type conflicts remain review-required. The prior-audit campus exception cannot override a care-type conflict.

## Website Classification

V2 classifies the candidate URL independently of Place identity. Results were 44 `FACILITY_OFFICIAL`, 18 `OPERATOR_FACILITY_PAGE`, two `HEALTH_SYSTEM_FACILITY_PAGE`, and 136 `UNKNOWN`. Only the 64 URLs that passed the bounded V1 official-site audit are verified field claims. No HTTP URL was promoted merely by changing its scheme, and no broad crawl occurred.

## Competing Candidate Policy

All three multiple-plausible-candidate cases remain review-required. Numeric score proximity never selects a winner without deterministic separating evidence.

## Re-Test Cohort

The persisted manifest contains the original 200 unique CCNs and includes all 120 V1 controls, 26 likely-valid conservative cases, 26 phone conflicts, 13 name conflicts, 11 address conflicts, ten campus cases, three competing-candidate cases, two care-type conflicts, and both rejected candidate controls. Groups overlap. The cohort fingerprint is unchanged from Task 014C.

## V1 vs V2 Results

| V1              | V2.2            | Count |
| --------------- | --------------- | ----: |
| VERIFIED        | VERIFIED        |   120 |
| REVIEW_REQUIRED | VERIFIED        |    19 |
| REVIEW_REQUIRED | REVIEW_REQUIRED |    61 |

There were zero changed Place identities, zero V1 downgrades, and zero critical regressions.

## Newly Recovered Matches

Nineteen of the 26 likely-valid conservative cases are newly verified. Their main recoverable pattern was strong entity evidence with a separately withheld phone or other field claim. Seven remain review-required because the remaining ambiguity involves identity-level evidence rather than merely a secondary field. No candidate was promoted through a care-type, competing-candidate, shared-Place, true address-conflict, or unaudited campus gate.

## Regression Analysis

All 120 V1 verified controls were rerun against the same persisted evidence and candidate identity. All remain verified, with no Place ID change. Both rejected candidate controls remain rejected and neither was selected by V2. Permanent tests cover phone conflict, alias plus exact location, care-type mismatch, hospital campus, shared Place ID, corporate website, same-market sibling, multiple plausible candidates, conflicting address, rejected candidate, and the narrow prior-audited campus control.

## Independent Audit

All 19 newly promoted identities passed a separate audit gate requiring compatible name, state, physical location, and absence of care-type, shared-identity, rejection, or competing-candidate ambiguity. The audit did not use the resolver confidence threshold as its decision. The 120 retained controls preserve their prior independent audit and were checked for unchanged identity and newly introduced gates.

- Retained V1 precision: 120/120 (100%).
- Newly recovered precision: 19/19 (100%).
- Combined precision: 139/139 (100%).
- Audit failures: zero.
- Audit-required downgrades: zero.
- `CRITICAL_WRONG_FACILITY`: zero.

## Precision Results

The bounded pilot retains 100% measured identity precision. Verified website and phone fields retain the prior audited precision baseline; V2 did not automatically validate either field from Place identity.

## Critical Error Results

Zero critical wrong-facility verified matches were found. No assisted-living, hospital, corporate-office, same-name sibling, unrelated rehab, or wrong-campus-building candidate crossed a hard gate.

## Remaining Review Cases

The original queue contained 80 open items. Nineteen were resolved through append-only review actions and are now decided; 61 remain open. Important overlapping reasons among the final cohort include 11 address conflicts, 13 name conflicts, 11 remaining phone-conflict identities, seven campus ambiguities, three competing candidates, and two care-type conflicts. Review history was not deleted.

## Cache / API Usage

- Existing persistent Google request rows reused: 391.
- Cache misses: zero.
- New discovery requests: zero.
- New detail requests: zero.
- Total new real Google requests: zero.
- External requests avoided: 391 relative to replaying the original discovery/detail work.

V2 reads persisted candidates, observations, and cached pilot evidence and does not import or invoke the Google adapter. Request fingerprints and stored evidence contain no credential.

## Data Integrity

- Canonical facilities: 14,693.
- Unique current CMS CCNs: 14,693.
- Ownership evidence: 674,063.
- Chain evidence: 10,231.
- Staffing summaries: 57,873.
- Publication-eligible V2 claims: zero.

CMS canonical names and observations were not updated. No facility was merged, split, or re-identified, and CMS CCN remains canonical.

## Security

The resolver is a server-side CLI, reads credentials only from ignored local environment files or managed process configuration, and never logs them. It made no external request, persisted no credential-bearing URL, exposed no route, and created no public claim. `.env.local` remains ignored and unstaged.

## Performance

The final bounded production re-resolution completed in approximately 134 seconds for 200 facilities (about 0.67 seconds per facility including claim and audit persistence). It uses bounded per-manifest writes and does not affect consumer query paths. No production page query or schema changed.

## Tests

- `npm run check`: PASS — Prettier, ESLint, strict TypeScript, 73 web tests passed (five live-database tests intentionally skipped in the normal run), 21 domain tests passed, and the Next.js production build completed.
- Resolver/domain regression coverage: PASS — 16 Facility Intelligence tests, including all required V1 failure classes and the independently audited campus-control rule.
- `python -m ruff format --check services/ingest`: PASS — 36 files formatted.
- `python -m ruff check services/ingest`: PASS.
- `python -m pytest` from `services/ingest`: PASS — 42 passed; eight isolated PostGIS tests skipped by the normal no-database run.
- Local isolated PostGIS execution: unavailable because Docker is not installed on this workstation. The unchanged Migrations 0012/0013 and eight integration tests remain covered by the repository's PostGIS CI job; CI status is recorded with the final commit.

## Recommendation for National Validation

Status: **READY FOR INDEPENDENT VALIDATION COHORT**.

V2 materially changed field-versus-identity handling and was developed against the original pilot. A fresh, untouched 100–200 facility holdout should therefore test the frozen V2.2 rules before Task 014D. Stratify the holdout for phone disagreement, aliases/renames, hospital and senior campuses, shared addresses, same-market siblings, care-type collisions, and independent facilities. Do not tune V2.2 on the holdout; measure retained/new precision separately and require at least 99% newly verified precision, zero critical wrong-facility matches, and unchanged public/CMS integrity.
