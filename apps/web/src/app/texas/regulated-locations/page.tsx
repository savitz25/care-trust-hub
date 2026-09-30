import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  loadTxHhscLocations,
  searchTxHhscLocations,
  txHhscHref,
  TX_HHSC_CLASSES,
} from "@/server/care/tx-hhsc-locations";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Texas HHSC regulated locations | SeniorTrustHub",
  robots: { index: false, follow: false },
};

type Params = Record<string, string | string[] | undefined>;
const scalar = (p: Params, key: string) => (typeof p[key] === "string" ? (p[key] as string) : "");

export default async function TexasRegulatedLocations({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const all = await loadTxHhscLocations();
  if (!all.length) notFound();
  const p = await searchParams;
  const input = {
    q: scalar(p, "q"),
    providerClass: scalar(p, "class"),
    city: scalar(p, "city"),
    county: scalar(p, "county"),
    zip: scalar(p, "zip"),
    page: Number(scalar(p, "page")) || 1,
  };
  const found = searchTxHhscLocations(all, input);
  const nextHref = (page: number) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(input))
      if (v && k !== "providerClass" && k !== "page") s.set(k, String(v));
    if (input.providerClass) s.set("class", input.providerClass);
    s.set("page", String(page));
    return `/texas/regulated-locations?${s}`;
  };
  return (
    <main className="page-shell">
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Texas HHSC regulated locations</p>
        <h1>Find a regulated provider or location</h1>
        <p className="lede">
          Search the three Texas HHSC classes separately. These are regulator location records, not
          canonical organizations or CMS facilities.
        </p>
      </header>
      <form
        method="get"
        role="search"
        aria-label="Texas HHSC location lookup"
        className="search-panel"
      >
        <div className="field">
          <label htmlFor="tx-location-q">Provider name or Texas HHSC Facility ID</label>
          <input id="tx-location-q" name="q" defaultValue={input.q} />
        </div>
        <div className="field">
          <label htmlFor="tx-location-class">Provider class</label>
          <select id="tx-location-class" name="class" defaultValue={input.providerClass}>
            <option value="">All three classes</option>
            {Object.entries(TX_HHSC_CLASSES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tx-location-city">Recorded city</label>
          <input id="tx-location-city" name="city" defaultValue={input.city} />
        </div>
        <div className="field">
          <label htmlFor="tx-location-county">Recorded county</label>
          <input id="tx-location-county" name="county" defaultValue={input.county} />
        </div>
        <div className="field">
          <label htmlFor="tx-location-zip">Recorded ZIP</label>
          <input id="tx-location-zip" name="zip" defaultValue={input.zip} inputMode="numeric" />
        </div>
        <button className="button button--primary" type="submit">
          Find locations
        </button>
      </form>
      <section aria-live="polite">
        <h2>{found.count.toLocaleString()} regulated locations</h2>
        <p>Location records in this result; canonical organization count is separate.</p>
        <ul>
          {found.rows.map((row) => (
            <li key={row.namespaced_key}>
              <Link href={txHhscHref(row)}>{row.official_name}</Link>
              <br />
              {TX_HHSC_CLASSES[row.provider_class]} · Facility ID {row.facility_id} · {row.city},
              Texas · Facility Licensed: {row.facility_licensed_raw}
              {row.license_number
                ? ` · License ${row.license_number}`
                : " · No license number reported"}
            </li>
          ))}
        </ul>
        {found.page > 1 ? <Link href={nextHref(found.page - 1)}>Previous page</Link> : null}
        {found.page * 20 < found.count ? (
          <>
            {" "}
            · <Link href={nextHref(found.page + 1)}>Next page</Link>
          </>
        ) : null}
      </section>
    </main>
  );
}
