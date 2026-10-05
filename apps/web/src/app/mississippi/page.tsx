import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/mississippi-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/mississippi");
  return {
    title: { absolute: "Mississippi Health Facility Directory | SeniorTrustHub" },
    description:
      "MSDH directory dated 18 Sep 2026: 209 nursing facilities, 195 personal care homes, 49 home health agencies, 98 hospices, and 14 ICF/IID providers, counted separately.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function MississippiSeniorPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const other = snapshot.otherDirectoryClasses;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ms-title">
        <p className="eyebrow">Mississippi senior care research</p>
        <h1 id="ms-title">Mississippi health facility directory</h1>
        <p className="home-hero__lede">
          The State Department of Health directory dated {snapshot.directoryDate} prints each
          facility class separately. This page does not publish one Mississippi senior-facility
          total. An administrator is not a facility. A survey is not a sanction. CMS was not
          bridged.
        </p>
      </section>
      <section aria-labelledby="ms-classes">
        <h2 id="ms-classes">Directory classes</h2>
        <p>
          Retrieved {snapshot.retrievedAt}. Source{" "}
          <a href={snapshot.directoryUrl}>MSDH Health Facilities Directory</a>. SHA-256{" "}
          {snapshot.sha256}.
        </p>
        <table>
          <caption>Printed class totals, {snapshot.directoryDate}</caption>
          <thead>
            <tr>
              <th scope="col">Class</th>
              <th scope="col">Printed total</th>
              <th scope="col">What it is not</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nursing facilities</th>
              <td>{n(snapshot.nursingFacilities)}</td>
              <td>
                {n(snapshot.nursingFacilitiesWithAlzheimersUnit)} also carry an Alzheimers-unit
                mark. That mark is not added. No bed sum was printed.
              </td>
            </tr>
            <tr>
              <th scope="row">Personal care homes</th>
              <td>{n(snapshot.personalCareHomes)}</td>
              <td>
                {n(snapshot.personalCareAssistedLiving)} assisted living and{" "}
                {n(snapshot.personalCareResidentialLiving)} residential living sum to this total.{" "}
                {n(snapshot.personalCareAlzheimerUnits)} Alzheimer/dementia units are not added.
              </td>
            </tr>
            <tr>
              <th scope="row">Home health agencies</th>
              <td>{n(snapshot.homeHealthAgencies)}</td>
              <td>
                {n(snapshot.homeHealthBranches)} branches are not agencies. Printed parts{" "}
                {snapshot.homeHealthHospitalBased}, {snapshot.homeHealthMemphisBased}, and{" "}
                {snapshot.homeHealthPrivateFreestanding} sum to {snapshot.homeHealthPartsSum}, not{" "}
                {snapshot.homeHealthAgencies}.
              </td>
            </tr>
            <tr>
              <th scope="row">Hospice</th>
              <td>{n(snapshot.hospice)}</td>
              <td>
                Includes one hospice certified by another state. {n(snapshot.hospiceAlternateSites)}{" "}
                alternate sites and {n(snapshot.hospiceInpatientAndOutpatientFacilities)}{" "}
                inpatient-and-outpatient facilities are not added.
              </td>
            </tr>
            <tr>
              <th scope="row">ICF/IID providers</th>
              <td>{n(snapshot.icfIidProviders)}</td>
              <td>Group-home address lines were not counted as a second population.</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section aria-labelledby="ms-other">
        <h2 id="ms-other">Other classes in the same directory</h2>
        <p>
          These printed totals are not a senior census and are not added to the classes above.
          Comprehensive outpatient rehabilitation is a printed zero.
        </p>
        <ul>
          <li>
            Ambulatory surgical, certified {n(other.ambulatorySurgicalCertified)}; licensed{" "}
            {n(other.ambulatorySurgicalLicensed)}. Those two figures are not added.
          </li>
          <li>
            Hospitals {n(other.hospitals)}; satellite facilities {n(other.hospitalSatellites)}.
          </li>
          <li>
            Rural health clinics {n(other.ruralHealthClinics)}. End-stage renal disease{" "}
            {n(other.endStageRenalDisease)}.
          </li>
          <li>
            Outpatient physical therapy {n(other.outpatientPhysicalTherapy)}. Prescribed pediatric
            extended care {n(other.prescribedPediatricExtendedCare)}. Psychiatric residential
            treatment {n(other.psychiatricResidentialTreatment)}.
          </li>
          <li>
            Brain injury {n(other.brainInjury)}. Community mental health centers{" "}
            {n(other.communityMentalHealthCenters)}. Comprehensive outpatient rehab{" "}
            {n(other.comprehensiveOutpatientRehab)}.
          </li>
          <li>Portable x-ray section total line: {other.portableXRayPrintedLine}.</li>
        </ul>
      </section>
      <section aria-labelledby="ms-limits">
        <h2 id="ms-limits">Limits</h2>
        <p>
          Survey rows were NOT_ACQUIRED. Complaint rows were NOT_ACQUIRED. Enforcement rows were
          NOT_ACQUIRED. Name-only adverse joins {snapshot.nameOnlyAdverseJoins}. Graph writes{" "}
          {snapshot.graphWrites}. Jackson, Gulfport, and Biloxi are geography only.{" "}
          <Link href="/mississippi">/mississippi</Link> is the only new route.
        </p>
      </section>
    </div>
  );
}
