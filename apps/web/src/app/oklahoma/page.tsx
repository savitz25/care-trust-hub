import type { Metadata } from "next";
import Link from "next/link";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/oklahoma-public-snapshot.json";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/oklahoma");
  return {
    title: { absolute: "Oklahoma Health Facility Evidence | SeniorTrustHub" },
    description:
      "OSDH April 2026 directories and the August 26, 2026 provider-call slide stay on separate clocks. No combined Oklahoma senior census.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function OklahomaSeniorPage() {
  const n = (value: number) => value.toLocaleString("en-US");
  const dir = snapshot.directories;
  const call = snapshot.providerCall;
  const cites = snapshot.surveyCitationsSfy2026;
  const citeRows = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as const;
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ok-title">
        <p className="eyebrow">Oklahoma senior care research</p>
        <h1 id="ok-title">Oklahoma health facility evidence</h1>
        <p className="home-hero__lede">
          Health Facility Systems directories dated April 2026 and the long-term-care provider call
          dated August 26, 2026 count different clocks. This page does not publish one Oklahoma
          senior-facility total. CMS certification was not bridged. A citation is not a sanction.
        </p>
      </section>

      <section aria-labelledby="ok-directories">
        <h2 id="ok-directories">April directories</h2>
        <p>
          Retrieved {snapshot.retrievedAt}. Facility IDs were parsed from the PDFs. They are not
          added to the August slide.
        </p>
        <table>
          <caption>Health Facility Systems directories</caption>
          <thead>
            <tr>
              <th scope="col">Directory</th>
              <th scope="col">Date</th>
              <th scope="col">Rows</th>
              <th scope="col">Grain</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Assisted living</th>
              <td>{dir.assistedLiving.dated}</td>
              <td>{n(dir.assistedLiving.facilityIds)}</td>
              <td>
                {n(dir.assistedLiving.alPrefix)} AL ids,{" "}
                {n(dir.assistedLiving.nursingIdWithAlSuffix)} nursing ids with an AL suffix, and{" "}
                {n(dir.assistedLiving.continuumIdWithAlSuffix)} continuum ids with an AL suffix.
              </td>
            </tr>
            <tr>
              <th scope="row">Nursing home</th>
              <td>{dir.nursingHome.dated}</td>
              <td>{n(dir.nursingHome.facilityIds)}</td>
              <td>
                {n(dir.nursingHome.nhPrefix)} NH ids and {n(dir.nursingHome.continuumPrefix)}{" "}
                continuum ids on the same list.
              </td>
            </tr>
            <tr>
              <th scope="row">Residential care</th>
              <td>{dir.residentialCare.dated}</td>
              <td>{n(dir.residentialCare.printedFacilities)}</td>
              <td>
                The header also prints {n(dir.residentialCare.printedHeaderFigure)}. Parsed ids
                match the printed facility count. That header figure is not a second facility count.
              </td>
            </tr>
            <tr>
              <th scope="row">Adult day care</th>
              <td>{dir.adultDay.dated}</td>
              <td>{n(dir.adultDay.printedCenters)}</td>
              <td>
                The header also prints {n(dir.adultDay.printedHeaderFigure)}. Parsed ids match the
                printed center count.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ok-slide">
        <h2 id="ok-slide">August 26, 2026 provider-call slide</h2>
        <p>
          Source <a href={call.url}>LTC provider call</a>. SHA-256 {call.sha256}. The slide prints
          its own total of {n(call.slideTotal)}. That line adds the six rows below. It is the
          slide&apos;s arithmetic. It is not this page&apos;s senior census, and it is not the April
          directory.
        </p>
        <table>
          <caption>Facility counts printed for August 2026</caption>
          <thead>
            <tr>
              <th scope="col">Slide row</th>
              <th scope="col">August 2026</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Nursing homes, federal</th>
              <td>{n(call.nursingHomesFederal)}</td>
            </tr>
            <tr>
              <th scope="row">Nursing homes, other</th>
              <td>{n(call.nursingHomesOther)}</td>
            </tr>
            <tr>
              <th scope="row">ICF/IID</th>
              <td>{n(call.icfIid)}</td>
            </tr>
            <tr>
              <th scope="row">Assisted living centers</th>
              <td>{n(call.assistedLivingCenters)}</td>
            </tr>
            <tr>
              <th scope="row">Residential care homes</th>
              <td>{n(call.residentialCareHomes)}</td>
            </tr>
            <tr>
              <th scope="row">Adult day care</th>
              <td>{n(call.adultDayCare)}</td>
            </tr>
          </tbody>
        </table>
        <p>
          A standalone ICF/IID directory is NOT_ACQUIRED. A standalone continuum-of-care directory
          is NOT_ACQUIRED.
        </p>
      </section>

      <section aria-labelledby="ok-citations">
        <h2 id="ok-citations">Survey citations are not facilities</h2>
        <p>
          The same provider-call file prints {cites.label}. The cells sum to{" "}
          {n(cites.printedCellSum)}. That sum is not a facility count and not an enforcement count.
          Facility-linked survey rows are NOT_ACQUIRED.
        </p>
        <table>
          <caption>Scope and severity cells</caption>
          <thead>
            <tr>
              <th scope="col">Cell</th>
              <th scope="col">Deficiency count</th>
            </tr>
          </thead>
          <tbody>
            {citeRows.map((cell) => (
              <tr key={cell}>
                <th scope="row">{cell}</th>
                <td>{n(cites[cell])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="ok-medical">
        <h2 id="ok-medical">Home health and hospice stay in a different directory</h2>
        <p>
          The Medical Facilities Service directory effective{" "}
          {snapshot.medicalFacilitiesDirectory.effective} mixes hospitals, dialysis, home care,
          hospice, and other medical licenses. It has{" "}
          {n(snapshot.medicalFacilitiesDirectory.distinctLicenseNumbers)} distinct license numbers.
          Prefix HC appears {n(snapshot.medicalFacilitiesDirectory.prefixDistinct.HC)} times and
          prefix HO appears {n(snapshot.medicalFacilitiesDirectory.prefixDistinct.HO)} times. A
          prefix is not a finished class census. Home health and hospice class censuses are
          NOT_SEPARATED.
        </p>
      </section>

      <section aria-labelledby="ok-limits">
        <h2 id="ok-limits">What this page does not claim</h2>
        <ul>
          <li>Complaint records: {snapshot.complaintCorpus}. A complaint is not a finding.</li>
          <li>
            Enforcement roster: {snapshot.enforcementCorpus}. Name-only adverse joins:{" "}
            {snapshot.nameOnlyAdverseJoins}.
          </li>
          <li>
            CMS homepage nursing, home-health, and hospice figures are a federal overlay. They were
            not replaced with these OSDH counts.
          </li>
          <li>
            New canonical facilities: {snapshot.newCanonicalFacilities}. Graph writes:{" "}
            {snapshot.graphWrites}.
          </li>
          <li>
            Oklahoma City and Tulsa are geography only. <Link href="/oklahoma">/oklahoma</Link> is
            the only new route.
          </li>
        </ul>
      </section>
    </div>
  );
}
