# SeniorTrustHub launch rollback

Rollback is non-destructive and leaves all official evidence intact.

1. Set `CARE_ENABLE_PUBLIC_LAUNCH=false` in Vercel Production to restore global noindex behavior and stop canonical/redirect activation.
2. Disable `CARE_ENABLE_TRUST_PARTICIPATION`, then the evidence flags, if a narrower rollback is needed. `CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE=false` removes state-license sections without affecting CMS pages or Google enrichment.
3. Promote the last known-good Vercel deployment or use Vercel's deployment rollback.
4. Confirm `robots.txt` disallows crawling and public smoke tests no longer expose the affected feature.
5. Do not roll back by deleting database rows, raw releases, snapshots, provenance, or trust audit events.
