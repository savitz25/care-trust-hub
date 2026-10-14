import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const HHS = "https://www.hhs.nd.gov/health/health-facilities-unit";
const BASIC = `${HHS}/basic-care-facilities`;
const NURSING = `${HHS}/skilled-nursing-facilities`;
const HOME_HEALTH = `${HHS}/home-health-agencies`;
const HOSPICE = `${HHS}/hospice-programs`;
const ASSISTED = "https://www.hhs.nd.gov/adults-and-aging/assisted-living";
const BASIC_PDF =
  "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/HF/Facility%20Reports/ND-basic-care-facilities-exclusion.pdf";
const NURSING_PDF =
  "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/HF/Facility%20Reports/ND-skilled-nursing-facilities.pdf";
const ASSISTED_PDF =
  "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/FL/F%26L%20PDF/statewide-licensed-assisted-living-facilities-exception.pdf";
const HOSPICE_PDF =
  "https://www.hhs.nd.gov/sites/www/files/documents/DOH%20Legacy/HF/Facility%20Reports/ND-Hospice-Facilities.pdf";
const CMS =
  "https://www.cms.gov/medicare/provider-enrollment-and-certification/certificationandcomplianc";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/north-dakota");
  return {
    title: { absolute: "North Dakota Senior Care Facility Licensing | SeniorTrustHub" },
    description:
      "North Dakota Health and Human Services facility evidence by source-defined class, with state licensing and CMS certification kept distinct.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

const Source = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline">
    {children}
  </a>
);

export default function NorthDakotaSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="nd-title">
        <p className="eyebrow">North Dakota Health and Human Services facility evidence</p>
        <h1 id="nd-title">North Dakota senior-care facility classes</h1>
        <p className="home-hero__lede">
          North Dakota Health and Human Services (HHS), including its Health Facilities Unit,
          publishes separate facility directories. The counts below retain each source population
          and its clock; they are not a statewide senior-facility total.
        </p>
      </section>

      <section aria-labelledby="basic-care">
        <h2 id="basic-care">Basic Care facilities — state license records</h2>
        <p>
          HHS’s Aspen Facility Directory printed April 16, 2026 contains 67 facility-ID observations
          and 67 distinct displayed facility IDs. All 67 rows show source status 01-ACTIVE on that
          report. This is a source-dated Basic Care facility population, not a
          current-after-publication status check and not an all-senior-care denominator. The state
          describes Basic Care facilities as state-licensed and not CMS-certified for Medicare or
          Medicaid participation.
        </p>
        <p>
          Source file:{" "}
          <Source href={BASIC_PDF}>North Dakota Basic Care Facilities directory (PDF)</Source>. The
          source clock is the report print date, April 16, 2026.
        </p>
      </section>

      <section aria-labelledby="nursing">
        <h2 id="nursing">Skilled nursing facilities — CMS certification overlay</h2>
        <p>
          The HHS-linked CMS iQIES Name and Address Listing Report, run July 29, 2026, reports 72
          North Dakota nursing-facility provider rows with 72 distinct CCNs and 4,909 CMS-certified
          beds. The report is scoped to federal certification. HHS says skilled nursing facilities
          are also state licensed, but this CMS report is not presented as a state-license roster.
          CMS certified beds are not added to Basic Care capacity.
        </p>
        <p>
          Source file:{" "}
          <Source href={NURSING_PDF}>Skilled Nursing Facilities directory (PDF)</Source> · federal
          source: <Source href={CMS}>CMS certification and compliance</Source>.
        </p>
      </section>

      <section aria-labelledby="assisted">
        <h2 id="assisted">Assisted Living — dated location observations</h2>
        <p>
          HHS’s list marked updated August 28, 2025 contains 70 numbered location entries. The
          entries include license-expiration dates that had passed by this October 14, 2026
          retrieval. They are historical roster observations only: a current active-license count
          and current distinct licensee count are NOT_ACQUIRED. A location row is not automatically
          a distinct business.
        </p>
        <p>
          Source file:{" "}
          <Source href={ASSISTED_PDF}>
            Statewide Licensed Assisted Living Facilities list (PDF)
          </Source>
          . HHS states that assisted-living services to five or more individuals in this setting
          require licensure by the Health Response and Licensure Section and Food and Lodging.
        </p>
      </section>

      <section aria-labelledby="other-classes">
        <h2 id="other-classes">Other care classes and evidence status</h2>
        <ul>
          <li>
            Hospice: the HHS-linked federal iQIES report run July 29, 2026 lists 13 CMS-certified
            provider rows and 13 distinct CCNs. This is a CMS certification overlay, not a state
            license count.
          </li>
          <li>
            Home health: HHS provides a directory page, but its linked facility-list PDF returned
            HTTP 404 during this retrieval. Current source rows are NOT_ACQUIRED.
          </li>
          <li>
            Adult day services, adult residential care, ICF/IID, and other relevant classes: no
            complete current state-license roster was acquired; each remains NOT_ACQUIRED.
          </li>
          <li>
            Inspections, surveys, complaints, and enforcement are separate evidence populations. No
            complaint or enforcement total is inferred from inspection material.
          </li>
          <li>
            CMS certification and certified beds remain federal measures, separate from state
            license status.
          </li>
        </ul>
        <p>
          Sources: <Source href={HOME_HEALTH}>HHS Home Health Agencies</Source>,{" "}
          <Source href={HOSPICE}>HHS Hospice Programs</Source>, and{" "}
          <Source href={HOSPICE_PDF}>HHS-linked Hospice iQIES report (PDF)</Source>.
        </p>
      </section>

      <section aria-labelledby="limits">
        <h2 id="limits">Source clocks and evidence limits</h2>
        <p>
          HHS source pages and directories were checked October 14, 2026. Basic Care report: printed
          April 16, 2026. Nursing and hospice CMS iQIES reports: run July 29, 2026. Assisted-living
          list: marked updated August 28, 2025, with displayed license-expiration dates already past
          at retrieval. No counts across classes are combined. Facility identity, license status,
          beds, survey, enforcement, and CMS certification are distinct.
        </p>
        <p>
          <Source href={HHS}>North Dakota HHS Health Facilities Unit</Source> ·{" "}
          <Source href={BASIC}>Basic Care licensing</Source> ·{" "}
          <Source href={NURSING}>Skilled Nursing Facilities</Source> ·{" "}
          <Source href={ASSISTED}>Assisted Living licensing</Source>
        </p>
        <p>
          <Link
            href="/ask?q=North%20Dakota%20senior%20care%20facility%20licensing"
            className="underline"
          >
            Ask about North Dakota senior-care facility evidence
          </Link>
        </p>
      </section>
    </div>
  );
}
