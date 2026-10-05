# Texas HHSC location layer: production execution receipt

Executed 2026-09-30 19:59 UTC against Supabase project `wiuiwgbablgyssuxrjho` after Founder GO and Evidence certification of `e565dcf950d096a91de5bbe162df927a5ed90b08`.

The three official HHSC downloads were fetched again immediately before execution. Their bytes and SHA-256 hashes matched the certified packet:

| Source            | Rows | SHA-256                                                            |
| ----------------- | ---: | ------------------------------------------------------------------ |
| ICFIID.xlsx       |  708 | `20548d8398104d2a882cd018fff31786ccc77c4412b6874d5e1fada31ca02ab1` |
| DAHS.xlsx         |  389 | `ec962e57112d6600b4deec292eaee5e0620e70b5413eea71d52078a3c4dcba8f` |
| dahs_issonly.xlsx |  743 | `1de6e81addd37ea016be4c2cdbd50a08648f2348c694ef0e4d9eee0eee1bd381` |

The exact certified transaction in `tx-idr2-load.psql` was submitted as Supabase migration `tx_hhsc_location_idr2_20260930`; its two local `\copy` transport lines were replaced with equivalent in-transaction `INSERT INTO` statements containing the pinned CSV values. Preflight, table definitions, ownership checks, insert statements, and postflight checks otherwise remained unchanged. The migration returned `success: true`.

| Receipt                         | Result |
| ------------------------------- | -----: |
| ICF_IID_SOURCE_ROWS             |    708 |
| DAHS_SOURCE_ROWS                |    389 |
| IN_HOME_SOURCE_ROWS             |    743 |
| TOTAL_SOURCE_LOCATIONS          |   1840 |
| LICENSE_OBSERVATIONS            |   1786 |
| PREFLIGHT_ALREADY_PRESENT       |      0 |
| LOCATIONS_INSERTED              |   1840 |
| LICENSE_OBSERVATIONS_INSERTED   |   1786 |
| SKIPPED_ALREADY_PRESENT         |      0 |
| DUPLICATE_NAMESPACED_KEYS       |      0 |
| CROSS_CLASS_COLLISIONS          |      0 |
| CANONICAL_ORGANIZATIONS_CREATED |      0 |
| ERRORS                          |      0 |
| ROLLBACK_TARGET_PROVEN          |    YES |

Post-load read-only inspection confirmed exactly 1,840 batch locations and 1,786 batch license observations, by class 708/389/743 and 654/389/743. All location keys are unique and conform to `TX|HHSC|<class>|<Facility ID>`. Every location has the certified class-specific source hash, `organization_id IS NULL`, and `public_eligible=false`. Facility ID `112184` is absent. All license observations attach to locations with the same batch and source hash. The organization table had 205,082 rows both before and after execution.

The read-only rollback precondition query returned true for the batch counts, source hashes, null organization links, unpublished status, and license-to-location batch/hash linkage. Rollback was **not** executed. Evidence Activation should independently verify this live result before closing Texas Senior.
