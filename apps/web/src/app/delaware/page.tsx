import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";

const sources = [
  ["Delaware DHSS licensed nursing homes", "https://dhss.delaware.gov/dhcq/dhcq/licensed-nursing-homes/"],
  ["Delaware DHSS licensed assisted living facilities", "https://dhss.delaware.gov/dhcq/dhcq/licensed-assisted-living-facilities/"],
  ["Delaware DHSS adult day care centers", "https://dhss.delaware.gov/dhcq/dhcq/adult-day-care-centers/"],
  ["Delaware DHSS home health agencies – aides only", "https://dhss.delaware.gov/dhcq/dhcq/home-health-agencies-aides-only/"],
  ["Delaware DHSS home health agencies – skilled", "https://dhss.delaware.gov/dhcq/dhcq/home-health-agencies-skilled/"],
  ["Delaware DHSS hospice providers", "https://dhss.delaware.gov/dhcq/dhcq/hospice-providers/"],
  ["Delaware personal assistance services agencies", "https://dhss.delaware.gov/dhcq/dhcq/personal-assistance-services-agencies/"],
  ["Delaware DHSS facility-class index", "https://dhss.delaware.gov/dhcq/index/"],
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/delaware");
  return {
    title: { absolute: "Delaware Senior Facility Licensing Research | SeniorTrustHub" },
    description: "Delaware DHSS facility and service directory observations by source class; no combined senior-care count is asserted.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function DelawarePage() {
  return (
    <div className="page-shell home-page class-research-page">
      <RealDataNotice compact />
      <section className="home-hero" aria-labelledby="de-title">
        <p className="eyebrow">Delaware senior-care licensing research</p>
        <h1 id="de-title">Delaware DHSS facility and service-license classes</h1>
        <p className="home-hero__lede">
          Delaware DHSS publishes distinct facility and service directories. This page reports
          class-specific directory observations and identifier counts; CMS certification remains
          separate.
        </p>
      </section>
      <section aria-labelledby="de-classes">
        <h2 id="de-classes">State source classes</h2>
        <ul>
          <li><strong>Nursing facilities:</strong> 47 directory entries and 47 license identifiers. CMS certification and CMS provider data are separate.</li>
          <li><strong>Assisted living:</strong> 38 directory entries and 38 license identifiers.</li>
          <li><strong>Adult day care:</strong> 10 directory entries and 10 license identifiers; 2 entries display a license expiration date on or before October 12, 2026.</li>
          <li><strong>Home health agencies – aides only:</strong> 13 entries and 13 license identifiers; 4 displayed expiration dates are on or before October 12, 2026.</li>
          <li><strong>Home health agencies – skilled:</strong> 35 entries and 35 license identifiers; 34 entries display an expiration date, and 8 dates are on or before October 12, 2026.</li>
          <li><strong>Hospice:</strong> 13 directory entries and 11 distinct license identifiers. HSPC-010C appears on 3 entries; those source rows remain separate.</li>
          <li><strong>Personal assistance services agencies:</strong> 91 entries and 91 license identifiers; 89 display an expiration date and 20 dates are on or before October 12, 2026. These agency records are not facility rows.</li>
          <li><strong>Residential care:</strong> the reviewed DHSS facility-class index does not list a standalone residential-care roster; no inferred class total is created.</li>
        </ul>
        <p>
          The seven class-specific directory pages were retrieved October 12, 2026 and preserved
          under <code>data/delaware-sen-001/raw/</code>; source-row and identifier summaries are in
          <code>data/delaware-sen-001/derived/</code>. Thirty-four entries display expiration dates
          on or before the retrieval date. Those rows remain directory observations and are not
          classified as active or inactive without renewed-status confirmation. DHSS nursing-home
          and assisted-living directory pages do not show license expiration dates in their listing
          rows. Current license validity is therefore NOT_RECONCILED. Facility ≠ administrator;
          inspection/survey ≠ enforcement. No combined denominator is asserted.
        </p>
      </section>
      <section aria-labelledby="de-sources">
        <h2 id="de-sources">Authoritative sources and clocks</h2>
        <ul>{sources.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
        <p>
          Official DHSS pages and the facility-class index checked October 12, 2026. A displayed
          expiration date is not by itself proof a provider ceased operations; expired-date rows are
          flagged rather than classified. License validity for all entries, facility administrators,
          inspection findings, enforcement actions, and CMS rows were not separately acquired.
        </p>
      </section>
    </div>
  );
}
