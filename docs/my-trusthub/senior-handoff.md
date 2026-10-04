# My TrustHub V2 — Senior side (2026-10-04)

Senior's half of the shared My TrustHub hand-off that Move and Lender run in
production. **Parent sync is OFF and the canary is OFF.** No environment value
that opens the gate is set anywhere, so the endpoints answer 503 and nothing is
read, built, signed or sent to Ask. Ask is not modified by this work.

## Audit (before this change)

| Question                | Finding                                                                                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Save control            | "Save to shortlist" on nursing-home result cards only (`components/shortlist-button.tsx`). One-way; removal only on `/shortlist`. No Save on the profile page.    |
| Device only?            | Yes. `localStorage["care-public-shortlist-v1"]`, an array of at most ten CMS CCNs.                                                                                |
| Legacy My TrustHub path | None. No My TrustHub code, route, secret or flag existed in this repo.                                                                                            |
| Signed shared hand-off  | None.                                                                                                                                                             |
| Canonical identity      | Per class. CMS nursing homes: the CMS CCN (`provider_identifier` issuer `CMS`, type `CCN`), in the current succeeded `nursing-home-provider-information` release. |
| Source re-proof         | `getSeniorClaimProfile("nursing_home", ccn)` in `server/care/senior-customer-profile-validation.ts`.                                                              |

## Identity

Ask's shared contract (`lib/my-trusthub/contracts/v2-3-profile-transfer.ts`)
already pins Senior, and this implementation follows it exactly:

|                      |                                                                     |
| -------------------- | ------------------------------------------------------------------- |
| Hub                  | `senior`                                                            |
| Profile class        | `cms_facility`                                                      |
| Native identity      | the CMS Certification Number, six letters or digits (e.g. `015009`) |
| Identifier namespace | `cms.ccn`                                                           |
| Return path          | `/facility/cms/<CCN>/<slug>`                                        |
| Publication grain    | one current CMS nursing-home profile                                |

**Out of scope, device Save unaffected:** home health (`/home-health/cms/...`)
and hospice (`/hospice/cms/...`) agencies carry a CCN but are a different class
on a different route; state-licensed assisted living, Florida AHCA and Texas
HHSC profiles are keyed by state identifiers. The shared contract has one
Senior class and one Senior route, so none of these can stage a parent Save and
no universal identifier is invented for them. The provider UUID, name, address
and slug are never identity.

## Protocol

Identical to Contractor's and Lender's edition; only the names differ.

- Manifest `v2-3/selected-profiles/3`, shared positional SHA-256 digest
  (checked against Ask main `14f50a5`; golden digests are pinned in the tests).
- Service assertion header `x-trusthub-v23-assertion`: Ed25519 JWS, claims
  `v, iss, sub, aud, scope, method, path, body_sha256, iat, exp (+30 s), jti,
ask_origin, senior_origin, browser, session, grant`. Origins pinned to
  `https://www.asktrusthub.com` and `https://www.seniortrusthub.com`.
- Flow: device Save first → browser sends `{ ccn, intent }` (`save`,
  `save_signin`, `unsave`) to `POST /api/my-trusthub/profile-save` → server
  re-proves the profile and stages it with two signed calls
  (`prepareGuestProfileTransfer`, `prepareProfileSaveContinuation`) → browser
  form-posts `{ continuationRef, intent }` to
  `https://www.asktrusthub.com/my/profile-save` → Ask calls back
  `POST /api/my-trusthub/profile-save/source` (`resolve`, `source`,
  `acknowledge`) → the profile reports an account Save or Unsave only when
  that acknowledgement is held for this hand-off and this browser.
- Signed-out continuation, abandoned hand-off recovery, keep-page-open notice
  and "May still be saved in My TrustHub · Remove it there" behave as on Move.
- Save never creates a Watch and never touches the Family Workspace.

## Gate (environment, as on Lender)

| Variable                                     | Meaning                                              |
| -------------------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SENIOR_PARENT_SAVE_ENABLED`     | `1` = master switch (build-time for the client half) |
| `MTH_SENIOR_PARENT_SAVE_MODE`                | `production` = server side on (request-time)         |
| `NEXT_PUBLIC_SENIOR_PARENT_SAVE_CANARY_CCNS` | comma-separated CCNs; empty = broad                  |

Master off, a missing or different mode, or a malformed list all mean OFF.

## Keys (names only; none exist)

Senior: `MY_TRUSTHUB_V23_SENIOR_KEY_ID`,
`MY_TRUSTHUB_V23_SENIOR_SIGNING_PRIVATE_KEY_PEM`, `MY_TRUSTHUB_V23_ASK_KEY_ID`,
`MY_TRUSTHUB_V23_ASK_VERIFY_PUBLIC_KEY_PEM`, optional
`MY_TRUSTHUB_V23_PARENT_ORIGIN` (must equal `https://www.asktrusthub.com`).
Ask: `MY_TRUSTHUB_V23_SENIOR_KEY_ID`,
`MY_TRUSTHUB_V23_SENIOR_VERIFY_PUBLIC_KEY_PEM`.

## Database

`db/migrations/0036_my_trusthub_handoff_acks.sql` — **not applied**. Operator
applies it before a canary. Until then no acknowledgement can be held and the
toggle never claims an account outcome.

## Proposed canaries (real published profiles, checked on production 2026-10-04)

| CCN      | Route                                                                  |
| -------- | ---------------------------------------------------------------------- |
| `015009` | `/facility/cms/015009/burns-nursing-home-inc`                          |
| `055223` | `/facility/cms/055223/san-jacinto-valley-post-acute`                   |
| `155805` | `/facility/cms/155805/addison-pointe-health-and-rehabilitation-center` |

## What Ask still has to add

A Senior assertion verifier (`senior_origin`), admission of `senior` at the two
stage operations, a binding resolver for `senior / cms_facility / <CCN>` that
holds exactly one accepted binding, and the source-callback calls to Senior.

## Tests

`npm run check:mth-sen-001` — protocol and gate (15) and device-mode toggle (8).
