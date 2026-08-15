# Ownership intelligence architecture

## Evidence semantics

CMS describes the Provider Data Catalog `Ownership` dataset as current ownership information for
active nursing homes. CMS's Provider Enrollment - SNF guidance states that PECOS enrollment,
ownership, and managerial-control data is self-reported by the provider through CMS-855A. The UI
therefore says "CMS-published ownership disclosure" or "reported through Medicare enrollment
records" and does not claim independent beneficial-owner verification.

`Skilled Nursing Facility Enrollments` is current enrollment identity: Enrollment ID identifies an
enrollment application; PAC/Associate ID identifies an entity and may span multiple enrollments.
`Skilled Nursing Facility All Owners` contains active ownership-interest and managing-control
associates and preserves CMS role codes/text, association dates, percentages, and explicit entity
flags. Association date is not rewritten as an acquisition or effective date.

`Skilled Nursing Facility Change of Ownership` is cumulative for events effective on or after
2016-01-01 and distinguishes CHOW, acquisition/merger, and consolidation. Its effective date is an
event date. The Owner Information companion provides buyer/seller ownership/control parties; it
does not turn every listed party change into a CHOW.

## Identity and resolution

`provider.id` remains the facility/location identity. `organization.id` is an internal UUID and is
never derived from a mutable name, DBA, or address. `organization_identifier` binds it to an exact
namespace and official identifier. PECOS PAC ID is the preferred durable organization identity;
Enrollment ID and NPI remain distinct identifier types.

Individuals are `ownership_party(kind='individual')`, never organizations. Organizations without
a deterministic official identifier remain separate source-record-scoped organizations. Names,
addresses, phones, and DBAs never create graph edges or automatic merges. A repeated official PAC
ID can update display naming without changing `organization_id`; identical names with different
PAC IDs remain separate.

Provider relationships, organization edges, and CHOW events retain source release, raw object,
ingest run, source-record locator, raw record, dates, exact CMS role, and transformation version.
Disappearance from a later current release does not create an end date.

## Deterministic load order

1. Skilled Nursing Facility Enrollments
2. Skilled Nursing Facility All Owners
3. Nursing Home Ownership
4. Skilled Nursing Facility Change of Ownership
5. Skilled Nursing Facility Change of Ownership - Owner Information

Chain Performance is verified for Task 010 but is not downloaded, loaded, or displayed here.

## Future Provider Console boundary

A future claim or membership can reference stable `organization_id` and/or `provider_id` without
changing official evidence tables. Provider-supplied corrections and context require separate,
clearly labeled tables and review workflows. They cannot overwrite source releases, ownership
relationships, or CHOW events.

Public ownership repositories depend only on provider identity, immutable CMS evidence, and
transparent derived portfolio counts. They have no subscription, billing, entitlement, claim,
provider-user, or provider-supplied-content input. Future billing may control SaaS capabilities but
must never enter public inclusion, ordering, search, comparison, evidence visibility, or
recommendation paths.
