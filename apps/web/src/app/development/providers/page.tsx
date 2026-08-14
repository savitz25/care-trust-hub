import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isDevelopmentDataEnabled } from "@/server/care/access";
import { searchProvidersDevelopmentOnly } from "@/server/care/repository";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Provider data inspection",
  robots: { index: false, follow: false },
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function value(input: string | string[] | undefined): string {
  return typeof input === "string" ? input : "";
}

export default async function DevelopmentProvidersPage({ searchParams }: Props) {
  if (!isDevelopmentDataEnabled()) notFound();
  const params = await searchParams;
  const query = value(params.q);
  const state = value(params.state);
  const city = value(params.city);
  const zip = value(params.zip);
  const results =
    query || state || city || zip
      ? await searchProvidersDevelopmentOnly({ query, state, city, zip, limit: 25 })
      : [];

  return (
    <main className="page-shell">
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Development only &middot; real CMS data</p>
        <h1>Provider read-model inspection</h1>
        <p className="lede">
          Private verification of approved fields. Raw records are never returned.
        </p>
      </header>
      <form className="search-panel" method="get">
        <label>
          Provider name or CCN
          <input name="q" defaultValue={query} />
        </label>
        <label>
          State
          <input name="state" defaultValue={state} maxLength={2} />
        </label>
        <label>
          City
          <input name="city" defaultValue={city} />
        </label>
        <label>
          ZIP
          <input name="zip" defaultValue={zip} inputMode="numeric" maxLength={5} />
        </label>
        <button className="button button--primary" type="submit">
          Search approved fields
        </button>
      </form>
      <section aria-labelledby="results-heading">
        <h2 id="results-heading">Results ({results.length}, maximum 25)</h2>
        <div className="result-list">
          {results.map((provider) => (
            <article className="facility-card" key={provider.ccn}>
              <p className="eyebrow">CMS CCN {provider.ccn}</p>
              <h3>{provider.providerName}</h3>
              <p>
                {[provider.location.city, provider.location.state, provider.location.zipCode]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p>Certified beds: {provider.certifiedBeds ?? "Not available in this CMS release"}</p>
              <Link href={`/development/providers/${provider.ccn}`}>Inspect mapped detail</Link>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
