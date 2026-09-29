import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/wisconsin-public-snapshot.json";

const names: Record<string, string> = {
  "adult-family-home": "Adult Family Home (AFH)",
  "community-based-residential-facility": "Community-Based Residential Facility (CBRF)",
  "residential-care-apartment-complex": "Residential Care Apartment Complex (RCAC)",
  "nursing-home": "Nursing Home",
  hospice: "Hospice",
  "home-health-agency": "Home Health Agency",
};

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/wisconsin");
  return {
    title: { absolute: "Wisconsin Senior Care Licenses | SeniorTrustHub" },
    description:
      "Wisconsin DHS statewide AFH, CBRF, RCAC, nursing home, hospice and home health directories, with exact source clocks and evidence limits.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function WisconsinPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="wi-title">
        <p className="eyebrow">Wisconsin senior care research</p>
        <h1 id="wi-title">Wisconsin DHS Facility Directories</h1>
        <p className="home-hero__lede">
          Wisconsin Department of Health Services, Division of Quality Assurance (DQA), publishes
          separate statewide directories for six regulated care settings. Counts below are source
          rows for each exact class. They are not one combined senior facility total or a live
          license-status determination.
        </p>
      </section>
      <section aria-labelledby="wi-rosters">
        <h2 id="wi-rosters">Statewide provider directories</h2>
        <p>
          AFH, CBRF and RCAC are distinct Wisconsin assisted-living settings. RCAC certification and
          registration are separate source subclasses. Each workbook has its own source clock.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>DQA directory rows by provider class</caption>
            <thead>
              <tr>
                <th scope="col">Official directory</th>
                <th scope="col">Rows</th>
                <th scope="col">Distinct printed IDs</th>
                <th scope="col">Printed CMS identifiers</th>
                <th scope="col">Source modified</th>
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
                  <td>{n(source.rowsWithCcn)}</td>
                  <td>{source.httpLastModified ?? "Not supplied"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The directories print facility or license identifiers, but not a current status or
          expiration for every row. Check the current DQA{" "}
          <a href="https://www.dhs.wisconsin.gov/guide/provider-search.htm">Provider Search</a>{" "}
          before relying on an individual listing. Home Health Agency has 133 source rows and 127
          distinct printed license numbers; repeated licenses remain separate source rows.
        </p>
      </section>
      <section aria-labelledby="wi-cms">
        <h2 id="wi-cms">State licenses and CMS certification</h2>
        <p>
          The nursing-home, hospice and home-health workbooks print {n(snapshot.cmsSourceKeys)}
          six-digit CMS identifiers across their rows. Those exact source keys are preserved in the
          snapshot. No graph bridge to an existing <Link href="/">CMS provider profile</Link> was
          written; existing-profile matches were not resolved in this publication. New canonical
          facilities are zero. AFH, CBRF and RCAC workbooks do not print CCNs. No name-only bridge
          was made.
        </p>
      </section>
      <section aria-labelledby="wi-inspections">
        <h2 id="wi-inspections">Inspections and regulatory actions</h2>
        <p>
          DQA publishes an{" "}
          <a href={snapshot.surveyAdditionsSource.url}>
            assisted-living survey-document monthly additions workbook
          </a>
          . It has {n(snapshot.surveyAdditionsSource.rows)} document rows with a survey ID and
          letter type; {n(snapshot.surveyAdditionsSource.exactRosterMatches)} rows match an AFH,
          CBRF or RCAC directory by exact printed license. One row remains standalone. Letter types
          are preserved as printed, without treating them as final sanctions. This is a monthly
          document-additions index, not a complete statewide inspection census.
        </p>
        <p>
          <a href="https://www.dhs.wisconsin.gov/guide/provider-search.htm">DQA Provider Search</a>
          displays survey history on many provider detail pages. Wisconsin notes that nursing-home
          survey postings may be delayed during a CMS system transition. Inspection dates and
          outcomes were NOT_ACQUIRED from the additions workbook; the complete inspection index is
          NOT_ACQUIRED. Existing CMS survey evidence remains separate. A survey deficiency is not
          automatically a final disciplinary sanction.
        </p>
        <p>
          DQA can sanction regulated facilities, including suspension, closure and fines. A bounded
          2022–2026 statewide provider-level enforcement index with exact IDs was NOT_ACQUIRED.
          Enforcement rows and exact adverse attachments are NOT_ACQUIRED, not zero actions. No
          adverse action was joined by name.
        </p>
      </section>
      <section aria-labelledby="wi-complaints">
        <h2 id="wi-complaints">Complaints</h2>
        <p>
          <a href="https://www.dhs.wisconsin.gov/guide/complaints.htm">
            DHS accepts health and residential-care complaints
          </a>
          . Intake is KNOWN. A provider-level public complaint corpus was NOT_ACQUIRED; individual
          outcomes are REQUEST_ONLY or NOT_ACQUIRED. A complaint does not establish a regulatory
          finding.
        </p>
      </section>
      <section aria-labelledby="wi-clocks">
        <h2 id="wi-clocks">Source clocks and limits</h2>
        <p>
          Workbook HTTP modification dates are listed by class above. The survey-additions workbook
          was last HTTP-modified {snapshot.surveyAdditionsSource.httpLastModified}. Retrieved{" "}
          {snapshot.retrievedAt}; snapshot generated {snapshot.generatedAt}. Provider issue dates,
          where printed, are individual fields, not a common statewide status clock. No inspection
          or action date is inferred from roster dates. The existing CMS spine has its own source
          clock.
        </p>
        <p>
          Graph writes: {snapshot.graphWrites}; new canonical facilities:
          {snapshot.newCanonicalFacilities}; claim eligibility changes:
          {snapshot.claimEligibilityChanges}; name-only adverse joins:
          {snapshot.nameOnlyAdverseJoins}. No quality ranking, winner or combined class total is
          offered.
        </p>
      </section>
    </div>
  );
}
