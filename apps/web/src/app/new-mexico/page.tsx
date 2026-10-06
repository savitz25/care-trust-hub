import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/new-mexico-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/new-mexico");
  return {
    title: { absolute: "New Mexico Health Facility Limits | SeniorTrustHub" },
    description:
      "New Mexico Health Care Authority, Division of Health Improvement. Nursing facilities, assisted living, adult residential care, home health, hospice, adult day, and ICF/IID were not acquired as state rosters. No combined senior census.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NewMexicoSeniorPage() {
  const guide = snapshot.resourceGuide;
  const sources = snapshot.sources;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="nm-title">
        <p className="eyebrow">New Mexico senior care research</p>
        <h1 id="nm-title">New Mexico health facility limits</h1>
        <p className="home-hero__lede">
          The {snapshot.regulator} licenses health facilities. {snapshot.licensingScope} No class
          was acquired as a state roster, and this page does not publish one New Mexico
          senior-facility census. CMS certification was not downloaded. It stays a federal overlay.
        </p>
      </section>

      <section aria-labelledby="nm-classes">
        <h2 id="nm-classes">State rosters were not acquired</h2>
        <p>
          Source <a href={sources.dhiOverview}>Division of Health Improvement</a>, examined{" "}
          {snapshot.examinedAt}. Each row is {snapshot.classes[0]?.roster} as a state roster. The
          rows are not added.
        </p>
        <table>
          <caption>
            New Mexico senior classes. Not a current roster and not a combined census.
          </caption>
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

      <section aria-labelledby="nm-search">
        <h2 id="nm-search">Search, surveys, and records</h2>
        <p>
          Assisted-living public search is the {snapshot.assistedLivingSearchOffice}:{" "}
          <a href={sources.assistedLivingHome}>alf.hca.nm.gov</a> and{" "}
          <a href={sources.facilitySearch}>facility search</a>. The facility search is interactive.
          No official facility-directory export was downloaded. A search is not a roster.
        </p>
        <p>
          <a href={sources.surveyReports}>DHI survey reports</a> point to{" "}
          {snapshot.federalOverlays.join(" and ")} as federal overlays. CMS certification was not
          downloaded, and no state-to-CMS bridge was made. More information may require a
          public-records request to {snapshot.recordsPath}. That email is a records path, not a
          census. Survey, deficiency, complaint, and enforcement counts were NOT_ACQUIRED. Complaint
          intake is not a complaint census. A complaint is not a finding.
        </p>
      </section>

      <section aria-labelledby="nm-guide">
        <h2 id="nm-guide">The resource guide is not a roster</h2>
        <p>
          <a href={guide.url}>{guide.title}</a> is a {guide.publicExtract}. The guide is not a
          roster and is not a facility count.
        </p>
      </section>

      <section aria-labelledby="nm-limits">
        <h2 id="nm-limits">What this page does not claim</h2>
        <ul>
          <li>
            Temporary or provisional license counts: {snapshot.temporaryOrProvisionalLicenseCount}.
            A temporary license is not a full license.
          </li>
          <li>Capacity: {snapshot.capacity}.</li>
          <li>{snapshot.notStateLicenseCounts.join(", ")} are not state license counts.</li>
          <li>
            Net-new entities: {snapshot.netNewEntities}. New canonical facilities:{" "}
            {snapshot.newCanonicalFacilities}. Evidence attachments: {snapshot.evidenceAttachments}.
            Graph writes: {snapshot.graphWrites}. Name-only adverse joins:{" "}
            {snapshot.nameOnlyAdverseJoins}.
          </li>
          <li>
            Albuquerque and Santa Fe are geography only. <Link href="/new-mexico">/new-mexico</Link>{" "}
            is the only new route.
          </li>
        </ul>
      </section>
    </div>
  );
}
