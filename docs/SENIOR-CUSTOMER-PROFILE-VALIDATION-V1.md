# Senior customer profile validation V1

Contract: `senior-customer-profile-validation-v1`  
Version: `1.0.0`  
Consumer: AskTrustHub customer plane

`GET /api/customer-profile-validation/v1` returns the capability manifest and deterministic schema/contract fingerprints. `POST` validates one exact currently public SeniorTrustHub profile.

## Request and success

The request requires `providerClass`, `cmsCcn`, `nativeProfileId`, and `canonicalProfileUrl`. The three independent classes are `nursing_home`, `home_health`, and `hospice`. A success binds those four values to the current canonical directory record and returns the public display name, `publicationState: public`, `current: true`, the canonical destination, and CMS source provenance.

`nativeProfileId` is the existing stable `provider_id` UUID used by SeniorTrustHub. It is not derived from the CCN, name, address, URL, ownership, chain, or request order.

## Failures

Structured failure codes are `invalid_request`, `invalid_provider_class`, `invalid_ccn`, `profile_not_found`, `historical_profile`, `profile_not_public`, `publication_hold`, `native_profile_mismatch`, `ccn_mismatch`, `provider_class_mismatch`, `canonical_destination_mismatch`, and `backend_unavailable`. The implementation performs no fuzzy or name-only fallback.

## Publication and security

The contract queries the existing current CMS-backed directories and reuses existing canonical URL builders. It does not publish a provider, change publication eligibility, write to the database, expose customer data, or infer authority from an owner, operator, chain, CHOW, or related organization.

**This contract proves an exact currently public SeniorTrustHub profile identity. It does not prove that a claimant owns or controls the provider.** AskTrustHub performs customer-control and representative verification separately.

## Fingerprints and compatibility

The schema fingerprint is SHA-256 over the normalized request/success/failure field sets. The contract fingerprint is SHA-256 over the ordered class list and locked exact-identity, publication, no-fuzzy, no-authorization, and no-ownership-substitution semantics. Neither includes provider data, request order, or timestamps. A semantic or schema change requires an intentional version/fingerprint update.

The endpoint is additive. `trusthub-specialist-execution-v2`, public profiles, search, Guided Research, geography, evidence, and publication behavior remain unchanged.
