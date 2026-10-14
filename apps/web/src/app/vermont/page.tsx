import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const facilities = "https://dlp.vermont.gov/survey-cert/facilities-list";
const counties = "https://dlp.vermont.gov/survey-cert/facilities-by-county";
const surveys = "https://dlp.vermont.gov/survey-cert/survey-statements";
const adultDay = "https://asd.vermont.gov/services/adult-day-services";
const sourceList = [
  ["DLP facility directory and state classifications", facilities],
  ["DLP facilities by county", counties],
  ["DLP survey statements", surveys],
  ["Adult day services and provider information", adultDay],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/vermont");
  return {
    title: { absolute: "Vermont Senior Care Facility Licensing | SeniorTrustHub" },
    description:
      "Vermont state facility licensing directories by source-defined class; no combined senior facility count.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function VermontSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="vt-title">
        <p className="eyebrow">Vermont facility licensing evidence</p>
        <h1 id="vt-title">Vermont senior-care facility classes</h1>
        <p className="home-hero__lede">
          Vermont’s Department of Disabilities, Aging and Independent Living and Division of
          Licensing and Protection maintain state-defined facility and service classes. Public
          directories and records were identified, but direct files were inaccessible from this
          acquisition environment (HTTP 403); no gate was bypassed. Counts are therefore
          NOT_ACQUIRED, not zero.
        </p>
      </section>
      <section>
        <h2>Nursing facilities</h2>
        <p>
          State nursing-facility licensing and CMS certification are separate records. Current state
          roster and facility-level rows: <strong>NOT_ACQUIRED</strong>.
        </p>
      </section>
      <section>
        <h2>Assisted living and residential care</h2>
        <p>
          Vermont lists Assisted Living Residences and Residential Care Homes separately.
          Therapeutic Community Residences are another state-defined class. Their current facility
          rows and statuses: <strong>NOT_ACQUIRED</strong>.
        </p>
      </section>
      <section>
        <h2>Home and community services</h2>
        <p>
          Home Health Agencies, hospice services, adult day providers, and other DLP/DAIL regulated
          classes remain separate. Current rows, license identifiers, capacities, inspections, and
          enforcement observations were not acquired.
        </p>
      </section>
      <section>
        <h2>Inspection and enforcement</h2>
        <p>
          Survey statements and enforcement records are separate events; inspection is not
          enforcement. Facility identity is not interchangeable with administrator identity. CMS
          data remains separate from state licensing.
        </p>
      </section>
      <section>
        <h2>Sources and clocks</h2>
        <p>
          Official Vermont sources checked October 14, 2026. Facility directory, survey statements,
          adult-day directory, and home-health list are live or separately updated source classes;
          no shared snapshot date or combined denominator is asserted.
        </p>
        <ul>
          {sourceList.map(([label, href]) => (
            <li key={href}>
              <a href={href} target="_blank" rel="noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
