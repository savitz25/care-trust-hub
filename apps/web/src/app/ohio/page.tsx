import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { OhIntelligenceView } from "@/components/oh-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getOhIntelligence } from "@/server/care/oh-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/ohio");
  return {
    title: {
      absolute: "Ohio Senior Care & Long-Term Care Intelligence — ODH, AGE, CMS | SeniorTrustHub",
    },
    description:
      "Research Ohio Nursing Homes and Residential Care Facilities (assisted living) as separate ODH license classes, plus CMS overlays. The Long-Term Care Quality Navigator is official evidence, not a TrustHub score. No ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function OhioPage() {
  const intel = getOhIntelligence();
  const pageUrl = new URL("/ohio", productionOrigin).href;
  return (
    <>
      <div className="page-shell home-page class-research-page">
        <RealDataNotice compact />
        <StructuredData
          value={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebPage",
                "@id": `${pageUrl}#webpage`,
                name: "Ohio Senior Care & Long-Term Care Intelligence",
                url: pageUrl,
                description:
                  "Official Ohio ODH nursing-home and Residential Care Facility licenses kept separate from CMS overlays. Navigator quality data is official evidence. No TrustHub rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Ohio nursing home research" },
                  { "@type": "Thing", name: "Ohio Residential Care Facility research" },
                  { "@type": "Thing", name: "Ohio assisted living research" },
                  { "@type": "Thing", name: "CMS Ohio nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Ohio", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Ohio senior-care official source snapshot",
                description:
                  "ODH OneSource nursing homes and Residential Care Facilities plus CMS Ohio overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="ohio-title">
          <p className="eyebrow">Ohio senior care research</p>
          <h1 id="ohio-title">Ohio Senior Care & Long-Term Care Intelligence</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Ohio Nursing Homes and Residential Care Facilities as separate
            ODH license classes. RCF is Ohio&apos;s formal assisted-living license. State license is
            not CMS certification. The Long-Term Care Quality Navigator publishes official quality
            and satisfaction evidence — not a TrustHub score. Home Health is not Hospice. PACE is
            not a facility license. Inspection is not a complaint. Missing is not zero. No ranking.
          </p>
        </section>
        <OhIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
