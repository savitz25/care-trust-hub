import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const sources = [
  [
    "Nursing and intermediate-care facilities",
    "https://health.hawaii.gov/ohca/medicare-facilities/skilled-nursingintermediate-care-facilities/",
    "OHCA publishes facility, state license number, expiration, bed capacity, location, and federal CCN where applicable.",
  ],
  [
    "Assisted living facilities",
    "https://health.hawaii.gov/ohca/state-licensing-section/",
    "OHCA State Licensing Section identifies assisted living as a separately licensed class.",
  ],
  [
    "Adult residential care homes and expanded ARCH",
    "https://health.hawaii.gov/ohca/state-licensing-section/",
    "ARCH and expanded ARCH are distinct state license types; expanded ARCH serves people requiring nursing-home-level care.",
  ],
  [
    "Home health agencies",
    "https://health.hawaii.gov/ohca/medicare-facilities/home-health-agencies/",
    "State OHCA facility listing and federal certification remain separate evidence.",
  ],
  [
    "Hospice",
    "https://health.hawaii.gov/ohca/medicare-facilities/hospice/",
    "OHCA publishes hospice facilities separately from other care classes.",
  ],
  [
    "Adult day health centers",
    "https://health.hawaii.gov/ohca/medicare-facilities/adult-day-health-centers/",
    "OHCA separately lists adult day health centers and provider-based/free-standing status.",
  ],
  [
    "Home care agencies",
    "https://health.hawaii.gov/ohca/state-licensing-section/hcal/agencies/",
    "OHCA publishes an HCA list with license number, address, service area, and effective/expiration dates; separate from home health.",
  ],
  [
    "Inspections and surveys",
    "https://health.hawaii.gov/ohca/inspection-reports/",
    "Inspection reports are facility-level survey evidence, not license records or final enforcement findings.",
  ],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/hawaii");
  return {
    title: { absolute: "Hawaii Senior Care Facility Licenses | SeniorTrustHub" },
    description:
      "Hawaii Department of Health OHCA facility licensing populations, published as separate facility classes with source-native evidence limits.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function HawaiiPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="hi-title">
        <p className="eyebrow">Hawaii senior care research</p>
        <h1 id="hi-title">Hawaii Department of Health facility licensing</h1>
        <p className="home-hero__lede">
          The Department of Health Office of Health Care Assurance (OHCA) maintains state facility
          licensing and inspection resources. Each source-defined care class is separate. This page
          links to OHCA's current public directories and reports; it does not add unlike populations
          into one senior-facility census.
        </p>
      </section>
      <section aria-labelledby="hi-populations">
        <h2 id="hi-populations">Statewide facility classes and source evidence</h2>
        <div style={{ overflowX: "auto" }}>
          <table>
            <caption>Separate Hawaii OHCA evidence populations</caption>
            <thead>
              <tr>
                <th scope="col">Population</th>
                <th scope="col">Source-native evidence and limits</th>
              </tr>
            </thead>
            <tbody>
              {sources.map(([name, url, note]) => (
                <tr key={name}>
                  <th scope="row">
                    <a href={url}>{name}</a>
                  </th>
                  <td>
                    {note} Current source row counts and a unified source clock are NOT_ACQUIRED in
                    this publication; consult the linked OHCA source for its latest date and
                    records.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section aria-labelledby="hi-limits">
        <h2 id="hi-limits">Keep records and clocks separate</h2>
        <p>
          Facility identity, license, licensed capacity, inspection or survey, complaint,
          enforcement action, and CMS certification are different records. A facility's inspection
          report does not by itself establish a sanction. Federal CMS certification remains an
          overlay and is not counted as a state license. Administrators are people, not facilities.
          No local licensing, provider ranking, combined total, or Trust Score is asserted.
        </p>
        <p>
          Source review date: October 14, 2026. The linked state pages publish independently updated
          lists with differing clocks; a common refreshed snapshot and normalized entity
          reconciliation were NOT_ACQUIRED. Verify a specific facility with the Hawaii Department of
          Health OHCA source.
        </p>
      </section>
    </div>
  );
}
