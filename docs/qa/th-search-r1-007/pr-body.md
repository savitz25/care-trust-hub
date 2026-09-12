Senior location research dropped Austin to Texas and Houston to an unscoped directory. This change keeps recorded city and state together through the existing shared execution boundary, validates typed filters without truncation, and uses the same current-release predicates for lists and counts. Source failure remains distinct from a scoped corpus miss.

A separate UI commit replaces the cramped inline state row with an accessible By state disclosure and compact modal navigation. Search ratings now render typed CMS values instead of parsing presentation text.

Validation: 72 focused behavioral tests, city/state/rating mutation sensitivity, optimized local browser/API checks at 390/1280, header geometry at 320–1920, actual 200% Chrome zoom, and independent read-only CMS cohort/fingerprint checks. Full baseline/candidate checks and limitations are in `docs/qa/th-search-r1-007/test-report.md`. No database writes, publication expansion, dependency upgrades, or other hub changes. Review performed as a separate self-review plus automated checks; no independent human review claimed.

Production closure remains pending merge, exact deployment verification, and canonical browser proof. Rollback is a normal reviewed revert of this ticket's commits; no data rollback.
