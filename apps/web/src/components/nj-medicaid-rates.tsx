"use client";

import { useMemo, useState } from "react";
import rateRows from "@/data/nj-medicaid-rate-rows.json";

type RateRow = { name: string; subtype: string; rate: number };

const rows = rateRows as RateRow[];

export function NjMedicaidRates({
  listedRows,
  minRate,
  maxRate,
  effectiveOn,
}: {
  listedRows: number;
  minRate: number;
  maxRate: number;
  effectiveOn: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => `${row.name} ${row.subtype}`.toLowerCase().includes(needle));
  }, [query]);

  return (
    <section aria-labelledby="nj-medicaid-title">
      <div className="section-heading">
        <p className="eyebrow">NJMMIS assisted-living rates</p>
        <h2 id="nj-medicaid-title">Listed daily rates, not quality and not participation</h2>
        <p>
          {listedRows.toLocaleString("en-US")} printed rows on the SFY 2026 schedule, effective{" "}
          {effectiveOn}. Listed daily rates range from ${minRate.toFixed(1)} to $
          {maxRate.toFixed(1)}. A listed row is not inferred Medicaid participation elsewhere and is
          not a quality score. A default unlisted rate is not participation. Name-only rows are not
          attached to facility profiles.
        </p>
      </div>
      <form className="search-panel" onSubmit={(event) => event.preventDefault()}>
        <div className="field">
          <label htmlFor="nj-rate-q">Filter listed providers</label>
          <input
            id="nj-rate-q"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </form>
      <div className="hub-table-scroll">
        <table className="hub-table hub-table--compact">
          <caption>Official NJMMIS listed assisted-living daily rate rows</caption>
          <thead>
            <tr>
              <th scope="col">Printed name</th>
              <th scope="col">Printed subtype</th>
              <th scope="col">Daily rate</th>
              <th scope="col">Identity</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <tr key={`${row.name}-${row.subtype}-${row.rate}`}>
                <th scope="row">{row.name}</th>
                <td>
                  {row.subtype === "UNKNOWN_NOT_PRINTED"
                    ? "Not printed on the schedule"
                    : row.subtype}
                </td>
                <td>${row.rate.toFixed(1)}</td>
                <td>Schedule row only — not profile-attached</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
