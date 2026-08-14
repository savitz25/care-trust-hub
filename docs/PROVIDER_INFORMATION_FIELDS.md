# CMS Provider Information field contract

Status: implemented contract for transformation `provider-information-v2`. Definitions are based on the official CMS Nursing Home Provider Information data dictionary and the verified July 2026 CSV. The original source row is always retained; this contract does not replace CMS documentation.

## Field categories

- **A. Identity / locator:** CCN, immutable release identity, physical CSV row plus CCN locator.
- **B. Facility description:** provider name and legal business name.
- **C. Geography:** address, city, state, ZIP, county, latitude, and longitude.
- **D. Participation / certification:** published `Provider Type` and deterministic Medicare/Medicaid flags derived from its verified CMS categories.
- **E. Capacity:** number of certified beds.
- **F. Ownership descriptors:** CMS `Ownership Type` text. This is not an ownership graph.
- **G. CMS rating / quality:** overall, health-inspection, staffing, and quality-measure ratings.
- **H. Staffing summaries:** only the published staffing rating is normalized. Hours and turnover remain raw-only.
- **I. Inspection / enforcement summaries:** raw-only; dedicated source ingestion is required before consumer use.
- **J. Administrative / metadata:** processing date remains in normalized attributes and the raw row, but is not treated as an observation date.
- **K. Not yet normalized:** chain fields, councils, special-focus/abuse indicators, staffing hours, turnover, case-mix and adjusted staffing, survey cycles, deficiency summaries, fine/payment-denial summaries, footnotes, and other administrative fields.

## Normalized fields

| Normalized field           | Exact CMS column                 | Meaning                                            | Database target                              | Raw → normalized            | Missing                       | Validation                            | Consumer use                         |
| -------------------------- | -------------------------------- | -------------------------------------------------- | -------------------------------------------- | --------------------------- | ----------------------------- | ------------------------------------- | ------------------------------------ |
| `ccn`                      | `CMS Certification Number (CCN)` | CMS-issued provider identifier                     | `provider_identifier.identifier_value`       | text → exact text           | Rejected                      | Six uppercase alphanumeric characters | Suitable with source context         |
| `provider_name`            | `Provider Name`                  | Name in the CMS provider record                    | `facility_snapshot.provider_name`            | text → trimmed text         | Rejected                      | Nonempty                              | Suitable                             |
| `legal_business_name`      | `Legal Business Name`            | Legal business name in the CMS record              | `facility_snapshot.legal_business_name`      | text → nullable text        | `NULL`                        | Trim only                             | Context only                         |
| `address`                  | `Provider Address`               | Published street address                           | `facility_snapshot.address`                  | text → nullable text        | `NULL`                        | Trim only                             | Suitable                             |
| `city`                     | `City/Town`                      | Published city or town                             | `facility_snapshot.city`                     | text → nullable text        | `NULL`                        | Trim only                             | Suitable                             |
| `state`                    | `State`                          | State or territory code                            | `facility_snapshot.state_code`               | text → uppercase text       | Rejected                      | Allowlisted code                      | Suitable                             |
| `zip_code`                 | `ZIP Code`                       | Published postal ZIP                               | `facility_snapshot.zip_code`                 | text → five-digit base ZIP  | Rejected                      | ZIP or ZIP+4                          | Suitable; raw retains ZIP+4          |
| `county`                   | `County/Parish`                  | Published county/parish                            | `facility_snapshot.county_name`              | text → nullable text        | `NULL`                        | Trim only                             | Suitable                             |
| `telephone`                | `Telephone Number`               | Published facility telephone                       | `facility_snapshot.telephone`                | text → nullable exact text  | `NULL`                        | No semantic reformatting              | Suitable with freshness              |
| `latitude`                 | `Latitude`                       | CMS-published geocoded latitude                    | `facility_snapshot.source_latitude`          | text → nullable float       | `NULL`                        | −90 through 90                        | Geographic use                       |
| `longitude`                | `Longitude`                      | CMS-published geocoded longitude                   | `facility_snapshot.source_longitude`         | text → nullable float       | `NULL`                        | −180 through 180                      | Geographic use                       |
| `location`                 | Derived from latitude/longitude  | PostGIS point preserving source coordinates        | `facility_snapshot.location`                 | two floats → geography      | `NULL` unless both exist      | WGS84/SRID 4326                       | Internal lookup                      |
| `certified_beds`           | `Number of Certified Beds`       | CMS-certified bed count                            | `facility_snapshot.certified_beds`           | text → nullable integer     | `NULL`                        | Nonnegative                           | Suitable with date/source            |
| `ownership_type`           | `Ownership Type`                 | CMS ownership-category description                 | `facility_snapshot.ownership_type`           | text → nullable text        | `NULL`                        | Preserve text                         | Suitable; not parent ownership proof |
| `participation_type`       | `Provider Type`                  | Published Medicare/Medicaid participation category | `facility_snapshot.participation_type`       | text → nullable text        | `NULL`                        | Preserve CMS text                     | Suitable with explanation            |
| `participates_medicare`    | Derived from `Provider Type`     | CMS category includes Medicare                     | `facility_snapshot.participates_medicare`    | category → nullable boolean | `NULL` if absent/unrecognized | Known-category mapping                | Suitable with derivation label       |
| `participates_medicaid`    | Derived from `Provider Type`     | CMS category includes Medicaid                     | `facility_snapshot.participates_medicaid`    | category → nullable boolean | `NULL` if absent/unrecognized | Known-category mapping                | Suitable with derivation label       |
| `overall_rating`           | `Overall Rating`                 | CMS overall five-star rating                       | `facility_snapshot.overall_rating`           | text → nullable smallint    | `NULL`                        | 1–5                                   | Sourced CMS dimension only           |
| `health_inspection_rating` | `Health Inspection Rating`       | CMS health-inspection rating                       | `facility_snapshot.health_inspection_rating` | text → nullable smallint    | `NULL`                        | 1–5                                   | Sourced CMS dimension only           |
| `staffing_rating`          | `Staffing Rating`                | CMS staffing rating                                | `facility_snapshot.staffing_rating`          | text → nullable smallint    | `NULL`                        | 1–5                                   | Sourced CMS dimension only           |
| `quality_measure_rating`   | `QM Rating`                      | CMS quality-measure rating                         | `facility_snapshot.quality_measure_rating`   | text → nullable smallint    | `NULL`                        | 1–5                                   | Sourced CMS dimension only           |

No combination of these dimensions is a proprietary score or ranking.

## Date semantics

- `source_period`: period explicitly represented by CMS, when provided; otherwise `NULL`.
- `source_modified_at`: CMS metadata `modified`. The legacy release key stores its date form.
- `published_at` in manifests / `source_published_at` in PostgreSQL: CMS metadata `released` when captured. The existing July 2026 manifest predates this field, so this remains unknown locally rather than being reconstructed manually.
- `retrieved_at`: when this system retrieved the exact bytes.
- `observed_at` / `effective_at`: only populated when a defensible record-level date exists. This contract does not infer one.
- `Processing Date`: retained as administrative metadata, not promoted to `observed_at`.

The eventual **“CMS data updated …”** label should use `source_modified_at`, explicitly identify it as CMS's source update date, and separately expose publication/retrieval details. It must not imply an inspection or facility observation occurred that day.
