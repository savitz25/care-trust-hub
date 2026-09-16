import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { OrIntelligenceView } from "@/components/or-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getOrIntelligence } from "@/server/care/or-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/oregon");
  return {
    title: {
      absolute:
        "Oregon Senior Care Research — ODHS LTC, OHA Home Health & Hospice, CMS | SeniorTrustHub",
    },
    description:
      "Research Oregon ODHS nursing facilities, assisted living, residential care, adult foster homes, inspections, substantiated violations, license-condition regulatory actions, OHA home health and hospice licenses, and CMS overlays as separate official datasets. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function OregonPage() {
  const intel = getOrIntelligence();
  const pageUrl = new URL("/oregon", productionOrigin).href;
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
                name: "Oregon Senior Care Research",
                url: pageUrl,
                description:
                  "Official Oregon ODHS long-term care, OHA home health/hospice, and CMS class overlays kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Oregon nursing facility research" },
                  { "@type": "Thing", name: "Oregon assisted living license lookup" },
                  { "@type": "Thing", name: "Oregon residential care facilities" },
                  { "@type": "Thing", name: "Oregon adult foster homes" },
                  { "@type": "Thing", name: "Oregon home health agency research" },
                  { "@type": "Thing", name: "Oregon hospice provider research" },
                  { "@type": "Thing", name: "CMS Oregon nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Oregon", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Oregon senior-care official source snapshot",
                description:
                  "ODHS LTC providers, inspections, substantiated violations, license-condition regulatory actions, OHA HHA/hospice lists, and CMS Oregon overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="oregon-title">
          <p className="eyebrow">Oregon senior care research</p>
          <h1 id="oregon-title">Oregon Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Oregon ODHS Nursing Facilities, Assisted Living, Residential
            Care, and Adult Foster Homes as separate license classes, plus OHA Home Health and
            Hospice lists and CMS overlays. They are not one Oregon senior-facilities total. Public
            ODHS regulatory-action data currently shows license conditions only. No score and no
            ranking.
          </p>
        </section>
        <OrIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
