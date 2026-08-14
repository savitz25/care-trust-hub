import { RealProviderCard } from "@/components/real-provider";
import { parseConsumerSearch } from "@/server/care/search-contract";
import { searchProvidersConsumer } from "@/server/care/repository";

type SearchParams = Record<string, string | string[] | undefined>;

function toUrlSearchParams(values: SearchParams): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") params.set(key, value);
  }
  return params;
}

function current(params: URLSearchParams, key: string): string {
  return params.get(key) ?? "";
}

export async function RealSearch({ searchParams }: { searchParams: SearchParams }) {
  const params = toUrlSearchParams(searchParams);
  const parsed = parseConsumerSearch(params);
  const results =
    parsed.submitted && parsed.errors.length === 0
      ? await searchProvidersConsumer(parsed.criteria)
      : [];
  const compareCcns = results.slice(0, 2).map((provider) => provider.ccn);

  return (
    <>
      <div className="real-data-notice" role="note">
        <strong>Controlled real CMS data review</strong>
        <span>
          This feature is not publicly activated. Results come from the current validated CMS
          Provider Information release.
        </span>
      </div>
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Facility research</p>
        <h1>Find nursing homes through published CMS evidence.</h1>
        <p className="lede">
          Search without sales calls, paid placement, or a hidden ranking score.
        </p>
      </header>
      <div className="search-layout real-search-layout">
        <form className="search-panel" method="get" aria-label="Real CMS provider search">
          <input type="hidden" name="search" value="1" />
          <div className="field">
            <label htmlFor="real-q">Provider name or CMS ID</label>
            <input id="real-q" name="q" defaultValue={current(params, "q")} />
          </div>
          <div className="filter-row">
            <div className="field">
              <label htmlFor="real-city">City</label>
              <input id="real-city" name="city" defaultValue={current(params, "city")} />
            </div>
            <div className="field">
              <label htmlFor="real-state">State</label>
              <input
                id="real-state"
                name="state"
                maxLength={2}
                defaultValue={current(params, "state")}
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="real-zip">ZIP (exact match)</label>
            <input
              id="real-zip"
              name="zip"
              inputMode="numeric"
              maxLength={5}
              defaultValue={current(params, "zip")}
            />
          </div>
          <details className="search-advanced">
            <summary>Optional evidence and radius filters</summary>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="real-overall">CMS overall rating</label>
                <select id="real-overall" name="overall" defaultValue={current(params, "overall")}>
                  <option value="">Any</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="real-staffing">Staffing rating</label>
                <select
                  id="real-staffing"
                  name="staffing"
                  defaultValue={current(params, "staffing")}
                >
                  <option value="">Any</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="real-inspection">Health inspection rating</label>
                <select
                  id="real-inspection"
                  name="inspection"
                  defaultValue={current(params, "inspection")}
                >
                  <option value="">Any</option>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} stars
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="real-ownership">Ownership descriptor contains</label>
                <input
                  id="real-ownership"
                  name="ownership"
                  defaultValue={current(params, "ownership")}
                />
              </div>
            </div>
            <div className="filter-row">
              <div className="field">
                <label htmlFor="real-medicare">Medicare participation</label>
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
                <label htmlFor="real-medicaid">Medicaid participation</label>
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
            <fieldset>
              <legend>Radius from known coordinates</legend>
              <p className="filter-note">
                No geocoder is used. Enter all three values to search by radius.
              </p>
              <div className="filter-row">
                <div className="field">
                  <label htmlFor="real-lat">Latitude</label>
                  <input
                    id="real-lat"
                    name="lat"
                    inputMode="decimal"
                    defaultValue={current(params, "lat")}
                  />
                </div>
                <div className="field">
                  <label htmlFor="real-lon">Longitude</label>
                  <input
                    id="real-lon"
                    name="lon"
                    inputMode="decimal"
                    defaultValue={current(params, "lon")}
                  />
                </div>
              </div>
              <div className="field">
                <label htmlFor="real-radius">Radius in miles</label>
                <input
                  id="real-radius"
                  name="radius"
                  inputMode="decimal"
                  defaultValue={current(params, "radius")}
                />
              </div>
            </fieldset>
          </details>
          <div className="field">
            <label htmlFor="real-sort">Sort results</label>
            <select id="real-sort" name="sort" defaultValue={current(params, "sort")}>
              <option value="">Automatic (name or distance)</option>
              <option value="name">Facility name</option>
              <option value="cms-overall-desc">CMS overall rating (highest first)</option>
              <option value="distance">Distance (requires radius inputs)</option>
            </select>
          </div>
          <button className="button button--primary" type="submit">
            Search CMS providers
          </button>
          <p className="filter-note">
            Maximum 25 results. ZIP search is exact until an approved geocoding source is added.
          </p>
        </form>
        <section className="results" aria-labelledby="real-results-title">
          <div className="results__header">
            <div>
              <p className="eyebrow">CMS Provider Information</p>
              <h2 id="real-results-title">
                {parsed.submitted ? "Search results" : "Start with a name or location"}
              </h2>
            </div>
            {parsed.submitted && <strong aria-live="polite">{results.length} results</strong>}
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
          {results.map((provider) => (
            <RealProviderCard key={provider.ccn} provider={provider} compareCcns={compareCcns} />
          ))}
          {parsed.submitted && parsed.errors.length === 0 && results.length === 0 && (
            <div className="empty-state">
              <h3>No CMS providers matched</h3>
              <p>Try fewer filters, a facility-name fragment, or a state search.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
