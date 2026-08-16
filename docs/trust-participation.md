# SeniorTrustHub trust participation

SeniorTrustHub keeps three evidence layers separate:

1. Official source evidence is immutable. A submission cannot update CMS snapshots, PBJ, inspections, penalties, ownership, CHOW, or chain evidence.
2. SeniorTrustHub-owned normalization and mapping may receive a reviewed, reversible manual override. The original derived value, correction, reason, approving request, reviewer reference, activation, and revocation remain recorded.
3. Provider-supplied context is moderated and stored separately. Only approved context is eligible for public display, and it is labeled as submitted by a provider representative rather than as CMS evidence.

## Requests and review

The public workflow distinguishes profile claims, SeniorTrustHub corrections, source-data concerns, and factual provider context. Claiming and correction rights are free. Claims may reference a stable `provider_id` or `organization_id`, require manual evidence review, and establish response authority only—not beneficial ownership or control.

Statuses are explicit and every transition appends history and an audit event. Audit history cannot be updated or deleted through ordinary table operations. Contact details, evidence links, internal notes, and reviewer information are private operational data.

Task 012 intentionally does not expose an administrator route. The project does not yet have hardened administrator authentication, and an unauthenticated review UI would be unsafe. Authorized reviewers can use restricted database operations until Task 013 introduces an appropriate access boundary.

## Public and commercial firewall

Search, What to Review, compare, shortlist, ownership, chain intelligence, and Source Register queries do not consume claim, correction, context, subscription, billing, or entitlement state. A dispute never suppresses public evidence. Approved provider context is a bounded, separate facility-page read and never replaces an evidence fact.

Future Provider Console accounts may reference stable `organization_id` and `provider_id` values through separate membership and claim tables. They must not mutate official ownership evidence, source snapshots, public ordering, or evidence visibility.

## Submission security

Public submissions are server validated, length bounded, parameterized, limited to HTTPS evidence URLs, protected by a honeypot and a per-email database rate bound, and do not accept uploads or arbitrary HTML. No contact information is placed in URLs or returned on public pages.
