# ATH-METRICS-R2-03 — Senior contract

The homepage and `/api/network-metrics` consume `apps/web/src/data/senior-network-metrics-v1.json`, schema `senior-network-metrics-v1`, additive `contractRevision: ATH-METRICS-R2-03`. Ask is unchanged.

## Reproduce and validate

```sh
npm ci
npm run build:network-metrics
npm run check:metrics-r2-03
npm run check:senior-network-metrics
python scripts/check-senior-network-metrics-stale.py
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Generation is offline: the Python generator reads `artifacts/senior-metric-census-r2-03.json`; the TypeScript entry point adds accepted state artifacts and generated homepage projections. The original Python command also delegates to this entry point. Missing required values and unreconciled federal state partitions fail non-zero. `--check` preserves generated UTC and requires reproducible output. Hashes use LF-normalized UTF-8 for Windows/Linux compatibility. CI checks generation and source fingerprints.

Optional replacement-census acquisition: configure `CARE_DATABASE_URL` or `CARE_METRICS_ENV_FILE`, then `python -X utf8 scripts/build-senior-network-metrics.py --capture-census`. Review/accept the census before generating. This uses a read-only repeatable-read transaction and rollback. HHA and Hospice current directory counts/geography now explicitly select the current source release. No source tables or canonical accepted snapshots are changed.

## Grains

Federal current-directory populations remain **14,690 Nursing Homes**, **12,460 Home Health agencies**, **6,669 Hospice providers**. They are not one provider denominator. Evidence families remain independent, including 149,978 inspection observations, 419,479 health-deficiency observations, 15,694 penalty/enforcement records and 1,248,650 MDS observations.

The revision exports 42 explicit CO/VA/NY/IL measures in `reconciliation.stateMetrics`. Federal state partitions are verified against existing national geography and never added again. VA retains 573 ALF and 82 Adult Day identities separately from 7,032 inspections, 2,488 complaint-related inspections and 4,066 violation-flagged inspections. NY retains 597 profile IDs, 595 rows carrying CCN and 594 distinct exact CCNs; current CMS NY remains 593. Adult Home/EHP subtotal 527 is permitted only with the accepted zero-overlap assertion; class counts 381/146 remain exposed. LHCSA, CHHA, LTHHCP, CMS HHA and Hospice remain separate. IL CMS and IDPH classes remain separate; 169 HFS sites and 13,939 units are different measures.

Colorado CDPHE and Illinois unacquired state-license universes remain SEARCH_ONLY/null. `stateCapabilities` distinguishes published routes, acquired state-source evidence and federal baseline. Colorado's CMS partitions do not count as acquired CDPHE source coverage. Specialist completion is not inferred.

## Homepage and clocks

`homepage.intel`, `homepage.evidenceInventory` and `homepage.stateCards` are generated at build time from accepted inputs. Existing design is retained. Homepage changing values no longer read hard-coded `_LOCKED` counts or direct state snapshots at runtime. Generator adapters in `packages/domain/src/senior-home-accepted-inputs.ts` read the existing accepted JSON fields. Arizona crosswalk and Washington class examples use generated values. Published routes are not labeled completed specialist coverage.

Every state metric retains `sourceAsOf`, `snapshotAsOf`, `retrievedAt`, and source-artifact `generatedAt` separately. Null source dates stay null (e.g. Virginia). Colorado federal source clocks are CMS's official modified dates, not the later state-overlay timestamp. The national `newestSourceAsOf` retains its existing CMS-only meaning; it is not a network-wide freshness promise.

## Ask handoff

- Public URL: `https://www.seniortrusthub.com/api/network-metrics`.
- Artifact/schema remain v1; revision is `ATH-METRICS-R2-03`.
- Additions: `contractRevision`, `homepage`, `reconciliation.acceptedSources`, `stateMetrics`, `stateCapabilities`, `census`, `noCombinedProviderDenominator`.
- State metrics identify exact source artifact and field, source grain, care class, capability, aggregation prohibition and separate clocks.
- Existing national `metrics`, `providerUniverses`, `evidenceFamilies`, `geography`, publication flags and rejected combined totals retain their meanings.
- Prompt 5 must accept the new fingerprint/revision and consume these specialist-owned fields, without recomputing source populations, converting null to zero, or promoting INTERNAL/REJECTED fields to headlines.

New source classes require explicit adapters/validation; homepage totals need no manual edits. Acquisition scheduling and age policies remain Prompt 6 work. No canonical source artifacts, identity joins, production database rows, or other hub applications were modified.
