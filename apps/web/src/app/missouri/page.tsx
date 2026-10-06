import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/missouri-public-snapshot.json";

const fmt = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/missouri");
  return {
    title: { absolute: "Missouri Long-Term Care Licensure | SeniorTrustHub" },
    description:
      "Missouri DHSS long-term care directory with SNF, ICF, RCF, RCF*, ALF and ALF** license levels kept separate. Source updated October 5, 2026.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function MissouriSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="mo-title">
        <p className="eyebrow">Missouri senior care research</p>
        <h1 id="mo-title">Missouri long-term care licensure</h1>
        <p className="home-hero__lede">
          The Missouri Department of Health and Senior Services publishes licensed long-term care
          records by level of care. The classes differ in services and licensing rules. A facility
          may appear in more than one class, and this page does not present one uniform facility
          census.
        </p>
      </section>

      <section aria-labelledby="mo-classes">
        <h2 id="mo-classes">Six source-defined levels of care</h2>
        <p>
          <a href={snapshot.sourceUrl}>DHSS LTC DIRECTORY</a> last updated{" "}
          {snapshot.sourceRowsUpdatedAt}; retrieved {snapshot.retrievedAt}. Each row is a
          facility-level-of-care observation with its printed license number. The{" "}
          {fmt(snapshot.rows)} rows include {fmt(snapshot.distinctFacilityNumbersAcrossClasses)}{" "}
          distinct source facility numbers; {fmt(snapshot.facilityNumbersWithMultipleClasses)}{" "}
          facility numbers appear in multiple care classes. Those cross-class observations are not
          extra facilities.
        </p>
        <table>
          <caption>DHSS directory observations by printed level of care</caption>
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Rows</th>
              <th scope="col">Facility numbers</th>
              <th scope="col">License numbers</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.classes.map((row) => (
              <tr key={row.code}>
                <th scope="row">{row.code}</th>
                <td>{fmt(row.rows)}</td>
                <td>{fmt(row.facilityNumbers)}</td>
                <td>{fmt(row.licenseNumbers)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <a href={snapshot.levelDefinitionsUrl}>DHSS describes the levels of licensure</a>. SNF
          means skilled nursing facility; ICF means intermediate care facility; RCF means
          residential care facility; ALF means assisted living facility. RCF* retains the former RCF
          II standard. ALF** is the source designation for an assisted living facility that accepts
          or retains residents needing more help to evacuate. These labels are not quality ratings.
          Hospital-based long-term care is not a class in this downloaded directory and remains
          NOT_ACQUIRED.
        </p>
      </section>

      <section aria-labelledby="mo-evidence">
        <h2 id="mo-evidence">Separate evidence tracks</h2>
        <p>
          The CSV has facility numbers, license numbers, license effective and expiration dates,
          administrator names and certification fields. A printed administrator name is not an
          administrator license verification. A certification field is not a current CMS inspection
          or quality overlay. No administrator license or CMS provider record was joined by name.
        </p>
        <p>
          <a href={snapshot.showMeLtcUrl}>Show Me Long Term Care</a> is DHSS&apos;s facility
          inspection research path. Its notice reports a temporary gap in the latest federal survey
          and complaint results for certified SNFs during the iQIES transition. Facility
          inspections, complaint investigations, deficiencies, and enforcement are separate events;
          none were acquired as record-level attachments here. A complaint is not a finding.{" "}
          <a href={snapshot.administratorUrl}>The Board of Nursing Home Administrators</a> licenses
          people separately from facilities.
        </p>
      </section>

      <section aria-labelledby="mo-coverage">
        <h2 id="mo-coverage">Coverage and clocks</h2>
        <ul>
          <li>
            DHSS data rows: {fmt(snapshot.rows)}. Distinct printed facility numbers:{" "}
            {fmt(snapshot.distinctFacilityNumbersAcrossClasses)}. Distinct printed license numbers:{" "}
            {fmt(snapshot.distinctLicenseNumbersAcrossClasses)}. These are different grains.
          </li>
          <li>
            CSV SHA-256: {snapshot.sourceSha256}. Dataset row update: {snapshot.sourceRowsUpdatedAt}
            ; retrieval: {snapshot.retrievedAt}. Individual license effective and expiration dates
            remain row-specific.
          </li>
          <li>
            Inspections, complaints, deficiencies, enforcement, administrator licenses and CMS
            overlay: NOT_ACQUIRED as entity attachments. Existing canonical matches: NOT_ACQUIRED.
            New canonical facilities and evidence attachments: 0.
          </li>
          <li>No city or county care pages are published by this Missouri sprint.</li>
        </ul>
      </section>
    </div>
  );
}
