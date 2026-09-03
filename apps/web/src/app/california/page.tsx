import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { CaIntelligenceView } from "@/components/ca-intelligence";
import { StructuredData } from "@/components/structured-data";
import { brand } from "@/config/brand";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getCaIntelligence } from "@/server/care/ca-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/california");
  return {
    title: {
      absolute: "California Senior Care Research — CDPH, CCLD RCFE, HCAI & CMS | SeniorTrustHub",
    },
    description:
      "Research California skilled nursing, home health, hospice, RCFE, and home care organizations as separate official datasets. Source dates, contact coverage, and CMS crosswalks stay uncombined. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function CaliforniaPage() {
  const intel = getCaIntelligence();
  const pageUrl = new URL("/california", productionOrigin).href;
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
                name: "California Senior Care Research",
                url: pageUrl,
                description:
                  "Official California CDPH, CCLD, HCAI, and CMS senior-care datasets kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "California CDPH licensed healthcare facilities" },
                  { "@type": "Thing", name: "California RCFE" },
                  { "@type": "Thing", name: "California CMS nursing homes" },
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
                    name: "California",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "California senior-care official source snapshot",
                description:
                  "Aggregate counts from CDPH ELMS, CCLD RCFE, HCAI, Home Care Organizations, and CMS class overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="california-title">
          <p className="eyebrow">California senior care research</p>
          <h1 id="california-title">California Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub currently organizes several separate California state and federal
            facility datasets. CDPH, CCLD RCFE, HCAI, Home Care Organizations, and CMS class
            directories are not added into one senior-provider total. {brand.publicName} does not
            rank facilities and does not publish a Trust Score.
          </p>
        </section>
        <CaIntelligenceView intel={intel} />
      </div>
      <TrustStrip />
    </>
  );
}
