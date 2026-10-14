import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const directoryUrl =
  "https://health.wyo.gov/wp-content/uploads/2026/09/2026-2027-Facility-Directory.xlsx";
const landingUrl = "https://health.wyo.gov/aging/hls/healthcare-facility-directory/";
const sources = [
  ["Wyoming Healthcare Facility Directory 2026–2027 (XLSX)", directoryUrl],
  ["Healthcare Facility Directory landing page and source notes", landingUrl],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/wyoming");
  return {
    title: { absolute: "Wyoming Senior Care Facility Licensing | SeniorTrustHub" },
    description:
      "Wyoming facility rows by source class, with license and CMS distinctions preserved.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function WyomingSeniorPage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="wy-title">
        <p className="eyebrow">Wyoming facility directory evidence</p>
        <h1 id="wy-title">Wyoming senior-care facility classes</h1>
        <p className="home-hero__lede">
          Wyoming DPHHS publishes a statewide healthcare facility directory. Its facility types
          remain separate source classes; the directory is not a combined senior-care census.
        </p>
      </section>
      <section aria-labelledby="wy-classes">
        <h2 id="wy-classes">Separate directory classes</h2>
        <p>
          The 2026–2027 directory source was updated October 12, 2026 and retrieved October 14,
          2026. It contains 275 facility rows across 18 directory types. Relevant source classes
          include 3 Adult Day Care (ADC), 31 Assisted Living Facility (ALF), 61 Home Health Agency
          (HHA), 21 Hospice (HSPC), 1 ICF/IID, and 36 Nursing Home (NH) rows. Each listed class has
          the same number of distinct license identifiers as rows in this snapshot. These counts are
          class-specific directory observations, not a combined denominator.
        </p>
        <p>
          The spreadsheet does not provide a current license-status field. These figures describe
          the published directory snapshot and do not establish active status beyond the source.
          Hospital rows are not hospice rows. Other directory types are not added to senior-care
          classes.
        </p>
      </section>
      <section aria-labelledby="wy-boundaries">
        <h2 id="wy-boundaries">Identity and oversight boundaries</h2>
        <ul>
          <li>Facility directory rows and license identifiers are reported by source type.</li>
          <li>Licensed beds, when shown by the directory, are not CMS-certified beds.</li>
          <li>
            Inspections, surveys, complaints, and enforcement are separate records and clocks.
          </li>
          <li>CMS certification remains a separate federal population.</li>
        </ul>
      </section>
      <section aria-labelledby="wy-sources">
        <h2 id="wy-sources">Official sources and clocks</h2>
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
          Directory updated October 12, 2026; retrieved October 14, 2026. Row-level inspection and
          enforcement attachments were not acquired in this pass.
        </p>
      </section>
    </div>
  );
}
