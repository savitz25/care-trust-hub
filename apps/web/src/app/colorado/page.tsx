import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { CoIntelligenceView } from "@/components/co-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getCoIntelligence } from "@/server/care/co-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/colorado");
  return {
    title: {
      absolute: "Colorado Senior Care Research — CDPHE, CMS Nursing Homes & License Lookup | SeniorTrustHub",
    },
    description:
      "Research Colorado nursing homes, inspections, assisted living license lookup, home health agencies, hospice providers, and CDPHE facility lookup as separate official datasets. CMS Colorado overlays stay uncombined. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function ColoradoPage() {
  const intel = getCoIntelligence();
  const pageUrl = new URL("/colorado", productionOrigin).href;
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
                name: "Colorado Senior Care Research",
                url: pageUrl,
                description:
                  "Official Colorado CDPHE verification paths and CMS class overlays kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Colorado nursing home research" },
                  { "@type": "Thing", name: "Colorado nursing home inspections" },
                  { "@type": "Thing", name: "Colorado assisted living license lookup" },
                  { "@type": "Thing", name: "Colorado home health agency research" },
                  { "@type": "Thing", name: "Colorado hospice provider research" },
                  { "@type": "Thing", name: "Colorado CDPHE facility lookup" },
                  { "@type": "Thing", name: "CMS Colorado nursing homes" },
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
                    name: "Colorado",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "Colorado senior-care official source snapshot",
                description:
                  "Aggregate CMS Colorado class overlays plus CDPHE verification and inspection paths. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="colorado-title">
          <p className="eyebrow">Colorado senior care research</p>
          <h1 id="colorado-title">Colorado Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Colorado CMS Nursing Homes, Home Health, and Hospice as
            separate federal directories. CDPHE Find and Compare is the state verification and
            inspection path. Assisted Living Residences are a separate state class. They are not one
            Colorado senior-provider total. No score and no ranking.
          </p>
        </section>
        <CoIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
