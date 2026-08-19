import Link from "next/link";
import {
  ASSISTED_LIVING_SEARCH_PATH,
  CONSUMER_CATEGORY_LABELS,
  type AssistedLivingPublicProvider,
} from "@care/domain";
import { RealDataNotice } from "./evidence";
import {
  AssistedLivingCard,
  AssistedLivingCoverageNote,
  AssistedLivingInspectionGap,
} from "./assisted-living-provider";

const PILOT_STATES = [
  { code: "CA", label: "California" },
  { code: "NY", label: "New York" },
  { code: "TX", label: "Texas" },
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

function current(params: URLSearchParams, key: string): string {
  return params.get(key) ?? "";
}

export function AssistedLivingSearch({
  searchParams,
  results,
  total,
  hasMore,
  page,
  workspaceEnabled,
}: {
  searchParams: SearchParams;
  results: readonly AssistedLivingPublicProvider[];
  total: number;
  hasMore: boolean;
  page: number;
  workspaceEnabled: boolean;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const submitted = params.get("search") === "1";
  const pageHref = (next: number) => {
    const copy = new URLSearchParams(params);
    copy.set("page", String(next));
    return `${ASSISTED_LIVING_SEARCH_PATH}?${copy}`;
  };
  return (
    <>
      <RealDataNotice />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Assisted living research</p>
        <h1>Research assisted living in California, New York, and Texas.</h1>
        <p className="lede">
          Search state-licensed residential care using official regulator listings. This is not a
          national directory and it does not score providers.
        </p>
        <AssistedLivingCoverageNote />
        <AssistedLivingInspectionGap />
      </header>
      <div className="search-layout real-search-layout">
        <form className="search-panel" method="get" aria-label="Assisted living search">
          <input type="hidden" name="search" value="1" />
          <div className="field">
            <label htmlFor="al-state">State</label>
            <select id="al-state" name="state" defaultValue={current(params, "state")}>
              <option value="">All pilot states</option>
              {PILOT_STATES.map((state) => (
                <option key={state.code} value={state.code}>
                  {state.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="al-city">City</label>
            <input id="al-city" name="city" defaultValue={current(params, "city")} />
          </div>
          <div className="field">
            <label htmlFor="al-zip">ZIP code</label>
            <input
              id="al-zip"
              name="zip"
              inputMode="numeric"
              maxLength={5}
              defaultValue={current(params, "zip")}
            />
          </div>
          <div className="field">
            <label htmlFor="al-category">Care category</label>
            <select id="al-category" name="category" defaultValue={current(params, "category")}>
              <option value="">All published categories</option>
              {Object.entries(CONSUMER_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="check-row" htmlFor="al-memory">
            <input
              id="al-memory"
              type="checkbox"
              name="memory"
              value="1"
              defaultChecked={current(params, "memory") === "1"}
            />
            Explicit memory / dementia designation only
          </label>
          <p className="filter-note">
            Memory-supportive results require an official regulator designation. Facility names are
            not used.
          </p>
          <button className="button button--primary" type="submit">
            Search assisted living
          </button>
        </form>
        <section className="results" aria-labelledby="al-results-title">
          <div className="results__header">
            <div>
              <p className="eyebrow">State regulator listings</p>
              <h2 id="al-results-title">
                {submitted ? "Search results" : "Choose a state, city, ZIP, or category"}
              </h2>
            </div>
            {submitted ? (
              <strong aria-live="polite">
                {results.length}
                {hasMore || total > results.length ? ` of ${total}` : ""} shown
              </strong>
            ) : null}
          </div>
          {results.map((provider) => (
            <AssistedLivingCard
              key={provider.id}
              provider={provider}
              workspaceEnabled={workspaceEnabled}
            />
          ))}
          {submitted && results.length === 0 ? (
            <div className="empty-state">
              <h3>No published assisted-living providers matched those filters.</h3>
              <p>Try another city or ZIP, or remove the memory-care filter.</p>
            </div>
          ) : null}
          {(page > 1 || hasMore) && (
            <nav className="pagination" aria-label="Assisted living result pages">
              {page > 1 ? (
                <Link className="button button--quiet" href={pageHref(page - 1)}>
                  Previous
                </Link>
              ) : null}
              <span>Page {page}</span>
              {hasMore ? (
                <Link className="button button--quiet" href={pageHref(page + 1)}>
                  Next
                </Link>
              ) : null}
            </nav>
          )}
        </section>
      </div>
    </>
  );
}
