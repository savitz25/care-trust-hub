# Consumer decision experience

Nearby search uses the representative internal point in the U.S. Census Bureau 2025 national ZIP Code Tabulation Areas Gazetteer. A ZCTA is an approximate statistical representation of a USPS ZIP Code service area, not a USPS delivery definition; some valid USPS ZIP Codes have no ZCTA. If a code cannot be resolved, search falls back transparently to exact facility ZIP matches and suggests city/state search.

The location reference is supporting search geography, not facility evidence. It is stored separately with source organization, version, official URL, SHA-256, retrieval time, and methodology. Facility locations and all CMS evidence remain unchanged.

Consumer latitude/longitude inputs are intentionally absent. ZIP searches resolve server-side, use PostGIS `ST_DWithin`, default to 25 miles, and order by distance unless the consumer explicitly selects a CMS-published rating sort. Results are paged in bounded groups of 20.

What to Review uses fixed category ordering and existing source-qualified read models. It summarizes evidence without scoring, severity ranking, or recommendation. Compare and research packet reads use a bounded two-query pattern: one current Provider Information batch plus one evidence-summary batch for at most 10 public CMS identifiers.

No additional decision-experience feature flag is used. These routes were already controlled by the server-only real-provider Preview flag, so another nested flag would add configuration without creating a meaningful boundary. Production remains unchanged.

Public search, What to Review, shortlist, compare, and research packet accept only public evidence and interface state. They have no subscription, billing, entitlement, claim-status, provider-user, or provider-marketing dependency. Shortlist persistence stores at most ten public CMS provider IDs in the browser; it does not collect patient or family information.
