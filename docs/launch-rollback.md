# SeniorTrustHub launch rollback

Rollback is non-destructive and leaves all official evidence intact.

1. Set `CARE_ENABLE_PUBLIC_LAUNCH=false` in Vercel Production to restore global noindex behavior and stop canonical/redirect activation.
2. Disable `CARE_ENABLE_TRUST_PARTICIPATION`, then the evidence flags, if a narrower rollback is needed. `CARE_ENABLE_STATE_REGULATORY_INTELLIGENCE=false` removes state-license sections without affecting CMS pages or Google enrichment. `CARE_ENABLE_FACILITY_HISTORY=false` removes the derived timeline without changing CMS evidence. `CARE_ENABLE_STATE_ENFORCEMENT_INTELLIGENCE=false` hides state enforcement/inspection history while leaving CMS history and state-license sections in place. `CARE_ENABLE_OWNERSHIP_INTELLIGENCE_V2=false` hides the ownership summary/portfolio layer without removing the existing CMS ownership party list. `CARE_ENABLE_CARE_NEEDS_NAVIGATOR=false` hides the Care Needs Navigator without affecting facility evidence. `CARE_ENABLE_SENIOR_CARE_COST_PLANNER=false` hides the Cost Planner without affecting the Navigator or facility evidence.
3. If database pages fail after a pooler change, set `CARE_DATABASE_POOL_MODE=session` and redeploy to restore the previous session-pooler URL behavior, or promote the last known-good Vercel deployment.
4. Confirm `robots.txt` disallows crawling and public smoke tests no longer expose the affected feature.
5. Do not roll back by deleting database rows, raw releases, snapshots, provenance, or trust audit events.
