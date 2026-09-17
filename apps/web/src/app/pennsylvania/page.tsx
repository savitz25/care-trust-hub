import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { PaIntelligenceView } from "@/components/pa-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getPaIntelligence } from "@/server/care/pa-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/pennsylvania");
  return {
    title: {
      absolute:
        "Pennsylvania Senior Care & Long-Term Care Intelligence — DHS, DOH, CMS | SeniorTrustHub",
    },
    description:
      "Research Pennsylvania DHS Personal Care Homes and Assisted Living, DOH nursing homes, Home Health, Home Care, Hospice, Adult Day, LIFE/PACE, and CMS overlays as separate official datasets. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function PennsylvaniaPage() {
  const intel = getPaIntelligence();
  const pageUrl = new URL("/pennsylvania", productionOrigin).href;
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
                name: "Pennsylvania Senior Care & Long-Term Care Intelligence",
                url: pageUrl,
                description:
                  "Official Pennsylvania DHS, DOH, LIFE/PACE, and CMS class overlays kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Pennsylvania nursing home research" },
                  { "@type": "Thing", name: "Pennsylvania personal care home research" },
                  { "@type": "Thing", name: "Pennsylvania assisted living research" },
                  { "@type": "Thing", name: "Pennsylvania home health agency research" },
                  { "@type": "Thing", name: "Pennsylvania home care agency research" },
                  { "@type": "Thing", name: "Pennsylvania hospice provider research" },
                  { "@type": "Thing", name: "CMS Pennsylvania nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Pennsylvania", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Pennsylvania senior-care official source snapshot",
                description:
                  "DOH nursing-home, Home Health, Home Care, and Hospice license tables, PCH monthly aggregates, LIFE/PACE centers, sanctions PDF extract, and CMS Pennsylvania overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="pennsylvania-title">
          <p className="eyebrow">Pennsylvania senior care research</p>
          <h1 id="pennsylvania-title">Pennsylvania Senior Care & Long-Term Care Intelligence</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Pennsylvania DHS Personal Care Homes and Assisted Living
            Residences, DOH nursing homes, Home Health, Home Care, and Hospice, Adult Day Centers,
            LIFE/PACE, and CMS overlays as separate official datasets. They are not one Pennsylvania
            senior-facilities total. No score and no ranking.
          </p>
        </section>
        <PaIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
