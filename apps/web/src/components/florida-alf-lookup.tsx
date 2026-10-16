import Link from "next/link";
import {
  FLORIDA_ALF_COUNTY_UNRECORDED,
  FLORIDA_ALF_LOOKUP_PATH,
  type FloridaAlfLookupQuery,
  type FloridaAlfLookupResult,
} from "@care/domain";

export function FloridaAlfLookup({
  query,
  result,
  cohortCount,
  countyState,
  countyOptions,
  countyBlocked,
}: {
  query: FloridaAlfLookupQuery;
  result: FloridaAlfLookupResult;
  cohortCount: number;
  countyState: "ready" | "unavailable" | "unrecorded";
  countyOptions: readonly string[];
  countyBlocked: boolean;
}) {
  const heading =
    result.status === "browse"
      ? "Published assisted-living records"
      : result.status === "match"
        ? "Matching published assisted-living records"
        : "No published assisted-living record matched";

  return (
    <div className="national-hub florida-intel">
      <header className="page-intro">
        <p className="eyebrow">Florida assisted living</p>
        <h1>Florida assisted-living records</h1>
        <p className="lede">
          Look up one of the {cohortCount} published Phase 1 Florida assisted-living records by
          facility name or AHCA file number. This page does not list every CURRENT assisted-living
          identity. It does not include nursing homes, home health, hospice, or adult family care.
        </p>
        <p>
          <Link href="/florida">Florida senior care research</Link>
        </p>
      </header>

      <form
        className="search-panel"
        method="get"
        action={FLORIDA_ALF_LOOKUP_PATH}
        aria-label="Published assisted-living lookup"
      >
        <div className="field">
          <label htmlFor="alf-name">Facility name</label>
          <input
            id="alf-name"
            name="name"
            defaultValue={query.name}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <div className="field">
          <label htmlFor="alf-file">AHCA file number</label>
          <input
            id="alf-file"
            name="file"
            defaultValue={query.file}
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {countyState === "ready" ? (
          <div className="field">
            <label htmlFor="alf-county">Facility county</label>
            <select id="alf-county" name="county" defaultValue={query.county}>
              <option value="">All recorded facility counties</option>
              {countyOptions.map((county) => (
                <option key={county} value={county}>
                  {county}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <button className="button button--primary" type="submit">
          Look up record
        </button>
      </form>

      {countyState === "unavailable" ? (
        <p className="hub-stat__note" role="status">
          Facility county could not be loaded for this request. Search by facility name or AHCA file
          number.
        </p>
      ) : null}
      {countyState === "unrecorded" ? (
        <p className="hub-stat__note">
          No facility county was recorded for these published records in the acquired AHCA sources.
        </p>
      ) : null}

      <section aria-labelledby="alf-results-title">
        <h2 id="alf-results-title">{countyBlocked ? "Facility county is unavailable" : heading}</h2>
        {countyBlocked ? (
          <p role="status">
            This request asked for a facility county, and that field did not load. No county match
            is shown. Search by facility name or AHCA file number.
          </p>
        ) : null}
        {!countyBlocked && result.status === "none" ? (
          <p role="status">
            No published assisted-living record matched this facility name, AHCA file number, and
            facility county together.
          </p>
        ) : null}
        {!countyBlocked && result.records.length > 0 ? (
          <div className="hub-table-scroll">
            <table className="hub-table">
              <caption>
                {result.status === "browse"
                  ? `${cohortCount} published Phase 1 assisted-living records. Listed by facility name. This is not a ranking.`
                  : "Published assisted-living records that matched this lookup. Listed by facility name. This is not a ranking."}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Facility</th>
                  <th scope="col">AHCA file number</th>
                  <th scope="col">Facility county</th>
                </tr>
              </thead>
              <tbody>
                {result.records.map((record) => (
                  <tr key={record.providerId}>
                    <td>
                      <Link href={record.path}>{record.officialName}</Link>
                    </td>
                    <td>{record.ahcaFileNumber}</td>
                    <td>
                      {record.facilityCounties.length > 0
                        ? record.facilityCounties.join(", ")
                        : FLORIDA_ALF_COUNTY_UNRECORDED}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="alf-limits-title">
        <h2 id="alf-limits-title">What the facility record shows</h2>
        <p>
          Open a record to see its raw AHCA license status, licensing dates, and the regulatory
          evidence connected to that AHCA file number. Inspection, deficiency, complaint-triggered
          inspection, final order, and fine stay separate. A complaint-triggered inspection does not
          establish a substantiated violation.
        </p>
        <p>
          CURRENT means the provider appears in the FloridaHealthFinder Active/Open locator. It does
          not mean good standing. No connected Florida regulatory event observed in the acquired
          AHCA sources is not a clean record, not “no violations,” and not proof of absence.
        </p>
        <p className="hub-stat__note">
          Facility county is the acquired AHCA facility county. It is kept separate from the mailing
          address and the field office. The facility record keeps the source links, dates, and raw
          status.
        </p>
      </section>
    </div>
  );
}
