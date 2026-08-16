# Trust request review operations

This runbook is for authorized SeniorTrustHub reviewers using restricted database access. No public or query-token admin route exists.

## Daily review

1. List `trust_request` rows in `submitted`, `under_review`, or `needs_information` status without exporting contact data.
2. Inspect the request type, subject provider/organization, public evidence citation, description, and evidence URLs.
3. Distinguish an official-source concern from a SeniorTrustHub normalization error. Never edit a CMS snapshot or raw release.
4. Validate claimant authority manually. Similar names or email domains are not sufficient by themselves.
5. Moderate provider context for advertising, unsupported claims, personal attacks, and resident or health information.
6. Change status only through the reviewed trust workflow so an append-only audit event is created.
7. Close the request with a factual resolution; keep private reviewer notes out of public context.

## Overrides

An override is permitted only for a SeniorTrustHub-owned mapping or presentation error. It must link to an approved request, preserve the original and corrected values, record a reason and reviewer, and remain revocable. Revocation restores derived behavior without altering source evidence.

## Privacy and escalation

Treat names, email addresses, phone numbers, evidence URLs, and reviewer notes as private operational data. Do not paste them into tickets, analytics, URLs, or public pages. Escalate suspected PHI, threats, legal demands, compromised credentials, or uncertain identity to the product owner. A dispute never suppresses official evidence automatically.

## Operational checks

- Review failed trust submissions in Vercel runtime logs without logging request bodies.
- Confirm every status transition and override action has an audit event.
- Confirm approved public context is separately labeled and unapproved/rejected context is not rendered.
- Claims, corrections, and factual context remain free and never enter search, shortlist, compare, or What to Review ordering.
