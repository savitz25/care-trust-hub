"use client";

import { useMemo, useState } from "react";
import inventoryPayload from "@/data/nj-facility-inventory.json";

export type NjInventoryRow = {
  source: "all_ltc" | "all_acute";
  name: string;
  type: string;
  typeKey: string;
  city: string | null;
  county: string | null;
  license: string | null;
  facId: string | null;
  address: string | null;
  zip: string | null;
};

const PAGE_SIZE = 25;
const payload = inventoryPayload as { asOf: string; rows: NjInventoryRow[] };

const CLASS_FILTERS = [
  { id: "all", label: "All listed identities" },
  { id: "all_ltc", label: "All_LTC only" },
  { id: "all_acute", label: "All_Acute only" },
  { id: "NJ_HHA", label: "Home Health Agency offices" },
  { id: "NJ_HOSPICE_PROGRAM", label: "Hospice Program" },
  { id: "NJ_HOSPICE_BRANCH", label: "Hospice Branch" },
  { id: "NJ_HOSPICE_INPATIENT", label: "Hospice Inpatient" },
] as const;

export function NjFacilityInventory({
  defaultCounty = "",
  lockCounty = false,
}: {
  defaultCounty?: string;
  lockCounty?: boolean;
} = {}) {
  const [query, setQuery] = useState("");
  const [county, setCounty] = useState(defaultCounty);
  const [klass, setKlass] = useState<(typeof CLASS_FILTERS)[number]["id"]>("all");
  const [page, setPage] = useState(0);

  const counties = useMemo(() => {
    const values = new Set<string>();
    for (const row of payload.rows) {
      if (row.county) values.add(row.county);
    }
    return [...values].sort((a, b) => a.localeCompare(b));
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return payload.rows.filter((row) => {
      if (klass === "all_ltc" && row.source !== "all_ltc") return false;
      if (klass === "all_acute" && row.source !== "all_acute") return false;
      if (klass.startsWith("NJ_") && row.typeKey !== klass) return false;
      if (county && row.county !== county) return false;
      if (!needle) return true;
      const hay =
        `${row.name} ${row.city ?? ""} ${row.license ?? ""} ${row.facId ?? ""} ${row.type}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [query, county, klass]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section aria-labelledby="nj-inventory-title">
      <div className="section-heading">
        <p className="eyebrow">Public facility inventory</p>
        <h2 id="nj-inventory-title">Licensed identities from NJDOH workbooks</h2>
        <p>
          {payload.rows.length.toLocaleString("en-US")} state source rows as of {payload.asOf}
          {lockCounty && defaultCounty
            ? `, filtered to ${defaultCounty} County physical location.`
            : "."}{" "}
          This is not one combined senior-provider denominator: All_LTC and All_Acute stay labeled.
          Rows are state-only. They are not CMS profile links unless an exact CCN join exists —
          none are activated in this snapshot.
        </p>
      </div>
      <form
        className="search-panel"
        onSubmit={(event) => event.preventDefault()}
        aria-label="Filter New Jersey facility inventory"
      >
        <div className="field">
          <label htmlFor="nj-inv-q">Name, city, license, or FacID</label>
          <input
            id="nj-inv-q"
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </div>
        {lockCounty ? null : (
          <div className="field">
            <label htmlFor="nj-inv-county">County (physical location)</label>
            <select
              id="nj-inv-county"
              value={county}
              onChange={(event) => {
                setCounty(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All 21 counties</option>
              {counties.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label htmlFor="nj-inv-class">Source / class</label>
          <select
            id="nj-inv-class"
            value={klass}
            onChange={(event) => {
              setKlass(event.target.value as (typeof CLASS_FILTERS)[number]["id"]);
              setPage(0);
            }}
          >
            {CLASS_FILTERS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </form>
      <p>
        Showing {visible.length.toLocaleString("en-US")} of{" "}
        {filtered.length.toLocaleString("en-US")} matching rows. Home Health offices are not service
        areas. Hospice Branch does not inherit a CCN from a Hospice Program.
      </p>
      <div className="hub-table-scroll">
        <table className="hub-table hub-table--compact">
          <caption>NJDOH licensed identities. State-only rows have no CMS profile link.</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Official type</th>
              <th scope="col">County</th>
              <th scope="col">City</th>
              <th scope="col">License</th>
              <th scope="col">FacID</th>
              <th scope="col">Source</th>
              <th scope="col">Profile</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={`${row.source}-${row.facId ?? row.license ?? row.name}`}>
                <th scope="row">{row.name}</th>
                <td>{row.type}</td>
                <td>{row.county ?? "Not reported"}</td>
                <td>{row.city ?? "Not reported"}</td>
                <td>{row.license ?? "Not reported"}</td>
                <td>{row.facId ?? "Not reported"}</td>
                <td>{row.source === "all_ltc" ? "All_LTC" : "All_Acute"}</td>
                <td>State-only</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <button
          type="button"
          className="button button--secondary"
          disabled={safePage === 0}
          onClick={() => setPage((value) => Math.max(0, value - 1))}
        >
          Previous
        </button>{" "}
        Page {safePage + 1} of {pageCount}{" "}
        <button
          type="button"
          className="button button--secondary"
          disabled={safePage + 1 >= pageCount}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </p>
    </section>
  );
}
