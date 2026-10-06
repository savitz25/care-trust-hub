import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import snapshot from "@/data/kansas-public-snapshot.json";

const adult = snapshot.sourceSets.adultCare;
const health = snapshot.sourceSets.healthFacilities;
const adultClasses = [
  "Nursing Facility",
  "Nursing Facility STATE ONLY",
  "Assisted Living Facility",
  "Residential Health Care Facility",
  "Home Plus",
  "Adult Day Care",
  "Mental Health Nursing Facility",
  "Boarding Care Home",
  "Long Term Care Unit",
] as const;
const homeHealthClasses = [
  "Home Health Agency STATE ONLY",
  "Home Health Agency - Medicare",
  "Home Health Agency MEDICAID ONLY",
  "Accredited Home Health Agency",
] as const;
const fmt = (value: number) => value.toLocaleString("en-US");

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/kansas");
  return {
    title: { absolute: "Kansas Senior Care Facility Research | SeniorTrustHub" },
    description:
      "KDADS adult-care facilities and KDHE health facilities by source-defined class, with survey, bed-capacity, inspection and CMS limits kept separate.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function KansasSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ks-title">
        <p className="eyebrow">Kansas senior care research</p>
        <h1 id="ks-title">Kansas licensed facility classes</h1>
        <p className="home-hero__lede">
          KDADS&apos;s adult-care directory contains {fmt(adult.rawRowCount)} rows and{" "}
          {fmt(adult.distinctFacilityStateIds)} distinct facility State IDs. A facility can have
          more than one class, so type observations below are not added into a combined senior-care
          census.
        </p>
      </section>

      <section aria-labelledby="ks-classes">
        <h2 id="ks-classes">KDADS adult-care facility type observations</h2>
        <p>
          Each count follows the directory&apos;s printed facility type and uses the State ID as the
          facility key. Nursing, assisted living, residential health care, Home Plus, adult day and
          other classes remain separate.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              Kansas KDADS facility type rows and distinct State IDs; retrieved {adult.retrievedAt}
            </caption>
            <thead>
              <tr>
                <th scope="col">Source-defined facility type</th>
                <th scope="col">Type rows</th>
                <th scope="col">Distinct State IDs</th>
              </tr>
            </thead>
            <tbody>
              {adultClasses.map((kind) => (
                <tr key={kind}>
                  <th scope="row">{kind}</th>
                  <td>{fmt(adult.typeObservations[kind]?.rows ?? 0)}</td>
                  <td>{fmt(adult.typeObservations[kind]?.distinctStateIds ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          The export also lists ICF/IID and hospital classes. They are not relabeled as nursing
          homes or assisted living based on appearing in the same directory.
        </p>
      </section>

      <section aria-labelledby="ks-community">
        <h2 id="ks-community">Home health, hospice and federal certification</h2>
        <p>
          The separate KDADS web facilities portal contains {fmt(health.rawRowCount)} source rows
          with {fmt(health.distinctFacilityStateIds)} distinct State IDs; some IDs appear under more
          than one class. KDHE describes the state health-facility licensing and certification
          program. These home health and hospice observations are not merged with residential
          facility counts.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>
              Kansas health facilities directory type rows and distinct State IDs; retrieved{" "}
              {health.retrievedAt}
            </caption>
            <thead>
              <tr>
                <th scope="col">Source-defined type</th>
                <th scope="col">Type rows</th>
                <th scope="col">Distinct State IDs</th>
              </tr>
            </thead>
            <tbody>
              {homeHealthClasses.map((kind) => (
                <tr key={kind}>
                  <th scope="row">{kind}</th>
                  <td>{fmt(health.typeObservations[kind]?.rows ?? 0)}</td>
                  <td>{fmt(health.typeObservations[kind]?.distinctStateIds ?? 0)}</td>
                </tr>
              ))}
              <tr>
                <th scope="row">Hospice</th>
                <td>{fmt(health.typeObservations.Hospice.rows)}</td>
                <td>{fmt(health.typeObservations.Hospice.distinctStateIds)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          CMS certification is a separate federal status and was not acquired or joined in this
          snapshot. A state facility type does not establish a CMS certification.
        </p>
      </section>

      <section aria-labelledby="ks-inspections">
        <h2 id="ks-inspections">Surveys, bed changes and facility details</h2>
        <p>
          The adult-care export has a printed survey-posting date on{" "}
          {fmt(adult.lastSurveyPostingDateRows)} rows; the latest printed date was{" "}
          {adult.latestPrintedSurveyPostingDate}. {fmt(adult.rowsWithoutSurveyPostingDate)} rows
          have no survey-posting date. This field is a posting clock, not an inspection result. The
          directory marks {fmt(adult.bedCountLastChangeRows)} rows with a last-change type of “BED
          COUNT,” but the CSV does not contain the bed or capacity value.
        </p>
        <p>
          Inspection results and facility detail are linked separately in the{" "}
          <a href={adult.sourcePage}>KDADS Adult Care Home Facilities Directory</a>. Facility-level
          inspection/survey records, bed capacity values, complaints, enforcement findings, and CMS
          certification were not acquired in this publication. A complaint is not a finding.
        </p>
        <p>
          The source directory includes administrator names as a separate person field. This page
          does not treat or publish an administrator as the facility identity. Administrator license
          and person-to-facility reconciliation were not acquired.
        </p>
      </section>

      <section aria-labelledby="ks-provenance">
        <h2 id="ks-provenance">Sources and clocks</h2>
        <p>
          <a href="https://www.kdads.ks.gov/licensing-policy/adult-care-home-directory">
            KDADS Adult Care Home Directory
          </a>{" "}
          links to the <a href={adult.sourcePage}>adult-care facilities portal</a> and its{" "}
          <a href={adult.csvDownload}>CSV export</a>. The export had {fmt(adult.rawRowCount)} rows,{" "}
          {fmt(adult.distinctFacilityStateIds)} distinct facility IDs, and SHA-256{" "}
          <code>{adult.rawSha256}</code>; retrieved {adult.retrievedAt}. Printed last-change dates
          occurred on {fmt(adult.lastChangeDateRows)} rows, latest{" "}
          {adult.latestPrintedLastChangeDate}. Survey posting dates are an independent clock.
        </p>
        <p>
          <a href={health.sourcePage}>KDADS health facilities portal</a> CSV export:{" "}
          {fmt(health.rawRowCount)} rows and {fmt(health.distinctFacilityStateIds)} distinct State
          IDs; SHA-256 <code>{health.rawSha256}</code>; retrieved {health.retrievedAt}.{" "}
          <a href="https://www.kdhe.ks.gov/449/Facilities-Licensing">
            KDHE Facilities and Licensing
          </a>{" "}
          describes the separate health-facility program.
        </p>
        <p>
          Existing canonical matches: NOT_ACQUIRED. New canonical facility entities, facility-level
          evidence attachments and graph writes: 0. This page publishes aggregate source
          observations only. For named facility verification, use the official source directory; no
          Kansas facility search corpus was added here.
        </p>
      </section>
    </div>
  );
}
