import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const sources = [
  [
    "RSA 151: residential care and health facility licensing",
    "https://gc.nh.gov/rsa/html/xi/151/151-mrg.htm",
  ],
  ["RSA 151:2: facilities requiring a license", "https://gc.nh.gov/rsa/html/XI/151/151-2.htm"],
  ["RSA 151:5: annual license classes", "https://gc.nh.gov/rsa/html/XI/151/151-5.htm"],
  [
    "NH DHHS facility license verification",
    "https://forms.nh.gov/licenseverification/Search.aspx?facility=",
  ],
  [
    "NH DHHS initial and renewal facility application",
    "https://www.dhhs.nh.gov/sites/g/files/ehbemt476/files/documents2/initial-renewal-app-facilities.pdf",
  ],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/new-hampshire");
  return {
    title: { absolute: "New Hampshire Senior Facility Licensing Research | SeniorTrustHub" },
    description:
      "New Hampshire DHHS facility licensing classes and source limits. No combined senior-facility count is asserted.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NewHampshirePage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="nh-title">
        <p className="eyebrow">New Hampshire senior care licensing research</p>
        <h1 id="nh-title">New Hampshire DHHS facility licensing classes</h1>
        <p className="home-hero__lede">
          DHHS licenses distinct facility and service-provider classes under RSA 151. This page
          keeps those state classes separate; it does not combine unlike populations or substitute
          CMS certification data.
        </p>
      </section>
      <section aria-labelledby="nh-classes">
        <h2 id="nh-classes">State source classes</h2>
        <ul>
          <li>
            <strong>Nursing facilities:</strong> a state facility-license population.
            Medicare/Medicaid certification and CMS records are separate.
          </li>
          <li>
            <strong>Assisted living and residential care:</strong> residential and supported
            residential care retain the classifications in statute and DHHS rules.
          </li>
          <li>
            <strong>Adult day care:</strong> separately listed as a state facility-license class.
          </li>
          <li>
            <strong>Home health and hospice:</strong> agencies, individual home health providers,
            home health hospice providers, and hospice houses are separate classes where the source
            defines them.
          </li>
          <li>
            <strong>Personal care and other home-care services:</strong> separate provider or
            individual classes; not facility counts.
          </li>
        </ul>
        <p>
          Current source rows, retrieval attachments, and validated class-specific counts:{" "}
          <strong>NOT_ACQUIRED</strong>. The DHHS online verification portal was not accessible for
          a dated export in this acquisition pass. A blank acquisition is not a zero population.
          Survey and inspection records are not enforcement orders; facilities are not
          administrators.
        </p>
      </section>
      <section aria-labelledby="nh-sources">
        <h2 id="nh-sources">Authoritative sources</h2>
        <ul>
          {sources.map(([label, href]) => (
            <li key={href}>
              <a href={href}>{label}</a>
            </li>
          ))}
        </ul>
        <p>
          RSA 151 identifies separate license classes and requires annual licenses. The DHHS
          published facilities PDF located during research is dated September 6, 2024 and includes
          licenses that expired in 2025; it is stale and is not presented as a current roster or
          denominator. The application form is a classification reference, not a licensee dataset.
        </p>
        <p>
          Official statute and DHHS sources checked October 12, 2026. Current DHHS class-level rows,
          administrators, inspection findings, enforcement actions, and CMS facility data are
          NOT_ACQUIRED here.
        </p>
      </section>
    </div>
  );
}
