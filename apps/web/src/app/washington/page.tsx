import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { WaIntelligenceView } from "@/components/wa-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getWaIntelligence } from "@/server/care/wa-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/washington");
  return {
    title: {
      absolute: "Washington Senior Care Research — DSHS AFH, ALF & CMS | SeniorTrustHub",
    },
    description:
      "Research Washington Adult Family Homes, Assisted Living Facilities, Enhanced Services Facilities, and CMS nursing home, home health, and hospice directories as separate official datasets. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function WashingtonPage() {
  const intel = getWaIntelligence();
  const pageUrl = new URL("/washington", productionOrigin).href;
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
                name: "Washington Senior Care Research",
                url: pageUrl,
                description:
                  "Official Washington DSHS residential-care GIS and CMS class overlays kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Washington Adult Family Homes" },
                  { "@type": "Thing", name: "Washington Assisted Living Facilities" },
                  { "@type": "Thing", name: "Washington CMS nursing homes" },
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
                    name: "Washington",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "Washington senior-care official source snapshot",
                description:
                  "Aggregate counts from DSHS GIS Adult Family Home, Assisted Living, and Enhanced Services classes plus CMS Washington overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="washington-title">
          <p className="eyebrow">Washington senior care research</p>
          <h1 id="washington-title">Washington Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Washington DSHS Adult Family Homes, Assisted Living Facilities,
            and Enhanced Services Facilities separately from CMS Nursing Homes, Home Health, and
            Hospice. They are not one Washington senior-provider total. No score and no ranking.
          </p>
        </section>
        <WaIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
