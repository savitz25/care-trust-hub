# Texas HHSC regulated locations: publication P1 review packet

Source authority: Evidence-verified production batch `TH-ENRICH-TX-SENIOR-2026-09-30-IDR2` from receipt `3dcc676`. This branch changes web retrieval and presentation only. No production data, schema, organization, or deployment setting was changed.

## Grain and gate

The location identity is `TX|HHSC|<class>|<Facility ID>`. ICF/IID, DAHS, and in-home-only remain separate. A bare Facility ID is searchable only within this Texas HHSC lookup; it is never joined to CMS or used as a global identity. No canonical organization route is generated.

The server-side gate is **off by default**. Future activation requires both `CARE_ENABLE_REAL_PROVIDER_UI=true` and `CARE_ENABLE_TX_HHSC_LOCATION_BATCH=TH-ENRICH-TX-SENIOR-2026-09-30-IDR2`. This ticket does **not** set either production value. With the gate off, the Texas lookup and profile routes return 404 and the Texas batch contributes zero results to Ask.

For local simulation, `NODE_ENV=development` with `CARE_TX_HHSC_SIMULATE_BATCH=true` loads a snapshot derived from the certified CSV. It cannot activate in production mode. The simulated gate exposes 1,840 locations, with 1,786 license numbers, split 708 ICF/IID, 389 DAHS, and 743 in-home-only. The preview fixture has no organization data. The live-gate database query is bounded by the exact batch and revalidates counts, namespaced keys, official source hashes and URLs, source date, null organization links, unpublished storage status, and license linkage before returning any location. Any mismatch fails closed.

The P1 Vercel deployment is SSO protected: an unauthenticated request redirects to `vercel.com/sso-api`. The certified fixture is also available only when Vercel reports `VERCEL_ENV=preview` and the exact Git owner, repository, and `th-tx-senior-publish-p1` branch. Production and other preview branches remain off. No Vercel project setting, credential, or production environment variable was changed.

## Surfaces

- `/texas/regulated-locations`: dedicated name, Facility ID, city, county, ZIP, and provider-class lookup. Counts are labelled **regulated locations**, never organizations.
- `/texas/regulated-locations/<class>/<Facility ID>`: regulated location/provider profile with HHSC authority, identity, address, raw license and certification facts, number when present, source date and link, and `Organization linkage: Not established`.
- `/ask` and `/api/ask`: explicitly Texas HHSC location queries return source-grain results and links, without claiming a CMS CCN or parent corporation. The CMS specialist query contract remains separate.
- `/texas`: the lookup link appears only when the gate is on.

All routes are noindex. Existing `/search` CMS business/facility results and canonical organization tables are untouched.

## Preview and QA

Loopback-only local preview: `http://127.0.0.1:3100/texas/regulated-locations` with `CARE_TX_HHSC_SIMULATE_BATCH=true`. This is a local development preview, not a public deployment. Representative profiles: ICF/IID `003868` (license number), ICF/IID `007606` (no license number), DAHS `110993`, and in-home-only `110784`.

Protected Founder preview: `https://care-trust-hub-git-th-tx-senior-publish-p1-savitz25-s-projects.vercel.app/texas/regulated-locations` (Vercel SSO required).

Captured review views: [desktop lookup](tx-idr2-preview-lookup-desktop.png), [mobile lookup](tx-idr2-preview-lookup-mobile.png), and [mobile profile without a reported license number](tx-idr2-preview-no-license-mobile.png).

Verification: TypeScript typecheck, targeted ESLint, and four gate/identity tests passed. Browser checks at 390px and 1440px showed the lookup and representative profiles without error overlays. Ask returned 708 ICF/IID location results at the correct grain. With the gate off, the lookup and profile both returned 404. The fixture has 1,840 unique namespaced keys, so duplicate search results are zero. Canonical organization count change is zero by construction: the web code executes SELECT only and creates no organization route or database row.

Founder review remains required before any production deployment or gate activation. Evidence Activation can independently inspect the branch and repeat the local simulation.
