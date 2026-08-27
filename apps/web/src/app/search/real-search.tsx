import Link from "next/link";
import { AgencyDirectoryCard } from "@/components/agency-directory-card";
import { RealProviderCard } from "@/components/real-provider";
import { RealDataNotice } from "@/components/evidence";
import { parseConsumerSearch } from "@/server/care/search-contract";
import { searchCurrentAgencies } from "@/server/care/agency-search";
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
  "GU",
  "MP",
  "PR",
  "VI",
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
  const parsed = parseConsumerSearch(params);
  const providerClass = parsed.providerClass;
  const isAgency = providerClass !== "nursing_home";
  let locationResolved = false;
  if (!isAgency && parsed.submitted && parsed.errors.length === 0 && parsed.criteria.zip) {
    const reference = await resolveZipLocation(parsed.criteria.zip);
    if (reference) {
      parsed.criteria.latitude = reference.latitude;
      parsed.criteria.longitude = reference.longitude;
      parsed.criteria.sort ??= "distance";
      locationResolved = true;
    }
  }
  const found =
    parsed.submitted && parsed.errors.length === 0 && !isAgency
      ? await searchProvidersConsumer(parsed.criteria)
      : [];
  const agencyFound =
    parsed.submitted && parsed.errors.length === 0 && isAgency
      ? await searchCurrentAgencies(parsed.agency)
      : [];
  const hasMore = isAgency ? agencyFound.length > 20 : found.length > 20;
  const results = found.slice(0, 20);
  const agencyResults = agencyFound.slice(0, 20);
  const classLabel =
    providerClass === "home_health"
      ? "Home Health agencies"
      : providerClass === "hospice"
        ? "Hospice providers"
        : "nursing homes";
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
        <h1>
          {providerClass === "home_health"
            ? "Find Home Health agencies"
            : providerClass === "hospice"
              ? "Find Hospice providers"
              : "Find nursing homes near you."}
        </h1>
        <p className="lede">
          Search current CMS directories without sales calls, paid placement, or a hidden ranking
          score. Provider classes stay separate.
        </p>
      </header>
      <div className="search-layout real-search-layout">
        <form className="search-panel" method="get" aria-label={`${classLabel} search`}>
          <input type="hidden" name="search" value="1" />
          <fieldset className="hub-class-fieldset">
            <legend>Provider class</legend>
            <div className="hub-class-options">
              {(
                [
                  ["nursing_home", "Nursing Homes"],
                  ["home_health", "Home Health"],
                  ["hospice", "Hospice"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="hub-class-option">
                  <input
                    type="radio"
                    name="class"
                    value={value}
                    defaultChecked={providerClass === value}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="field">
            <label htmlFor="real-q">
              {isAgency ? "Provider name or CMS CCN" : "Facility name or CMS provider ID"}{" "}
              <small>(optional)</small>
            </label>
            <input id="real-q" name="q" defaultValue={current(params, "q")} />
          </div>
          <fieldset>
            <legend>Location</legend>
            <div className="field">
              <label htmlFor="real-zip">{isAgency ? "Office ZIP" : "ZIP code"}</label>
              <input
                id="real-zip"
                name="zip"
                inputMode="numeric"
                maxLength={5}
                defaultValue={current(params, "zip")}
              />
            </div>
            <p className="filter-note">
              {isAgency
                ? "Office city and state from the CMS directory. This is not a service area."
                : "Or search by city and state."}
            </p>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="real-city">City</label>
                <input id="real-city" name="city" defaultValue={current(params, "city")} />
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
            {!isAgency ? (
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
            ) : null}
          </fieldset>
          {isAgency ? (
            <details className="search-advanced">
              <summary>Evidence availability</summary>
              <div className="filter-row">
                {providerClass === "home_health" ? (
                  <div className="field">
                    <label htmlFor="real-hhstar">CMS Quality of Patient Care star</label>
                    <select id="real-hhstar" name="hhstar" defaultValue={current(params, "hhstar")}>
                      <option value="">Any / not used as a ranking</option>
                      {[5, 4, 3, 2, 1].map((value) => (
                        <option key={value} value={value}>
                          {value} CMS stars
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor="real-quality">Quality evidence</label>
                  <select
                    id="real-quality"
                    name="quality"
                    defaultValue={current(params, "quality")}
                  >
                    <option value="">Any</option>
                    <option value="yes">Available</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="real-experience">
                    {providerClass === "home_health" ? "HHCAHPS" : "CAHPS Hospice"} evidence
                  </label>
                  <select
                    id="real-experience"
                    name="experience"
                    defaultValue={current(params, "experience")}
                  >
                    <option value="">Any</option>
                    <option value="yes">Available</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="real-owned">Ownership evidence</label>
                  <select id="real-owned" name="owned" defaultValue={current(params, "owned")}>
                    <option value="">Any</option>
                    <option value="yes">Available</option>
                  </select>
                </div>
              </div>
            </details>
          ) : (
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
          )}
          {!isAgency ? (
            <div className="field">
              <label htmlFor="real-sort">Sort results</label>
              <select id="real-sort" name="sort" defaultValue={current(params, "sort")}>
                <option value="">Automatic: distance for ZIP, name otherwise</option>
                <option value="distance">Distance</option>
                <option value="name">Facility name</option>
                <option value="cms-overall-desc">CMS overall rating — highest first</option>
              </select>
            </div>
          ) : (
            <p className="filter-note">
              Results are listed alphabetically by provider name, then CMS CCN. Exact identifier
              matches appear first. This is not a quality ranking.
            </p>
          )}
          <button className="button button--primary" type="submit">
            {providerClass === "home_health"
              ? "Search Home Health agencies"
              : providerClass === "hospice"
                ? "Search Hospice providers"
                : "Search nursing homes"}
          </button>
        </form>
        <section className="results" aria-labelledby="real-results-title">
          <div className="results__header">
            <div>
              <p className="eyebrow">
                {isAgency ? "Current CMS directory" : "CMS Provider Information"}
              </p>
              <h2 id="real-results-title">
                {parsed.submitted
                  ? locationResolved
                    ? `Nursing homes within ${radius} miles of ${parsed.criteria.zip}`
                    : parsed.criteria.state
                      ? `${classLabel} with an office address in ${parsed.criteria.state}`
                      : "Search results"
                  : "Start with a name or location"}
              </h2>
            </div>
            {parsed.submitted && (
              <strong aria-live="polite">
                {isAgency ? agencyResults.length : results.length}
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
            !isAgency &&
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
          {isAgency
            ? agencyResults.map((provider) => (
                <AgencyDirectoryCard key={provider.ccn} provider={provider} />
              ))
            : results.map((provider) => (
                <RealProviderCard
                  key={provider.ccn}
                  provider={provider}
                  compareCcns={results.slice(0, 2).map((item) => item.ccn)}
                  workspaceEnabled={isFamilyComparisonWorkspaceEnabled()}
                />
              ))}
          {parsed.submitted &&
            parsed.errors.length === 0 &&
            (isAgency ? agencyResults.length : results.length) === 0 && (
              <div className="empty-state">
                <h3>
                  {locationResolved
                    ? `No nursing homes were found within ${radius} miles of ${parsed.criteria.zip}.`
                    : providerClass === "home_health"
                      ? "No current CMS Home Health providers matched this search."
                      : providerClass === "hospice"
                        ? "No current CMS Hospice providers matched this search."
                        : "No facility matched that search."}
                </h3>
                <p>
                  {isAgency
                    ? "Try part of the provider name, another office city or state, or a different provider class. Unrelated providers are not recommended automatically."
                    : "Try part of the facility name, add a city and state, or expand the distance."}
                </p>
                {isAgency ? (
                  <p>
                    <Link className="text-link" href="/search?class=nursing_home">
                      Search Nursing Homes
                    </Link>
                    {" · "}
                    <Link className="text-link" href="/search">
                      Clear search
                    </Link>
                  </p>
                ) : null}
                {locationResolved && radius < 100 && (
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
        {isAgency
          ? "Home Health and Hospice location search uses the CMS directory office address. Office ZIP is not CMS ZIP coverage evidence, and coverage records are not a verified service area. Search pages are not an index of every profile for external search engines."
          : "ZIP-area searches use the representative point for the corresponding 2025 Census ZIP Code Tabulation Area. ZCTAs approximate USPS ZIP service areas; not every USPS ZIP has a ZCTA."}
      </p>
    </>
  );
}
