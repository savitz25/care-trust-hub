# CMS chain intelligence

CMS Chain ID is a CMS grouping identity and is never an `organization_id`. CMS forms chains from PECOS ownership, officer/director, or operational/managerial-control relationships using network analysis and manual review. Current membership is accepted only from the exact `AFFILIATION ENTITY ID` published in Skilled Nursing Facility Enrollments; names never create membership.

Monthly performance snapshots are immutable. All 47 non-identity fields are stored as the CMS-published numeric value or null, with zero preserved separately from missing. TrustHub does not recalculate or replace CMS chain averages and does not rank or score chains.

The public read path depends only on CMS evidence and stable `provider_id`/CMS Chain ID. Future claims, users, subscriptions, billing, entitlements, and provider-supplied content cannot edit, suppress, reorder, or otherwise affect chain evidence. Provider Console may later display this public evidence, but it cannot become its source of truth.

Chain intelligence is fail-closed behind the server-only `CARE_ENABLE_CHAIN_INTELLIGENCE=true` flag and also requires the real-provider UI flag. During controlled review, enable it for Preview only; Production remains off.
