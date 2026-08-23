import Link from "next/link";
import {
  parseSeniorAskSearchContext,
  serializeAskSearchContext,
  titleCaseSlug,
} from "@care/domain";
import { AskHandoffBanner } from "@/components/ask-handoff-banner";
import { RealProviderCard } from "@/components/real-provider";
import { RealDataNotice } from "@/components/evidence";
import { criteriaFromAskContext, parseConsumerSearch } from "@/server/care/search-contract";
import { resolveZipLocation, searchProvidersConsumer } from "@/server/care/repository";
import { isFamilyComparisonWorkspaceEnabled } from "@/server/care/feature-flags";

type SearchParams = Record<string, string | string[] | undefined>;
const states = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "DC",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
];
const radii = [10, 25, 50, 100];

function toParams(values: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (typeof value === "string") params.set(key, value);
  return params;
}
const current = (params: URLSearchParams, key: string) => params.get(key) ?? "";

export async function RealSearch({ searchParams }: { searchParams: SearchParams }) {
  const params = toParams(searchParams);
  const ask = parseSeniorAskSearchContext(searchParams);
  const askActive = Boolean(ask && !ask.unsupported && ask.entityType === "nursing_facility");
  const parsed = parseConsumerSearch(params);
  if (askActive && ask) {
    const pageValue = Number(params.get("page") ?? "1");
    parsed.submitted = true;
    parsed.errors = [];
    parsed.criteria = criteriaFromAskContext(ask, pageValue);
  }
  let locationResolved = false;
  if (
    !askActive &&
    parsed.submitted &&
    parsed.errors.length === 0 &&
    parsed.criteria.zip
  ) {
    const reference = await resolveZipLocation(parsed.criteria.zip);
    if (reference) {
      parsed.criteria.latitude = reference.latitude;
      parsed.criteria.longitude = reference.longitude;
      parsed.criteria.sort ??= "distance";
      locationResolved = true;
    }
  }
  const found =
    parsed.submitted && parsed.errors.length === 0
      ? await searchProvidersConsumer(parsed.criteria)
      : [];
  const hasMore = found.length > 20;
  const results = found.slice(0, 20);
  const page = Math.floor((parsed.criteria.offset ?? 0) / 20) + 1;
  const pageHref = (next: number) => {
    const copy = new URLSearchParams(params);
    copy.set("page", String(next));
    return `/search?${copy}`;
  };
  const radius = parsed.criteria.radiusMiles ?? 25;
  return (
    <>
      <RealDataNotice />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Find care</p>
        <h1>Find nursing homes near you.</h1>
        <p className="lede">
          Search without sales calls, paid placement, or a hidden ranking score.
        </p>
      </header>
      <div className="search-layout real-search-layout">
        <form className="search-panel" method="get" aria-label="Nursing home search">
          <input type="hidden" name="search" value="1" />
          {askActive && ask ? (
            <>
              <input type="hidden" name="src" value="ask" />
              {ask.entityType ? <input type="hidden" name="entity" value={ask.entityType} /> : null}
              {ask.category ? <input type="hidden" name="category" value={ask.category} /> : null}
              {ask.journey ? <input type="hidden" name="journey" value={ask.journey} /> : null}
              {ask.intent ? <input type="hidden" name="intent" value={ask.intent} /> : null}
              {ask.sid ? <input type="hidden" name="sid" value={ask.sid} /> : null}
              {ask.county ? <input type="hidden" name="county" value={ask.county} /> : null}
              <input type="hidden" name="sort" value="name" />
            </>
          ) : null}
          <div className="field">
            <label htmlFor="real-q">
              Facility name or CMS provider ID <small>(optional)</small>
            </label>
            <input id="real-q" name="q" defaultValue={current(params, "q")} />
          </div>
          <fieldset>
            <legend>Location</legend>
            <div className="field">
              <label htmlFor="real-zip">ZIP code</label>
              <input
                id="real-zip"
                name="zip"
                inputMode="numeric"
                maxLength={5}
                defaultValue={current(params, "zip")}
              />
            </div>
            <p className="filter-note">Or search by city and state.</p>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="real-city">City</label>
                <input
                  id="real-city"
                  name="city"
                  defaultValue={
                    askActive && ask?.city ? titleCaseSlug(ask.city) : current(params, "city")
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="real-state">State</label>
                <select id="real-state" name="state" defaultValue={current(params, "state")}>
                  <option value="">Select state</option>
                  {states.map((state) => (
                    <option key={state}>{state}</option>
                  ))}
                </select>
              </div>
            </div>
            {askActive ? null : (
              <div className="field">
                <label htmlFor="real-radius">Distance</label>
                <select
                  id="real-radius"
                  name="radius"
                  defaultValue={current(params, "radius") || "25"}
                >
                  {radii.map((value) => (
                    <option key={value} value={value}>
                      {value} miles
                    </option>
                  ))}
                </select>
              </div>
            )}
          </fieldset>
          {askActive && ask ? <AskHandoffBanner context={ask} resultCount={results.length} /> : null}
          <details className="search-advanced">
            <summary>More filters</summary>
            <div className="filter-row">
              {[
                ["overall", "CMS overall rating"],
                ["staffing", "CMS staffing rating"],
                ["inspection", "CMS health inspection rating"],
              ].map(([name, label]) => (
                <div className="field" key={name}>
                  <label htmlFor={`real-${name}`}>{label}</label>
                  <select id={`real-${name}`} name={name} defaultValue={current(params, name)}>
                    <option value="">Any</option>
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} stars
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="real-medicare">Medicare</label>
                <select
                  id="real-medicare"
                  name="medicare"
                  defaultValue={current(params, "medicare")}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="real-medicaid">Medicaid</label>
                <select
                  id="real-medicaid"
                  name="medicaid"
                  defaultValue={current(params, "medicaid")}
                >
                  <option value="">Any</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>
          </details>
          {askActive ? null : (
            <div className="field">
              <label htmlFor="real-sort">Sort results</label>
              <select id="real-sort" name="sort" defaultValue={current(params, "sort")}>
                <option value="">Automatic: distance for ZIP, name otherwise</option>
                <option value="distance">Distance</option>
                <option value="name">Facility name</option>
                <option value="cms-overall-desc">CMS overall rating — highest first</option>
              </select>
            </div>
          )}
          <button className="button button--primary" type="submit">
            Search nursing homes
          </button>
        </form>
        <section className="results" aria-labelledby="real-results-title">
          <div className="results__header">
            <div>
              <p className="eyebrow">CMS Provider Information</p>
              <h2 id="real-results-title">
                {parsed.submitted
                  ? locationResolved
                    ? `Nursing homes within ${radius} miles of ${parsed.criteria.zip}`
                    : "Search results"
                  : "Start with a name or location"}
              </h2>
            </div>
            {parsed.submitted && (
              <strong aria-live="polite">
                {results.length}
                {hasMore ? "+" : ""} shown
              </strong>
            )}
          </div>
          {parsed.errors.length > 0 && (
            <div className="empty-state" role="alert">
              <h3>Check the search fields</h3>
              <ul>
                {parsed.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}
          {parsed.submitted &&
            parsed.criteria.zip &&
            !locationResolved &&
            parsed.errors.length === 0 && (
              <div className="methodology-note" role="status">
                <strong>This ZIP area could not be resolved geographically.</strong>
                <p>
                  Exact facility ZIP matches are shown when available. Try a city and state or
                  another nearby ZIP.
                </p>
              </div>
            )}
          {results.map((provider) => (
            <RealProviderCard
              key={provider.ccn}
              provider={provider}
              compareCcns={results.slice(0, 2).map((item) => item.ccn)}
              workspaceEnabled={isFamilyComparisonWorkspaceEnabled()}
              hrefSuffix={askActive && ask ? serializeAskSearchContext(ask) : undefined}
            />
          ))}
          {parsed.submitted && parsed.errors.length === 0 && results.length === 0 && (
            <div className="empty-state">
              <h3>
                {locationResolved
                  ? `No nursing homes were found within ${radius} miles of ${parsed.criteria.zip}.`
                  : "No facility matched that search."}
              </h3>
              <p>
                {askActive
                  ? "No CMS-certified nursing facility matched this exact physical location. We did not widen the search to another city, county, or care type."
                  : "Try part of the facility name, add a city and state, or expand the distance."}
              </p>
              {!askActive && locationResolved && radius < 100 && (
                <Link
                  className="button button--secondary"
                  href={(() => {
                    const copy = new URLSearchParams(params);
                    copy.set("radius", String(radius === 10 ? 25 : radius === 25 ? 50 : 100));
                    return `/search?${copy}`;
                  })()}
                >
                  Expand search distance
                </Link>
              )}
            </div>
          )}
          {(page > 1 || hasMore) && (
            <nav className="pagination" aria-label="Search result pages">
              {page > 1 && (
                <Link className="button button--quiet" href={pageHref(page - 1)}>
                  Previous
                </Link>
              )}
              <span>Page {page}</span>
              {hasMore && (
                <Link className="button button--quiet" href={pageHref(page + 1)}>
                  Load 20 more
                </Link>
              )}
            </nav>
          )}
        </section>
      </div>
      <p className="methodology-note">
        ZIP-area searches use the representative point for the corresponding 2025 Census ZIP Code
        Tabulation Area. ZCTAs approximate USPS ZIP service areas; not every USPS ZIP has a ZCTA.
      </p>
    </>
  );
}
