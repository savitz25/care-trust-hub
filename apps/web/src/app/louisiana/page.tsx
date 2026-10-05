import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/louisiana-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/louisiana");
  return {
    title: { absolute: "Louisiana Senior Care Licenses | SeniorTrustHub" },
    description:
      "Louisiana Department of Health, Health Standards Section directories for nursing homes, adult residential care, home health, hospice, adult day health care, and ICF/IID, counted separately.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function LouisianaPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="la-title">
        <p className="eyebrow">Louisiana senior care research</p>
        <h1 id="la-title">Louisiana Department of Health Facility Directories</h1>
        <p className="home-hero__lede">
          The Louisiana Department of Health, Health Standards Section, publishes a separate
          statewide directory for each license class. Counts below are source rows from each
          official directory. They are not one combined senior facility total, not a deduplicated
          campus census, and not a live license-status determination. Adult residential care is the
          assisted-living class in Louisiana and is not renamed into a generic assisted-living
          census.
        </p>
      </section>
      <section aria-labelledby="la-rosters">
        <h2 id="la-rosters">Statewide provider directories</h2>
        <p>
          Each class keeps its own count. The classes are not added together. A repeated printed
          name is still its own source row. A unique directory link only means the page listed that
          row once; it does not prove a unique licensed campus.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              LDH Health Standards directory rows by class, retrieved {snapshot.retrievedAt}
            </caption>
            <thead>
              <tr>
                <th scope="col">Official directory</th>
                <th scope="col">Source rows</th>
                <th scope="col">Pages</th>
                <th scope="col">Distinct printed names</th>
                <th scope="col">Directory links</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.sources.map((source) => (
                <tr key={source.class}>
                  <th scope="row">
                    <a href={source.sourceUrl}>{source.label}</a>
                  </th>
                  <td>{n(source.rowCount)}</td>
                  <td>{n(source.pageCount)}</td>
                  <td>{n(source.distinctPrintedNames)}</td>
                  <td>{n(source.distinctDirectoryLinks)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Nursing homes and adult day health care had no repeated printed name in this retrieval.
          Adult residential care, home health, hospice, and ICF/IID did. Those repeated names were
          not collapsed. Rows are not deduplicated licensed campuses. The ICF directory title is
          &ldquo;HSS - Intermediate Care for Dev. Disabled&rdquo; (ICF/IID). It is not part of the
          nursing-home count.
        </p>
        <p>
          The HSS Home &amp; Community Based Service Providers directory is a mixed service list,
          not one senior facility class, and it is not included above. Aging and Adult Services
          Facilities and OIDD Supports and Services Centers are separate LDH directories and were
          not added to nursing homes or ICF/IID. Pediatric day health care, therapeutic group homes,
          and psychiatric residential treatment are not senior facility classes and were not added.
          Leaving a directory out is not a count of zero.
        </p>
      </section>
      <section aria-labelledby="la-cms">
        <h2 id="la-cms">State licenses and CMS certification</h2>
        <p>
          CMS Care Compare is a federal overlay and was not bridged. Exact state-to-CMS bridges:{" "}
          {snapshot.cmsExactBridges}. Directory cards did not print a CCN. No name-only bridge was
          made. Existing <Link href="/">CMS provider profiles</Link> keep their own source clock.
          New canonical facilities: {snapshot.newCanonicalFacilities}.
        </p>
      </section>
      <section aria-labelledby="la-inspections">
        <h2 id="la-inspections">Inspections and regulatory actions</h2>
        <p>
          <a href={snapshot.surveyProgramUrl}>Health Standards</a> is the state survey agency. It
          licenses health-care facilities and conducts periodic surveys, certification surveys, and
          complaint surveys. That survey program is KNOWN. Provider-level inspection and survey
          event rows were NOT_ACQUIRED. That is not zero surveys. CMS survey rows were not copied
          onto these state counts.
        </p>
        <p>
          A statewide provider-level enforcement index was NOT_ACQUIRED, not zero actions. No
          adverse action was joined by name. A survey deficiency is not automatically a final
          sanction.
        </p>
      </section>
      <section aria-labelledby="la-complaints">
        <h2 id="la-complaints">Complaints</h2>
        <p>
          <a href={snapshot.complaintIntakeUrl}>LDH accepts complaints</a> against licensed health
          care providers. The complaint page lists separate intake for nursing homes, adult
          residential care providers, adult day care, home health and hospice, and ICF/DD. Intake is
          KNOWN. Home health and hospice share an intake line and still have separate directories.
          Provider-level complaint rows were NOT_ACQUIRED. A complaint is not a finding.
        </p>
      </section>
      <section aria-labelledby="la-geography">
        <h2 id="la-geography">Geography</h2>
        <p>
          There is no parish route. New Orleans, Baton Rouge, Shreveport, and Lafayette are
          geography only. They are not separate license systems and they do not have their own
          counts on this page.
        </p>
      </section>
      <section aria-labelledby="la-clocks">
        <h2 id="la-clocks">Source clocks and limits</h2>
        <p>
          Directory pages were retrieved {snapshot.retrievedAt}. About 20 facilities are listed per
          page; the last page of a class can be shorter. No inspection or action date is inferred
          from that retrieval date. Street addresses and phone numbers on the source pages are not
          republished. {snapshot.retrievedAtNote}
        </p>
        <p>
          Graph writes: {snapshot.graphWrites}; claim eligibility changes:{" "}
          {snapshot.claimEligibilityChanges}; name-only adverse joins:{" "}
          {snapshot.nameOnlyAdverseJoins}; parish routes: {snapshot.parishRoutes}. No quality
          ranking, winner, or combined class total is offered.
        </p>
      </section>
    </div>
  );
}
