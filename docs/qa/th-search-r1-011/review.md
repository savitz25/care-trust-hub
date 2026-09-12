# Separate review pass

Method: self-review of the complete runtime diff plus automated behavioral/UI checks, not independent human review. Reviewed implementation `02aa6f46d044e3532e32564805cb91f3ec99442c` against `1d0e33deb30ac0e7ca07c7b9b4056553c0a8681d`.

Findings addressed before release:

- The API originally omitted the new facility answer in its explicit public projection; an API/common-boundary parity test caught this. Additive fields now carry the same answer and candidate state.
- Source failures and absent source releases must not become evidence absence or a CCN miss. Exact/name paths check the relevant source release, and loader errors remain unavailable.
- State words in provider names must not become geography predicates. Evidence-subject parsing applies place extraction only to structural location phrases.
- Name search caps must prevent false uniqueness; agency cap boundaries are included in hasMore. Ambiguous matches carry no evidence before selection.
- Candidate selection reruns name/class/location retrieval and exact CCN verification. Explicit names cannot be replaced through the provider-entry parameter. Profile questions are built after server canonical-provider resolution.
- The resolved result now retains location conflicts from exact lookup and actual class/source clocks in Trace. Incompatible evidence or rating overrides clarify rather than silently disappear.
- Generic care wording needed a pre-retrieval class decision; local browser testing found and verified this fix. The accepted class retains Austin/TX.
- Ownership category is explicitly a category; parties retain source-native roles. CHOW event dates and source clocks remain separate. No inferred owner, sale, misconduct or all-time clean history.
- Unlinked deficiencies must remain in the additive exact-provider projection. Existing report rendering and source queries stay intact.
- Missing evidence is not labeled available on candidate cards. Editing a question removes dependent identity-selection parameters; refresh/history retains a coherent selected task.
- Multiple CCNs or explicitly mixed classes cannot select the first facility for evidence. New regression assertions cover both.

Protected behavior: all R1-007 tests pass, including compound location filters, classes, typed ratings and header; full web/domain tests retain publication, state, claims/customer, metrics and SEO assertions. No dependency, schema, source ingestion, database write, account or publication-setting change. Illinois PR #33 remains another owner's assignment.

Remaining limitations: ownership relationships are not a resolved ultimate/legal-owner graph. Historical CHOW events remain source observations. The first Care Compare capture preceded script rendering. A bounded settled-browser check now shows the official provider-class page and correct title at the maintained URL; this is not a completed provider lookup. Parent Ask and other hubs are not edited or certified here.

Reconciliation review: Illinois main 72c1ddb was merged by its owner, then integrated normally. Reconciled runtime 41ee303 preserves its state distinctions and all published recovery destinations. Runtime merge c81b7ad is code-equivalent to the tested branch. CI web/ingest/migrations and Production browser/API proof pass.

Final guard review: cd0623215ed0c7dcd389815768d5b2d66e751fce was reviewed separately for polite/deictic facility-question precedence and quoted-name location boundaries. Five new regressions pass; all three destructive sensitivity mutations are detected and restored. The optimized local browser suite passed 34 cases, 16 flows and six supplements. PR #35 CI web/ingest/migrations, Vercel deployment, and the existing Vercel Agent Review check passed. The automated review produced no PR inline findings. This remains self-review plus automated review, not independent human review. Runtime merged normally as 02b1723b9e2b6fae5f7c90a181f5331d37d104d9.
