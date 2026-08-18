# Task 020.1 — Family Comparison Workspace foundation

Version: `senior-family-workspace-v1`

No public route. No homepage/search/facility CTA. No Google Places usage.

## Storage

Browser-local `localStorage` key `sth-family-workspace-v1`. Stores CCNs plus optional research stage, notes, visit notes, and a user-entered quote. Regulatory evidence is never copied into storage.

Maximum 5 facilities. CCNs are validated and deduplicated. Corrupt payloads reset to an empty workspace.

## Privacy

No account, email, server notes, or shortlist URLs. Annotations never go to analytics or the SeniorTrustHub database.

Shared-device warning: saved only in this browser; avoid sensitive medical or financial information.

## Comparison fields

Fresh published snapshot per CCN:

- Identity, CMS ratings (missing stays missing)
- Current staffing metrics and recent material staffing direction from Facility History
- Concise inspection and CMS penalty context
- Compact history highlights
- CMS ownership type, chain, published Ownership V2 organization
- CA/NY/TX license fields and CA/NY enforcement using current publication rules

Deterministic **Things that differ** text. No score, winner, or better/worse language.

## Batching

One comparison load uses the shared pool and a handful of set-based reads (`getProvidersByCcns`, `getDecisionSummariesByCcns`, batched published history, optional batched state claims and published organizations). No per-facility pool and no N+1 query tree.

## Tests

Domain storage/comparison, browser persistence, invalid CCN rejection, batched history, and a skippable 5-CCN integration read when `CARE_DATABASE_URL` is present.

## Google safeguard

Google Places API requests: 0
