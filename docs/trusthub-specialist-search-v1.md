# Trust Hub Specialist Search V1 — Senior adapter

Status: Senior local implementation. Reference contract: Contractor `697052a4fd2d1ba2ced985c5373315fd16517ed8`; Move reference `bb7177cdf7eb9c26ffe8c24884212a4f16950d07`; Lender reference `964faacdb780d0421f7a404c6f9daecaf0af17d3`.

## Shared experience

Senior implements the network question-first shell, one bounded input and Research action, examples, Advanced filters, visible/removable interpretation, identity/evidence/result anatomy, structure-derived match reasons, result trace, explicit capability states, safe empty states, normalized analytics, and responsive/accessibility behavior. `/ask` remains `noindex,follow`.

The local portable types define the network request, interpretation, capability, and result/trace shapes. Shared implementations should preserve:

- explicit submission rather than per-keystroke database work;
- identity-first relevance, never provider-quality ordering;
- consumer-visible structured interpretation and deterministic refinement;
- a compact discovery result with evidence availability and a deep profile action;
- `KNOWN`, `UNKNOWN`, `PARTIAL`, `NOT_ACQUIRED`, `REQUEST_ONLY`, and `UNSUPPORTED` capability states;
- fail-closed states that leave the research shell usable;
- the seven `specialist_search_*` events without raw questions or identifiers;
- semantic controls, keyboard operation, touch targets, wrapping, and contained table overflow.

## Senior domain adapter

The existing `senior-ask-parse` and `senior-ask-execute` pipeline remains authoritative. It owns provider classes, labeled CMS CCNs, class-specific ratings, geography, CMS evidence joins, ownership/CHOW, HHCAHPS/Hospice CAHPS, counts, compatible comparisons, source clocks, and profile routes. Natural language interprets; parameterized source-backed execution establishes facts.

The domain adapter is responsible for ontology, CCN/class resolution, provider-name matching, class-aware filters, evidence joins, source clocks, match reasons, canonical provider routes, and source-specific limitations. A future port should implement those pieces locally; it should not import Senior runtime code.

Nursing homes, Home Health agencies, Hospice providers, and state-specific assisted living are never summed or silently substituted. Provider address is not service territory. CMS ratings remain named CMS metrics, never a TrustHub score. Evidence absence is not a clean record. Ownership-network size is not quality.

## Deliberate boundaries

- Assisted living remains state-specific and does not enter the federal CMS class denominator.
- Home Health and Hospice CHOW are not acquired under a comparable contract.
- Hospice has no nursing-home-equivalent overall CMS star.
- Home Health office county is not used as service coverage.
- Raw questions and exact CCNs are excluded from client analytics.
