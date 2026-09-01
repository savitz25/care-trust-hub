# SeniorTrustHub canonical source audit

Audit date: 2026-09-01. Repository: `savitz25/care-trust-hub`. This is a source-control reconciliation audit; it performs no database writes.

## Refs and topology

- `origin/main`: `b8204392deb42074cdb4beffcea50c94f7880270`
- `origin/fl-sen-002-schema-foundation`: `bcc85359c82fe8c3d2c54b9fa7847e7fe7aad590`
- merge base: `b8204392deb42074cdb4beffcea50c94f7880270`
- main-only commits after merge base: zero
- branch-only commits: 32
- current Production deployment: `dpl_J3qRmTa3dYJtYDTcrRa8GcPYhXea`
- Production SHA/ref: `ee62e1f234c6f9767ffa198b07b602149061ada8` / `fl-sen-002-schema-foundation`
- branch head deployment: Preview `dpl_AL541iwXmxB7TDb7Y6oMdNZEJm1S`, READY; not Production

`main` is a strict ancestor. The feature branch contains the complete deployed source line plus the reviewed Senior Ask merge. There are no divergent main commits and no unknown branch commits.

## Commit classification

| Commit    | Classification              | Accepted purpose                                                              |
| --------- | --------------------------- | ----------------------------------------------------------------------------- |
| `3e71c06` | ACCEPTED_PRODUCTION         | Nursing-home evidence completion                                              |
| `687c27f` | ACCEPTED_PRODUCTION         | CMS refresh governance/check-only scheduler                                   |
| `fca7395` | ACCEPTED_PRODUCTION         | Gated durable-worker discovery write path                                     |
| `5ab37e6` | ACCEPTED_PRODUCTION         | Home Health and Hospice evidence spines                                       |
| `a97fc2c` | ACCEPTED_PRODUCTION         | Time-aware owner/operator graph                                               |
| `874c76f` | ACCEPTED_PRODUCTION         | Nursing-home CHOW events/timeline                                             |
| `e189a3a` | ACCEPTED_PRODUCTION         | National Senior intelligence snapshot                                         |
| `ab4d6bb` | ACCEPTED_PRODUCTION         | Class-aware provider-intelligence contract                                    |
| `1302000` | ACCEPTED_PRODUCTION         | Nursing-home profile provider-intelligence rendering                          |
| `015af3c` | ACCEPTED_PRODUCTION         | Nursing-home mobile/title correction                                          |
| `4519c8b` | ACCEPTED_PRODUCTION         | Profile narrow-layout containment                                             |
| `49b3c07` | ACCEPTED_PRODUCTION         | Profile descendant wrapping                                                   |
| `6467fe0` | ACCEPTED_PRODUCTION         | Profile word-boundary wrapping                                                |
| `4caa659` | ACCEPTED_PRODUCTION         | Class-separated Home Health/Hospice profile UI                                |
| `78176ed` | ACCEPTED_PRODUCTION         | Controlled Home Health/Hospice indexation                                     |
| `374bcd9` | ACCEPTED_PRODUCTION         | National Senior intelligence surface                                          |
| `302d565` | ACCEPTED_PRODUCTION         | National table mobile containment                                             |
| `2f97326` | ACCEPTED_PRODUCTION         | Home Health/Hospice directory search                                          |
| `fb5f601` | ACCEPTED_PRODUCTION         | Class-separated research landings                                             |
| `8c1800f` | ACCEPTED_PRODUCTION         | Home Health/Hospice landing indexation                                        |
| `e1f47cd` | ACCEPTED_PRODUCTION         | Florida multi-class schema foundation                                         |
| `154bcf6` | ACCEPTED_PRODUCTION         | Florida status/external-key tightening                                        |
| `e0411e3` | ACCEPTED_PRODUCTION         | Florida bounded intelligence page                                             |
| `94eaf9e` | ACCEPTED_PRODUCTION         | CMS star-table accessibility caption                                          |
| `a2e5b53` | ACCEPTED_PRODUCTION         | Florida page indexing/sitemap acceptance                                      |
| `a65c9d3` | ACCEPTED_PRODUCTION         | Controlled Florida ALF/AFCH cohort                                            |
| `d88920b` | ACCEPTED_PRODUCTION         | Senior national homepage intelligence                                         |
| `84f694b` | ACCEPTED_PRODUCTION         | Raw-evidence deployment exclusion                                             |
| `c7e92bd` | ACCEPTED_PRODUCTION         | Homepage mobile overflow correction                                           |
| `65fe179` | ACCEPTED_PRODUCTION         | Homepage grid overflow correction                                             |
| `ee62e1f` | ACCEPTED_PRODUCTION         | Finding-table narrow-layout containment; current Production                   |
| `bcc8535` | ACCEPTED_NOT_YET_PRODUCTION | Reviewed/merged PR #6 structured Senior Ask engine and public-safe `/api/ask` |

No commits are classified EXPERIMENTAL, OBSOLETE, or UNKNOWN.

## Reconciliation decision

Create a normal PR from this reconciliation branch (the accepted branch head plus this audit) into `main`. Do not force-push or cherry-pick. After regression and Preview gates pass, merge to make `main` the canonical complete source line and require the Git-integrated Production deployment to use the merge SHA from `main`.
