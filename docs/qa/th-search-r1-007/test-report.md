# TH-SEARCH-R1-007 verification record

This document is a candidate record until a final release receipt exists. No future merge/deployment identity is asserted.

## Deterministic checks

`npm run check:th-search-r1-007` executes the real parser, request boundary, emitted SQL, adapters, result construction and rendering against distinguishable fixture records. CI runs it explicitly in addition to the existing full test suite.

- Initial five geography reproductions: red before implementation (`red-before-search.log`).
- UI baseline: invalid values and missing disclosure fail (`red-before-ui.log`); valid 4/5 remains a positive control.
- Deliberately dropping city: detected; Burleson entered Austin results.
- Deliberately dropping state: detected; another state's Austin entered results.
- Deliberately reading the first character of rating prose: detected by the actual result-render test requiring the source 4/5.
- All deliberate mutations restored. Logs are separate from clean gate output.

The fixture SQL oracle inspects emitted bound predicates independently of the parser, includes historical releases and other classes/states, and never writes production fixtures. The source oracle separately exercises actual read-only source rows.

## Baseline comparison

Baseline typecheck, lint, full tests and optimized build were executed in the isolated exact-base worktree. Their logs are retained. Baseline web tests: 310 passed, six skipped; domain tests: 253 passed. Skipped repository integration tests require an isolated fixture database; they were not redirected at production. Read-only source and scheduler-independent research checks are recorded separately.

The intermediate full run found three old city-only golden expectations and a wording compatibility assertion. The golden states were changed to explicit clarification, with state-selection success tests; the service-territory wording was preserved. The latest clean logs, not the intermediate failures, determine release eligibility.

## Browser checks

`browser-proof.cjs` is an explicit bounded live probe, excluded from normal CI. It runs real homepage Enter, native results, API parity, source counts, city selection, broadening, history/reload, honest miss and CCN controls; then measures actual loaded-logo/control rectangles and disclosure/dialog behavior at 320, 390, 768, 1024, 1280, 1440 and 1920 CSS pixels.

The initial optimized local run completed 22 search cases and then detected the compact-dialog focus failure. The earlier source-column failure is also retained. Neither failed run constitutes complete browser certification. See the final local/production browser JSON for measured timings and exact tested heads. A 640 CSS-pixel viewport is only a 200%-reflow equivalent; it is not mislabeled as actual browser zoom.

The corrected optimized local build at `fbe7bff38c3de47b09b3f1ba4d2dfcbbe71b141d` passed 22 browser/API cases and seven header widths with zero browser errors. `local-supplement.json` adds seven checks covering three responsive query-edit/filter/profile flows, the future-list scroll test, and three independently sourced count/fingerprint comparisons. `local-actual-zoom.json` records a separate **actual 200% Chrome zoom** using `chrome.tabs.setZoom/getZoom` in an isolated owned profile: factor 2, viewport 640×450, no overflow, keyboard/Escape/focus passed. No global or user browser profile setting changed.

The clean focused command passes 72 tests. The latest full local run before the final additional class-guard test passed 348 web tests and 253 domain tests, with six existing integration skips. The final focused gate includes that class-guard test. Required CI must validate the final candidate too.

Windows full `format:check` flags checkout CRLF endings: 527 files on the exact baseline and 508 on the candidate. No repository-wide formatting rewrite or gate relaxation was performed. Changed files are formatted; Linux CI's existing formatting gate remains required. Baseline typecheck, lint and production build pass. The existing Edge Runtime deprecation warning remains unchanged. The dependency audit reported five existing findings in both identical lockfile installs; this ticket did not upgrade dependencies or change the lockfile.

## Security and publication

SQL values are parameterized; city equality cannot become wildcard matching. Existing source and public-profile controls remain. Search remains noindex; no raw query/name analytics dimension was added. Credentials remain ignored server-only environment values. Final tracked-content and secret-value scans must pass before release. No raw provider/person payloads are retained; excerpts are public source identity/location fields and synthetic questions.
