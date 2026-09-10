import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { VaIntelligenceView } from "@/components/va-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getVaIntelligence } from "@/server/care/va-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/virginia");
  return {
    title: {
      absolute:
        "Virginia Senior Care Research — DSS Assisted Living, CMS Nursing Homes | SeniorTrustHub",
    },
    description:
      "Research Virginia assisted living licenses, DSS inspection observations, adult day centers, and CMS nursing homes, home health, and hospice as separate official datasets. ALF is not a nursing home. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function VirginiaPage() {
  const intel = getVaIntelligence();
  const pageUrl = new URL("/virginia", productionOrigin).href;
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
                name: "Virginia Senior Care Research",
                url: pageUrl,
                description:
                  "Official Virginia DSS assisted living universe and CMS class overlays kept as separate datasets. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Virginia assisted living research" },
                  { "@type": "Thing", name: "Virginia DSS assisted living inspections" },
                  { "@type": "Thing", name: "Virginia adult day centers" },
                  { "@type": "Thing", name: "Virginia nursing home research" },
                  { "@type": "Thing", name: "Virginia home health agency research" },
                  { "@type": "Thing", name: "Virginia hospice provider research" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "Home",
                    item: productionOrigin.href,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Virginia",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "Virginia senior-care official source snapshot",
                description:
                  "DSS Assisted Living and Adult Day universes plus CMS Virginia class overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="virginia-title">
          <p className="eyebrow">Virginia senior care research</p>
          <h1 id="virginia-title">Virginia Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Virginia DSS Assisted Living licenses as a complete official
            search universe, keeps Adult Day Centers separate, and overlays CMS Nursing Homes, Home
            Health, and Hospice without combining them. Assisted living is not a nursing home. No
            score and no ranking.
          </p>
        </section>
        <VaIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
