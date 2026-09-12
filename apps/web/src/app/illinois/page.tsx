import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { IlIntelligenceView } from "@/components/il-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getIlIntelligence } from "@/server/care/il-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/illinois");
  return {
    title: {
      absolute:
        "Illinois Senior Care Research — IDPH, CMS Nursing Homes, Supportive Living | SeniorTrustHub",
    },
    description:
      "Research Illinois CMS nursing homes, IDPH home health and hospice licenses, HFS supportive living sites, and IDPH facility lookup as separate official datasets. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function IllinoisPage() {
  const intel = getIlIntelligence();
  const pageUrl = new URL("/illinois", productionOrigin).href;
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
                name: "Illinois Senior Care Research",
                url: pageUrl,
                description:
                  "Official Illinois IDPH and HFS verification paths and CMS class overlays kept as separate universes. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Illinois nursing home research" },
                  { "@type": "Thing", name: "Illinois nursing home inspections" },
                  { "@type": "Thing", name: "Illinois assisted living license lookup" },
                  { "@type": "Thing", name: "Illinois supportive living program" },
                  { "@type": "Thing", name: "Illinois home health agency research" },
                  { "@type": "Thing", name: "Illinois hospice provider research" },
                  { "@type": "Thing", name: "CMS Illinois nursing homes" },
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
                    name: "Illinois",
                    item: pageUrl,
                  },
                ],
              },
              {
                "@type": "Dataset",
                name: "Illinois senior-care official source snapshot",
                description:
                  "Aggregate CMS Illinois class overlays plus IDPH license directories and HFS Supportive Living operational sites. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="illinois-title">
          <p className="eyebrow">Illinois senior care research</p>
          <h1 id="illinois-title">Illinois Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes Illinois CMS Nursing Homes, IDPH Home Health and Hospice
            licenses, and HFS Supportive Living sites as separate official datasets. Current IDPH
            nursing-home and assisted-living license censuses remain search-only. They are not one
            Illinois senior-provider total. No score and no ranking.
          </p>
        </section>
        <IlIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
