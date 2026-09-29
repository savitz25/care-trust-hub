import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/maryland-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/maryland");
  return {
    title: { absolute: "Maryland Senior Care Licenses | SeniorTrustHub" },
    description:
      "Maryland OHCQ statewide assisted living, long term care, home health, hospice and adult medical day care license directories, with source dates and evidence limits.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default async function MarylandPage({
  searchParams,
}: {
  searchParams: Promise<{ license?: string }>;
}) {
  const params = await searchParams;
  const license =
    typeof params.license === "string" && /^[A-Z0-9-]{2,30}$/i.test(params.license)
      ? params.license.trim().toUpperCase()
      : "";
  const matches = license
    ? snapshot.rows.filter((row) => row.license.toUpperCase() === license).slice(0, 20)
    : [];
  const n = (x: number) => x.toLocaleString("en-US");
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="md-title">
        <p className="eyebrow">Maryland senior care research</p>
        <h1 id="md-title">Maryland OHCQ Facility Licenses</h1>
        <p className="home-hero__lede">
          The Maryland Department of Health Office of Health Care Quality (OHCQ) publishes statewide
          directories for distinct care settings. Each count below is a row count for its named
          class, not a combined senior facility total or a live license status.
        </p>
      </section>
      <section aria-labelledby="md-roster">
        <h2 id="md-roster">Statewide facility directories</h2>
        <p>
          Each source is an official downloadable OHCQ workbook. The sheet name supplies its own
          date. These directories do not print an individual status or expiration date; verify
          current licensure with OHCQ. Repeated numbers remain repeated rows.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>OHCQ facility rows by exact directory class</caption>
            <thead>
              <tr>
                <th scope="col">Class and workbook</th>
                <th scope="col">Rows</th>
                <th scope="col">Distinct printed licenses</th>
                <th scope="col">Source sheet</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sources.map((source) => (
                <tr key={source.class}>
                  <th scope="row">
                    <a href={source.url}>{source.class}</a>
                  </th>
                  <td>{n(source.rows)}</td>
                  <td>{n(source.distinctLicenses)}</td>
                  <td>{source.sheet}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Assisted Living Programs have 1,673 source rows and 1,672 distinct printed license
          numbers. Long Term Care Facilities have 221 rows; one row lacks a license number. Hospices
          have 28 rows and 27 distinct printed numbers. The source does not explain duplicate
          numbers, so rows are not assumed to be unique facilities.
        </p>
        <form action="/maryland">
          <label htmlFor="md-license">Exact printed Maryland license number</label>{" "}
          <input
            id="md-license"
            name="license"
            defaultValue={license}
            placeholder="Enter full number"
          />{" "}
          <button type="submit">Find in snapshot</button>
        </form>
        {license && (
          <div aria-live="polite">
            {matches.length ? (
              <ul>
                {matches.map((row, i) => (
                  <li key={`${row.class}-${row.license}-${i}`}>
                    {row.name} â€” {row.class}; license {row.license}; {row.city}
                    {row.capacity !== null ? `; capacity ${row.capacity}` : ""}
                    {row.levelOfCare ? `; ${row.levelOfCare}` : ""}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No matching row in these five directories. Absence does not establish that a
                provider is unlicensed.
              </p>
            )}
          </div>
        )}
      </section>
      <section aria-labelledby="md-cms">
        <h2 id="md-cms">State license and CMS certification</h2>
        <p>
          OHCQ license numbers in these five directories are separate from CMS certification numbers
          (CCNs). The workbooks print no CCN, so exact state-to-CMS bridges are{" "}
          {snapshot.cmsExactBridges}; this does not mean there is no real-world overlap. The
          existing <Link href="/">CMS nursing home, home health and hospice evidence</Link> remains
          separate. No name-only joins or duplicate canonical facilities were created.
        </p>
      </section>
      <section aria-labelledby="md-surveys">
        <h2 id="md-surveys">Inspections and surveys</h2>
        <p>
          OHCQ points to{" "}
          <a href="https://health.maryland.gov/ohcq/Pages/Long-Term-Care-Consumer-Resources.aspx">
            nursing home deficiency reports in Marylandâ€™s Long Term Care Consumer Guide
          </a>
          . A clean statewide Maryland inspection index was NOT_ACQUIRED; standalone inspection rows
          and state-license attachments are NOT_ACQUIRED, not zero inspections. Existing CMS survey
          evidence is separate.
        </p>
      </section>
      <section aria-labelledby="md-actions">
        <h2 id="md-actions">Enforcement and complaints</h2>
        <p>
          OHCQ publishes a{" "}
          <a href="https://health.maryland.gov/ohcq/Pages/Notice-of-Final-Action.aspx">
            Notice of Final Action for assisted living providers
          </a>{" "}
          that describes sanction types. A clean 2022â€“2026 provider-level action corpus with exact
          licenses was NOT_ACQUIRED. Enforcement capability is PARTIAL; enforcement rows and exact
          attachments are NOT_ACQUIRED. No adverse event was joined by name.
        </p>
        <p>
          OHCQ{" "}
          <a href="https://health.maryland.gov/ohcq/Pages/File-a-Complaint.aspx">
            accepts facility and program complaints
          </a>{" "}
          through an online form. Intake is KNOWN; provider-level complaint rows are NOT_ACQUIRED
          and outcomes are REQUEST_ONLY. A complaint is not a final finding.
        </p>
      </section>
      <section aria-labelledby="md-provenance">
        <h2 id="md-provenance">Source clocks and limits</h2>
        <p>
          Each workbook date appears above. HTTP source modification dates range across 3 September
          2026; retrieved {snapshot.retrievedAt}. Facility status dates and license expirations are
          not printed. Inspection and enforcement dates are not represented by the roster clock. The
          page build date is separate from all source dates.
        </p>
        <p>
          Other settings, including Residential Service Agencies and Limited Hospice Care Programs,
          were not included in these class counts. No statewide combined senior total, quality
          ranking or facility recommendation is offered. Graph writes: {snapshot.graphWrites}; new
          canonical facilities: {snapshot.newCanonicalFacilities}; claim eligibility changes:{" "}
          {snapshot.claimEligibilityChanges}.
        </p>
      </section>
    </div>
  );
}
