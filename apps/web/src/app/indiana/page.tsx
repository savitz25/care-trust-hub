import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/indiana-public-snapshot.json";

const names: Record<string, string> = {
  "comprehensive-care": "Comprehensive Care facility",
  "residential-care": "Residential Care facility",
  "home-health-agency": "Home Health Agency",
  hospice: "Hospice",
};
const LICENSE = /^\d{2}-\d{6}-\d$/;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/indiana");
  return {
    title: { absolute: "Indiana Senior Care Licenses | SeniorTrustHub" },
    description:
      "Indiana Department of Health statewide Comprehensive Care, Residential Care, Home Health Agency and Hospice license directories, with bed capacity, printed expirations, source clocks and evidence limits.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

type Props = { searchParams: Promise<{ license?: string }> };

export default async function IndianaPage({ searchParams }: Props) {
  const n = (value: number) => value.toLocaleString("en-US");
  const raw = (await searchParams).license?.trim() ?? "";
  const license = LICENSE.test(raw) ? raw : null;
  const matches = license ? snapshot.rows.filter((row) => row.license === license) : [];
  const cc = snapshot.sources.find((s) => s.class === "comprehensive-care")!;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="in-title">
        <p className="eyebrow">Indiana senior care research</p>
        <h1 id="in-title">Indiana Department of Health Facility Directories</h1>
        <p className="home-hero__lede">
          The Indiana Department of Health (IDOH), through Health Care Regulatory Services, licenses
          and surveys long-term care facilities, home health agencies and hospices. It posts a
          separate statewide directory for each license class. Counts below are directory rows for
          each exact class. They are not one combined senior facility total or a live license-status
          determination.
        </p>
      </section>
      <section aria-labelledby="in-rosters">
        <h2 id="in-rosters">Statewide license directories</h2>
        <p>
          Indiana licenses <strong>Comprehensive Care</strong> facilities (nursing facilities, 410
          IAC 16.2) and <strong>Residential Care</strong> facilities as separate classes.
          &ldquo;Assisted living&rdquo; is not the state license class name, so residential care is
          not relabeled here. Each directory states its own &ldquo;posted to the web&rdquo; date.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>IDOH directory rows by license class</caption>
            <thead>
              <tr>
                <th scope="col">Official directory</th>
                <th scope="col">Rows</th>
                <th scope="col">Distinct license numbers</th>
                <th scope="col">Printed expiration already passed</th>
                <th scope="col">Posted to the web</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sources.map((source) => (
                <tr key={source.class}>
                  <th scope="row">
                    <a href={source.url}>{names[source.class]}</a>
                  </th>
                  <td>{n(source.rows)}</td>
                  <td>{n(source.distinctLicenses)}</td>
                  <td>{n(source.rowsPrintedExpirationPassed)}</td>
                  <td>{source.postedToWeb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Each row prints a license number and license expiration date. A printed expiration is not
          a current-status finding: verify with IDOH before relying on a listing. The Home Health
          Agency directory has 361 rows; 17 print no license number or a non-standard one, 12 print
          no expiration, and 27 print an expiration date that had already passed when retrieved.
          Those rows are kept as printed, not corrected. One license number is printed for both a
          Comprehensive Care facility and an unrelated hospice; the rows stay separate.
        </p>
      </section>
      <section aria-labelledby="in-beds">
        <h2 id="in-beds">Comprehensive Care bed capacity</h2>
        <p>
          The Comprehensive Care directory prints licensed bed capacity and a bed breakdown for
          every facility: {n(cc.bedCapacity ?? 0)} beds across {n(cc.rows)} facilities.{" "}
          {n(cc.rowsWithResidentialBeds ?? 0)} of them also hold residential (RES) beds. These are
          licensed beds, not occupancy or availability.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Licensed beds by printed bed type</caption>
            <thead>
              <tr>
                {Object.keys(cc.beds ?? {}).map((k) => (
                  <th key={k} scope="col">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {Object.entries(cc.beds ?? {}).map(([k, v]) => (
                  <td key={k}>{n(v)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="in-lookup" id="lookup">
        <h2 id="in-lookup">Check an exact license number</h2>
        <form action="/indiana#lookup">
          <label htmlFor="license">IDOH license number (for example 26-002549-1)</label>{" "}
          <input id="license" name="license" defaultValue={license ?? ""} inputMode="numeric" />{" "}
          <button type="submit">Check</button>
        </form>
        {raw && !license ? (
          <p>
            Use the full printed license number with dashes; partial or bare numbers are not
            matched.
          </p>
        ) : null}
        {license ? (
          matches.length ? (
            <ul>
              {matches.map((row) => (
                <li key={`${row.class}-${row.name}`}>
                  {names[row.class]}: {row.name}, {row.city}. Printed expiration{" "}
                  {row.expires ?? "not printed"}
                  {"bedCapacity" in row && row.bedCapacity
                    ? `; ${n(row.bedCapacity)} licensed beds`
                    : ""}
                  .
                </li>
              ))}
            </ul>
          ) : (
            <p>
              {license} is not in these directory snapshots. That is not a finding about the
              facility; confirm with IDOH.
            </p>
          )
        ) : null}
      </section>
      <section aria-labelledby="in-cms">
        <h2 id="in-cms">State licenses and CMS certification</h2>
        <p>
          None of the IDOH directories print a CMS Certification Number (CCN), so exact state-to-CMS
          bridges: {snapshot.cmsExactBridges}. That is not a finding of zero federal overlap.
          Indiana CMS-certified nursing homes, home health agencies and hospices remain in the
          existing <Link href="/">CMS provider profiles</Link>, searched by CCN, with their own
          source clock. No name-only bridge was made and no new canonical facility was created.
        </p>
      </section>
      <section aria-labelledby="in-inspections">
        <h2 id="in-inspections">Inspections and regulatory actions</h2>
        <p>
          IDOH surveys comprehensive and residential care facilities under state rules and serves as
          the state survey agency for Medicare and Medicaid certification. A clean statewide index
          of state survey reports with dates and exact license numbers was NOT_ACQUIRED; inspection
          attachments: {snapshot.inspectionExactAttachments}. IDOH&apos;s nursing-home report-card
          scores are a ranking system and are not republished here.
        </p>
        <p>
          IDOH can take licensure actions against facilities. A bounded 2022–2026 statewide
          provider-level enforcement index with exact license numbers was NOT_ACQUIRED. Enforcement
          rows and exact adverse attachments are NOT_ACQUIRED, not zero actions. No adverse action
          was joined by name. A survey deficiency is not automatically a final sanction.
        </p>
      </section>
      <section aria-labelledby="in-complaints">
        <h2 id="in-complaints">Complaints</h2>
        <p>
          <a href="https://www.in.gov/health/cshcr/report-a-complaint/">
            IDOH&apos;s Healthcare Facility Complaint Program
          </a>{" "}
          accepts complaints about nursing homes, residential care providers, home health agencies
          and hospices. Intake is KNOWN. A provider-level public complaint corpus was NOT_ACQUIRED;
          outcomes are REQUEST_ONLY or NOT_ACQUIRED. A complaint is not a violation.
        </p>
      </section>
      <section aria-labelledby="in-clocks">
        <h2 id="in-clocks">Source clocks and limits</h2>
        <p>
          Each directory&apos;s posting date is listed above (all four were posted{" "}
          {snapshot.sources[0].postedToWeb}); pages were retrieved on{" "}
          {snapshot.sources[0].retrievedAt.slice(0, 10)}. License expiration dates are individual
          printed fields, not a common status clock. No inspection or action date is inferred. The
          CMS spine has its own clock. Administrator names, street addresses and phone numbers in
          the source pages are not republished.
        </p>
        <p>
          Graph writes: {snapshot.graphWrites}; new canonical facilities:{" "}
          {snapshot.newCanonicalFacilities}; claim eligibility changes:{" "}
          {snapshot.claimEligibilityChanges}; name-only adverse joins:{" "}
          {snapshot.nameOnlyAdverseJoins}. No quality ranking, winner or combined class total is
          offered.
        </p>
      </section>
    </div>
  );
}
