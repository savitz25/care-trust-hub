import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const assisted = "https://health.alaska.gov/en/services/assisted-living-licensing-and-renewals/";
const facilities =
  "https://health.alaska.gov/en/division-of-health-care-services/health-facilities-licensing/";
const longTermCare =
  "https://health.alaska.gov/en/services/health-care-facilities-licensing-certification-all/long-term-care-ltc-facilities/";
const sources = [
  ["Assisted living licensing and current open-home roster", assisted],
  ["Health Facilities Licensing and Certification current list", facilities],
  ["Long-term care facility licensing and CMS distinction", longTermCare],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/alaska");
  return {
    title: { absolute: "Alaska Senior Care Facility Licensing | SeniorTrustHub" },
    description:
      "Alaska assisted living and health facility licensing records by source-defined class; no combined senior-facility count.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function AlaskaSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="ak-title">
        <p className="eyebrow">Alaska facility licensing evidence</p>
        <h1 id="ak-title">Alaska senior-care facility classes</h1>
        <p className="home-hero__lede">
          Alaska’s Department of Health publishes an assisted-living open-home roster and a separate
          health-facility list. The state source classes are retained separately; no combined senior
          denominator is used.
        </p>
      </section>
      <section aria-labelledby="ak-assisted">
        <h2 id="ak-assisted">Assisted living homes</h2>
        <p>
          The state’s open-home roster dated August 31, 2026 contains 814 currently listed homes and
          814 distinct license numbers. Source classifications remain as listed: Biennial DDMH,
          Senior and Physical Disabilities Services, Dual, and the corresponding provisional
          classes. This is an assisted-living-home license population, not an all-senior-services
          count.
        </p>
        <p>
          The roster file was retrieved October 14, 2026; its source clock is August 31, 2026. The
          state says its list is updated monthly.
        </p>
      </section>
      <section aria-labelledby="ak-hflc">
        <h2 id="ak-hflc">Separate health-facility classes</h2>
        <p>
          The Health Facilities Licensing and Certification list dated September 24, 2026 contains
          172 observations across multiple state facility classes. Relevant source-defined classes
          include 20 Long Term Care rows, 18 Home Health rows, 8 Hospice-Full Service rows, and 6
          Hospice-Volunteer rows. These class observations are not added together: facility types
          and licensing identifiers differ, and rows can represent different service classes.
        </p>
        <p>
          The 20 Long Term Care rows include 16 distinct non-N/A state license identifiers and a
          reported licensed-bed sum of 834. This is a source-list class summary, not a CMS-certified
          facility or bed count.
        </p>
      </section>
      <section aria-labelledby="ak-boundaries">
        <h2 id="ak-boundaries">Identity and oversight boundaries</h2>
        <ul>
          <li>
            Assisted living homes and separately licensed health facilities are distinct state
            populations.
          </li>
          <li>
            Home-health and hospice rows remain service classes, not a combined facility count.
          </li>
          <li>
            Facility licenses, inspections/surveys, complaints, enforcement, and administrator
            credentials are separate records.
          </li>
          <li>
            CMS-certified providers and measures remain federal populations and are not combined
            with state licenses.
          </li>
          <li>
            Adult-day and other state senior-relevant classes are not inferred from absence in these
            two lists.
          </li>
        </ul>
      </section>
      <section aria-labelledby="ak-sources">
        <h2 id="ak-sources">Official sources and clocks</h2>
        <ul>
          {sources.map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <p>
          Both files were retrieved October 14, 2026. Assisted living source updated August 31,
          2026; HFLC list published September 24, 2026. Inspections and enforcement were not
          acquired as row-level attachments in this pass.
        </p>
      </section>
    </div>
  );
}
