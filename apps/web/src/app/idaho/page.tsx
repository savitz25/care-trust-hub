import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/idaho-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/idaho");
  return {
    title: { absolute: "Idaho Senior Facility Limits | SeniorTrustHub" },
    description:
      "Idaho Department of Health and Welfare. Residential assisted living, nursing homes, certified family homes, home health, hospice, adult day, and home and community based services were not acquired as state rosters. No combined senior census.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function IdahoSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="id-title">
        <p className="eyebrow">Idaho senior care research</p>
        <h1 id="id-title">Idaho senior facility limits</h1>
        <p className="home-hero__lede">
          The {snapshot.regulator} find-a-facility page names nursing homes,
          assisted living, Home and Community Based Services, and Certified Family
          Homes. No class was acquired as a state roster, and this page does not
          publish one Idaho senior-facility census. CMS certification was not
          downloaded. It stays a federal overlay.
        </p>
      </section>

      <section aria-labelledby="id-classes">
        <h2 id="id-classes">State rosters were not acquired</h2>
        <p>
          Source{" "}
          <a href={snapshot.sources.findFacility}>find a facility or agency</a>,
          examined {snapshot.examinedAt}. The saved page is {snapshot.findFacilityHtmlBytes}{" "}
          bytes, SHA-256 {snapshot.findFacilityHtmlSha256}. The page chrome prints
          last updated {snapshot.findFacilityPageChromeUpdated}. That chrome date
          is not a roster clock. Each class below is NOT_ACQUIRED. The rows are
          not added.
        </p>
        <table>
          <caption>Idaho senior classes. Not a current roster and not a combined census.</caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">State roster</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.classes.map((row) => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                <td>{row.roster}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="id-search">
        <h2 id="id-search">The public list is a browser</h2>
        <p>
          The find-a-facility page links to a{" "}
          <a href={snapshot.sources.webLinkBrowser}>WebLink browser</a> for facility
          and agency lists. That browser was not opened and was not downloaded as
          a CSV. A browser is not a roster. Residential Assisted Living Facilities
          and Certified Family Homes are separate program pages. Survey,
          inspection, complaint-investigation, enforcement, capacity, and Medicaid
          participation counts were NOT_ACQUIRED. A complaint investigation is not a violation.
        </p>
        <p>
          CMS remains a federal overlay. No state-to-CMS bridge was made. A
          third-party magazine or association figure is not an Idaho license count.
        </p>
      </section>

      <section aria-labelledby="id-limits">
        <h2 id="id-limits">What this page does not claim</h2>
        <ul>
          <li>
            Temporary or provisional license counts: {snapshot.temporaryOrProvisionalLicenseCount}.
            A temporary license is not a full license.
          </li>
          <li>Capacity: {snapshot.capacity}.</li>
          <li>
            Net-new entities: {snapshot.netNewEntities}. New canonical facilities:{" "}
            {snapshot.newCanonicalFacilities}. Evidence attachments: {snapshot.evidenceAttachments}.
            Graph writes: {snapshot.graphWrites}. Name-only adverse joins:{" "}
            {snapshot.nameOnlyAdverseJoins}.
          </li>
          <li>
            Boise is geography only. <Link href="/idaho">/idaho</Link> is the only
            new route.
          </li>
        </ul>
      </section>
    </div>
  );
}
