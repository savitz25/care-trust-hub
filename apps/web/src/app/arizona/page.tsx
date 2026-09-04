import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { AzIntelligenceView } from "@/components/az-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getAzIntelligence } from "@/server/care/az-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/arizona");
  return {
    title: {
      absolute: "Arizona Senior Care Research — ADHS Assisted Living & CMS | SeniorTrustHub",
    },
    description:
      "Research Arizona Assisted Living Homes, Assisted Living Centers, Adult Foster Care, and CMS nursing home, home health, and hospice directories as separate official datasets. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function ArizonaPage() {
  const intel = getAzIntelligence();
  const pageUrl = new URL("/arizona", productionOrigin).href;
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
                name: "Arizona Senior Care Research",
                url: pageUrl,
                description:
                  "Official Arizona ADHS licensed-facility GIS classes and CMS class overlays kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Arizona Assisted Living Homes" },
                  { "@type": "Thing", name: "Arizona Assisted Living Centers" },
                  { "@type": "Thing", name: "Arizona CMS nursing homes" },
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
                    name: "Arizona",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "Arizona senior-care official source snapshot",
                description:
                  "Aggregate counts from ADHS GIS Assisted Living Home, Assisted Living Center, and Adult Foster Care classes plus CMS Arizona overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="arizona-title">
          <p className="eyebrow">Arizona senior care research</p>
          <h1 id="arizona-title">Arizona Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Arizona ADHS Assisted Living Homes, Assisted Living Centers,
            and Adult Foster Care separately from CMS Nursing Homes, Home Health, and Hospice. They
            are not one Arizona senior-provider total. No score and no ranking.
          </p>
        </section>
        <AzIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
