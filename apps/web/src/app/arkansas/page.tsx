import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/arkansas-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/arkansas");
  return {
    title: { absolute: "Arkansas Long-Term Care Evidence | SeniorTrustHub" },
    description:
      "DHS SFY 2022 narrative: approximately 224 nursing facilities, 40 ICF/IID facilities, and 13 psychiatric residential care facilities, kept separate. Current class rosters were not acquired.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function ArkansasSeniorPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const narrative = snapshot.narrativeResidence;
  const medicaid = snapshot.medicaidNursingClassification;
  const icf = snapshot.icfIidDivision;
  const surveys = snapshot.surveys;
  const complaints = snapshot.complaints;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ar-title">
        <p className="eyebrow">Arkansas senior care research</p>
        <h1 id="ar-title">Arkansas long-term care evidence</h1>
        <p className="home-hero__lede">
          The Division of Provider Services and Quality Assurance describes State Fiscal Year 2022,
          July 1, 2021 through June 30, 2022. The residence sentence is approximate. It is not a
          current license roster, and this page does not publish one Arkansas senior-facility total.
          CMS certification was not bridged.
        </p>
      </section>

      <section aria-labelledby="ar-narrative">
        <h2 id="ar-narrative">SFY 2022 residence sentence</h2>
        <p>
          Source{" "}
          <a href={snapshot.sourceUrl}>DHS Annual Statistical Report, transmitted July 10, 2023</a>.
          SHA-256 {snapshot.sha256}. Examined {snapshot.examinedAt}. The report says residents live
          in {narrative.qualifier} {n(narrative.nursingFacilities)} nursing facilities,{" "}
          {n(narrative.icfIid)} intermediate care facilities for individuals with intellectual
          disabilities, and {n(narrative.psychiatricResidentialCareFacilities)} psychiatric
          residential care facilities. Those three classes are not added.
        </p>
        <table>
          <caption>Narrative classes on DPSQA-1. Approximate. Not a current roster.</caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Narrative figure</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nursing facilities</th>
              <td>{n(narrative.nursingFacilities)}</td>
            </tr>
            <tr>
              <th scope="row">ICF/IID</th>
              <td>{n(narrative.icfIid)}</td>
            </tr>
            <tr>
              <th scope="row">Psychiatric residential care facilities</th>
              <td>{n(narrative.psychiatricResidentialCareFacilities)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ar-medicaid">
        <h2 id="ar-medicaid">Medicaid classification is a different sentence</h2>
        <p>
          The next page says nursing facilities include {n(medicaid.publicFacilities)} public
          facility, the {medicaid.publicFacilityNamed}, and {n(medicaid.privateUnderMedicaid)}{" "}
          private facilities under Medicaid. A footnote says there is{" "}
          {n(medicaid.additionalPrivateWithoutMedicaidFunding)} additional private facility that
          does not receive Medicaid funding. That classification is not the same figure as{" "}
          {n(narrative.nursingFacilities)}, and the sentences are not added.
        </p>
        <p>
          The same page divides the ICF/IID population into{" "}
          {n(icf.stateOwnedHumanDevelopmentCenters)} state-owned human development centers,{" "}
          {n(icf.privatePediatricFacilities)} private pediatric facilities, and{" "}
          {n(icf.adultFacilitiesFifteenBedsOrFewer)} adult facilities of 15 or fewer beds. That
          division explains the narrative {n(narrative.icfIid)}. It is not added to nursing
          facilities or psychiatric residential care.
        </p>
      </section>

      <section aria-labelledby="ar-surveys">
        <h2 id="ar-surveys">Surveys and complaints stay separate</h2>
        <p>
          The Office of Long Term Care performed {n(surveys.focusedInfectionControl)} focused
          infection-control surveys, {n(surveys.complaintSurveys)} complaint surveys, and{" "}
          {n(surveys.recertificationSurveys)} recertification surveys. A survey is not a violation
          and is not a facility count.
        </p>
        <p>
          Complaint intake in the same report was {n(complaints.nursingHomeComplaintsReceived)}{" "}
          nursing-home complaints and {n(complaints.hcbsComplaintsReceived)} home- and
          community-based complaints. A complaint is not a finding. The nursing-home complaint
          intake is not the complaint-survey count. Medical-need applications and assessments in the
          same section are processing volume, not facility licenses.
        </p>
      </section>

      <section aria-labelledby="ar-limits">
        <h2 id="ar-limits">What this page does not claim</h2>
        <ul>
          <li>
            Current assisted-living, residential-care, adult-day, home-health, and hospice rosters:
            NOT_ACQUIRED.
          </li>
          <li>
            The report&apos;s later license table was not published. Its extracted class pairings
            are not reliable enough to count.
          </li>
          <li>
            Bed and slot charts in the medical-services section were not published as capacity.
          </li>
          <li>
            Facility-level inspection findings and an enforcement-order roster: NOT_ACQUIRED.
            Name-only adverse joins: {snapshot.nameOnlyAdverseJoins}.
          </li>
          <li>
            New canonical facilities: {snapshot.newCanonicalFacilities}. Evidence attachments:{" "}
            {snapshot.evidenceAttachments}. Graph writes: {snapshot.graphWrites}.
          </li>
          <li>
            Little Rock, Fayetteville, Fort Smith, Jonesboro, Springdale, and Bentonville are
            geography only. <Link href="/arkansas">/arkansas</Link> is the only new route.
          </li>
        </ul>
      </section>
    </div>
  );
}
