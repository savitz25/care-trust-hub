# Texas HHSC Ask name discovery R2

Branch-only Ask retrieval correction. No Texas source row, batch, publication flag, organization link, or database schema changes.

## Failure path

The live branch does not include the still-open [Ask discovery PR #61](https://github.com/savitz25/care-trust-hub/pull/61). Live bare names therefore fall through the CMS-oriented Ask planner and return no Texas regulated location. PR #61 added a Texas branch before the CMS planner, but its bare-name resolver accepted only a complete normalized official name. `KIRBYVILLE GROUP HOME` passes that check. `Educare Community Living` does not: 131 published HHSC rows begin with that name and continue with `LIMITED PARTNERSHIP` (123 ICF/IID and 8 in-home-only).

R2 keeps exact normalized names first. If none exist, it accepts a word-boundary prefix of at least three words and 20 normalized characters. The Ask page and API also count normalized name tokens before routing; a punctuation variant such as `kirbyville, group-home` must not fall through because it has only two whitespace-separated tokens. It never uses a Facility ID outside the `TX|HHSC|<class>|<Facility ID>` namespace or treats names as organization bridges. A 131-row match returns `NEEDS_CLARIFICATION`, the exact count, up to 20 distinct location records, and a prompt to narrow by city or class. Qualified and explicit-class paths remain separate. Generic fragments, nonexistent names, bare numeric IDs, CMS/CCN queries, and explicit CMS class selections do not become Texas location matches.

## Branch QA

- Focused Vitest: 13 tests passed across Texas location, Ask discovery, and publication gate suites.
- TypeScript, targeted ESLint, targeted Prettier, and production build passed.
- Preview must verify `/api/ask` and `/ask` for Kirbyville, Educare, a DAHS name, qualified state/class queries, normalized punctuation, and ambiguity output. The protected preview uses the immutable certified 1,840-row fixture; the public live batch and organization count remain untouched.

PR #61 remains a prerequisite for this branch. Evidence should certify the combined behavior before any production merge or deployment.
