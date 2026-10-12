import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const sources = [
  ["Maine Licensed Provider Search", "https://gateway.maine.gov/dhhs-apps/aspen/index.asp"],
  [
    "Provider search help and classification notes",
    "https://gateway.maine.gov/dhhs-apps/aspen/help.asp",
  ],
  [
    "Assisted Housing licensing",
    "https://www.maine.gov/dhhs/dlc/licensing-certification/assisted-housing",
  ],
  [
    "Nursing Facilities",
    "https://www.maine.gov/dhhs/dlc/licensing-certification/medical-facilities/nursing-facilities",
  ],
  [
    "Personal Care Agencies",
    "https://www.maine.gov/dhhs/dlc/licensing-certification/personal-care-agencies",
  ],
  [
    "Division of Licensing and Certification",
    "https://www.maine.gov/dhhs/programs-services/inspections-licensing",
  ],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/maine");
  return {
    title: { absolute: "Maine Senior Care Licensing Research | SeniorTrustHub" },
    description:
      "Maine DHHS facility licensing sources and class boundaries. No combined senior-facility count is asserted.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function MainePage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="me-title">
        <p className="eyebrow">Maine senior care licensing research</p>
        <h1 id="me-title">Maine DHHS facility licensing sources</h1>
        <p className="home-hero__lede">
          Maine DHHS Division of Licensing and Certification publishes separate provider-search
          classes and separate Assisted Housing facility search. This page records those regulatory
          classes and sources; it does not combine unlike populations or imply a CMS count.
        </p>
      </section>
      <section aria-labelledby="me-classes">
        <h2 id="me-classes">State source classes</h2>
        <ul>
          <li>
            <strong>Nursing facilities:</strong> state licensing and federal certification are
            distinct; CMS is not included here.
          </li>
          <li>
            <strong>Assisted living and residential care:</strong> DHHS Assisted Housing program;
            level and program classifications remain source-defined.
          </li>
          <li>
            <strong>Adult day:</strong> separately licensed under the Assisted Housing program.
          </li>
          <li>
            <strong>Home health and hospice:</strong> distinct provider-search classes; some entries
            describe agencies serving multiple locations.
          </li>
          <li>
            <strong>Personal care agencies:</strong> a separate state licensing class.
          </li>
        </ul>
        <p>
          Current source rows, retrieval attachments, and validated class-specific counts:{" "}
          <strong>NOT_ACQUIRED</strong>. A blank acquisition is not a zero population. Inspections
          are not enforcement orders, and facilities are not administrators.
        </p>
      </section>
      <section aria-labelledby="me-sources">
        <h2 id="me-sources">Authoritative sources</h2>
        <ul>
          {sources.map(([label, href]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>
        <p>
          The Licensed Provider Search displayed its update date as October 11, 2026 when checked
          October 12, 2026. Its search help directs Adult Day and Assisted Living / Residential Care
          Levels I–III to a separate Assisted Living Facilities Search. No exportable, reconciled
          rows were acquired for publication in this pass.
        </p>
      </section>
    </div>
  );
}
