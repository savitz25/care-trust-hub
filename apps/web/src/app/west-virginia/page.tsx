import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/west-virginia-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/west-virginia");
  return {
    title: { absolute: "West Virginia Senior Facility Limits | SeniorTrustHub" },
    description:
      "West Virginia OHFLAC facility lookup. Nursing homes, assisted living, home health, hospice, adult day, ICF/IID, and residential care were not acquired as class rosters. No combined senior census.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function WestVirginiaSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="wv-title">
        <p className="eyebrow">West Virginia senior care research</p>
        <h1 id="wv-title">West Virginia senior facility limits</h1>
        <p className="home-hero__lede">
          The {snapshot.regulator} publishes a facility lookup. That lookup is a server-side search.
          No class was acquired as a state roster, and this page does not publish one West Virginia
          senior-facility census. CMS certification was not downloaded. It stays a federal overlay.
        </p>
      </section>

      <section aria-labelledby="wv-classes">
        <h2 id="wv-classes">Class rosters were not acquired</h2>
        <p>
          Source <a href={snapshot.sources.facilityLookup}>OHFLAC facility lookup</a>, examined{" "}
          {snapshot.examinedAt}. HTTP Date {snapshot.httpDate}. Last-Modified{" "}
          {snapshot.httpLastModified}. The saved page is {snapshot.lookupHtmlBytes} bytes, SHA-256{" "}
          {snapshot.lookupHtmlSha256}. A search form is not a roster. Each class below is
          NOT_ACQUIRED. The rows are not added. An administrator is not a facility.
        </p>
        <table>
          <caption>
            West Virginia senior classes. Not a current roster and not a combined census.
          </caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">State roster</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.classes.map((row) => (
              <tr key={row.typeCode}>
                <th scope="row">{row.name}</th>
                <td>{row.roster}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="wv-surveys">
        <h2 id="wv-surveys">Surveys and complaints stay separate</h2>
        <p>
          Facility detail pages can show completed surveys and complaint-survey history. Those pages
          were not scraped. Survey count: {snapshot.surveyCount}. Deficiency count:{" "}
          {snapshot.deficiencyCount}. Complaint investigations:{" "}
          {snapshot.complaintInvestigationCount}. Enforcement: {snapshot.enforcementCount}. A survey
          is not enforcement. A complaint investigation is not a violation. A survey with no
          deficiencies would still be a survey observation, and none was counted here.
        </p>
        <p>CMS remains a federal overlay. No state-to-CMS bridge was made.</p>
      </section>

      <section aria-labelledby="wv-limits">
        <h2 id="wv-limits">What this page does not claim</h2>
        <ul>
          <li>
            Net-new entities: {snapshot.netNewEntities}. New canonical facilities:{" "}
            {snapshot.newCanonicalFacilities}. Evidence attachments: {snapshot.evidenceAttachments}.
            Graph writes: {snapshot.graphWrites}. Name-only adverse joins:{" "}
            {snapshot.nameOnlyAdverseJoins}.
          </li>
          <li>
            Charleston, Morgantown, and Huntington are geography only.{" "}
            <Link href="/west-virginia">/west-virginia</Link> is the only new route.
          </li>
        </ul>
      </section>
    </div>
  );
}
