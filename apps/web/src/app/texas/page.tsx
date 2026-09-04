import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { TxIntelligenceView } from "@/components/tx-intelligence";
import { StructuredData } from "@/components/structured-data";
import { brand } from "@/config/brand";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getTxIntelligence } from "@/server/care/tx-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/texas");
  return {
    title: {
      absolute: "Texas Senior Care Research — HHSC, TULIP & CMS | SeniorTrustHub",
    },
    description:
      "Research Texas nursing homes, home health, hospice, assisted living, and HCSSA as separate official datasets. CMS overlays, HHSC directories, and TULIP verification stay uncombined. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function TexasPage() {
  const intel = getTxIntelligence();
  const pageUrl = new URL("/texas", productionOrigin).href;
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
                name: "Texas Senior Care Research",
                url: pageUrl,
                description:
                  "Official Texas HHSC, TULIP, and CMS senior-care datasets kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Texas HHSC long-term care regulation" },
                  { "@type": "Thing", name: "Texas assisted living" },
                  { "@type": "Thing", name: "Texas CMS nursing homes" },
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
                    name: "Texas",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "Texas senior-care official source snapshot",
                description:
                  "Aggregate counts from CMS Texas class overlays, HHSC NF/ALF/HCSSA directories, TULIP verification, and closure workbooks. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="texas-title">
          <p className="eyebrow">Texas senior care research</p>
          <h1 id="texas-title">Texas Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub currently organizes Texas CMS class directories, HHSC license
            directories, and TULIP verification as separate official datasets. They are not added
            into one senior-provider total. {brand.publicName} does not rank facilities and does not
            publish a Trust Score.
          </p>
        </section>
        <TxIntelligenceView intel={intel} />
      </div>
      <TrustStrip />
    </>
  );
}
