# SeniorTrustHub specialist execution V2

Contract: `trusthub-specialist-execution-v2`

Endpoints:

- `GET /api/specialist-execution/v2` returns the capability manifest.
- `GET /api/specialist-execution/v2?...` executes URL-encoded structured parameters.
- `POST /api/specialist-execution/v2` executes a JSON request.

The adapter reuses the accepted Senior query engine and public-provider gates. It does not duplicate CMS data, write to the database, expand publication, or combine Nursing Home, Home Health, and Hospice totals.

## Request

```json
{
  "providerClass": "nursing_home",
  "geography": { "type": "state", "value": "FL" },
  "filters": { "overallStars": [4, 5] },
  "page": 1
}
```

`providerClass` is one of `nursing_home`, `home_health`, or `hospice`. An exact six-character CMS CCN may instead be supplied as `identifier`. Geography supports state, city, ZIP, and the class-specific county rules below. Page size is a bounded 20 rows; `page` is 1 through 500.

Source-native filters are deliberately narrow:

- Nursing Home: CMS overall, staffing, and health-inspection ratings.
- Home Health: CMS Quality of Patient Care rating.
- Hospice: no overall-star filter; Hospice quality and CAHPS remain distinct evidence families.

Unknown request fields fail closed. Ranking, “best,” accreditation, proprietary scores, and consumer-quality filters are not accepted.

## Geography contract

| Class        | Supported geography      | Meaning                                |
| ------------ | ------------------------ | -------------------------------------- |
| Nursing Home | state, county, city, ZIP | CMS provider recorded address/location |
| Home Health  | state, city, ZIP         | CMS office recorded address/location   |
| Hospice      | state, county, city, ZIP | CMS office recorded address/location   |

Home Health county requests return HTTP 422 `unsupported_home_health_county_geography`. Recorded provider or office geography is never represented as service area, availability, or coverage.

## Response

Executable requests return:

- `contract`, `hub`, and `status`;
- `queryInterpretation`;
- `resultType` (`cohort` or `identity`);
- bounded `rows` with class, name, CMS CCN, recorded location, source-native evidence, and canonical public profile URL;
- class-specific `total` and `pagination`;
- `availableRefinements`;
- source provenance and limitations.

Rows remain class-specific. Nursing Home evidence may include CMS overall, staffing, inspection ratings, and ownership category. Home Health and Hospice rows expose only the evidence families already supported by their own snapshots. CMS measures are not TrustHub ratings or recommendations.

## Errors

- 400: malformed input, unknown field, invalid identifier/geography/filter/page.
- 413: request body above 16 KiB.
- 422: syntactically valid but unsupported source capability.
- 503: backend execution unavailable.
- 200 with `total=0`: supported query with no matching public rows.

Errors include a stable `errorCode`. They are distinct from zero rows and backend failure.

## Deep links

Every row contains its canonical public profile URL. Stable profile-section anchors are not currently contracted, so this API does not invent staffing, inspection, ownership, penalty, or rating anchors.

## Golden requests

```json
{ "providerClass": "nursing_home", "geography": { "type": "state", "value": "FL" } }
{ "providerClass": "nursing_home", "geography": { "type": "county", "value": "Palm Beach" } }
{ "providerClass": "home_health", "geography": { "type": "state", "value": "FL" } }
{ "providerClass": "hospice", "geography": { "type": "state", "value": "FL" } }
{ "identifier": "105502" }
```

CCN `105502` is an exact-identity probe, not a guaranteed current result. If it is absent from the current accepted directories, the contract truthfully returns zero rows.

“Best nursing home” remains a fail-closed natural-language request on `/api/ask`: SeniorTrustHub can expose source-native CMS comparison measures but does not choose a winner or create a ranking.

## Timeouts and availability

Callers should impose a bounded timeout and treat 503 or network failure as specialist unavailability. A failure must not be converted into zero providers. The public SeniorTrustHub profiles remain independent of this adapter.
