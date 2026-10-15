import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const sources = [
  [
    "South Dakota Department of Health, Office of Health Facilities Licensure and Certification",
    "https://doh.sd.gov/healthcare-professionals/health-facility-licensure/",
  ],
  [
    "Facility types and the public licensed-facility lookup",
    "https://doh.sd.gov/healthcare-professionals/health-facility-licensure/facility-types/",
  ],
  [
    "License and registration eligibility",
    "https://doh.sd.gov/healthcare-professionals/health-facility-licensure/healthcare-facility-licensure/",
  ],
  ["SDHLS provider lookup", "https://www.sdhls.org/verify/"],
  [
    "Levels of long-term care",
    "https://doh.sd.gov/topics/long-term-care/levels-of-long-term-care/",
  ],
  [
    "Residential living center registration",
    "https://doh.sd.gov/healthcare-professionals/health-facility-licensure/facility-types/residential-living-centers/",
  ],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/south-dakota");
  return {
    title: { absolute: "South Dakota Senior Care Facility Licensing | SeniorTrustHub" },
    description:
      "South Dakota facility classes stay separate. The public lookup is not a dated statewide roster.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function SouthDakotaSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="sd-title">
        <p className="eyebrow">South Dakota Department of Health</p>
        <h1 id="sd-title">South Dakota senior-care facility classes</h1>
        <p className="home-hero__lede">
          The Office of Health Facilities Licensure and Certification licenses or registers
          distinct facility classes. Those classes are not one senior-care census, and a current
          statewide roster was not acquired.
        </p>
      </section>
      <section aria-labelledby="sd-classes">
        <h2 id="sd-classes">Separate source classes</h2>
        <p>
          Official pages checked October 14, 2026. South Dakota requires licensure for hospitals,
          nursing facilities, assisted living centers, ambulatory surgery centers, adult foster care
          homes, birthing centers, community living homes, X-ray facilities, mammography units,
          inpatient hospice units, and inpatient chemical dependency treatment facilities. Residential
          living centers are registered annually under SDCL 34-12-32. They are not licensed under
          that section. Current row-level records for every class are <strong>NOT_ACQUIRED</strong>.
          That is not a count of zero.
        </p>
        <p>
          The public SDHLS provider list is a lookup that asks for a license, certification, or
          registration type before it searches. This pass did not download a dated bulk file from
          that lookup, and it did not reconstruct a census by searching type by type. Survey and
          complaint report pages are inspection records. They are not a license roster and are not
          counted here.
        </p>
        <p>
          The consumer levels page also names congregate housing and home health. Congregate housing
          is not in the Department’s required-license sentence above. Home health remains a separate
          facility type. Neither is added to nursing facilities or assisted living centers.
        </p>
      </section>
      <section aria-labelledby="sd-boundaries">
        <h2 id="sd-boundaries">Identity and oversight boundaries</h2>
        <ul>
          <li>Nursing facilities, assisted living centers, and adult foster care homes are separate license classes.</li>
          <li>Residential living center registration is not a health-facility license.</li>
          <li>Community living homes are a separate license class, limited by the Department to small adult residences.</li>
          <li>Inpatient hospice is a listed license class and is not a nursing-facility row.</li>
          <li>Licensed beds are not CMS-certified beds. CMS certification is a separate federal population.</li>
          <li>Inspections, complaints, and enforcement are separate records and clocks.</li>
          <li>Nursing facility administrators are licensed persons, not facilities.</li>
        </ul>
      </section>
      <section aria-labelledby="sd-sources">
        <h2 id="sd-sources">Official sources and clocks</h2>
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
          Retrieved October 14, 2026. No combined facility total, bed total, or rating is published.
          Missing rosters stay unknown.
        </p>
      </section>
    </div>
  );
}
