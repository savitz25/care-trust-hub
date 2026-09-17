import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { NcIntelligenceView } from "@/components/nc-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getNcIntelligence } from "@/server/care/nc-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/north-carolina");
  return {
    title: {
      absolute:
        "North Carolina Senior Care & Long-Term Care Intelligence — DHSR, DAAS, NCDOI, CMS | SeniorTrustHub",
    },
    description:
      "Research North Carolina Adult Care Homes, Family Care Homes, Nursing Homes, Home Care, Home Health, Hospice, Adult Day, PACE, CCRC, and CMS overlays as separate official datasets. NC DHSR Star Rating is official state evidence, not a TrustHub score. No ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NorthCarolinaPage() {
  const intel = getNcIntelligence();
  const pageUrl = new URL("/north-carolina", productionOrigin).href;
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
                name: "North Carolina Senior Care & Long-Term Care Intelligence",
                url: pageUrl,
                description:
                  "Official North Carolina DHSR, DAAS, NCDOI, and CMS class overlays kept as separate universes. NC DHSR Star Rating is official evidence. No TrustHub rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "North Carolina adult care home research" },
                  { "@type": "Thing", name: "North Carolina family care home research" },
                  { "@type": "Thing", name: "North Carolina nursing home research" },
                  { "@type": "Thing", name: "North Carolina home health agency research" },
                  { "@type": "Thing", name: "North Carolina home care agency research" },
                  { "@type": "Thing", name: "North Carolina hospice provider research" },
                  { "@type": "Thing", name: "CMS North Carolina nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "North Carolina", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "North Carolina senior-care official source snapshot",
                description:
                  "DHSR Adult Care, Family Care, Nursing Home, Home Health, Hospice, mixed Home Care, Nursing Pool, Adult Day, PACE, CCRC, and CMS North Carolina overlays. NC DHSR Star Rating is official evidence. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="north-carolina-title">
          <p className="eyebrow">North Carolina senior care research</p>
          <h1 id="north-carolina-title">
            North Carolina Senior Care & Long-Term Care Intelligence
          </h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes North Carolina Adult Care Homes and Family Care Homes, Nursing
            Homes, Home Care, Home Health, Hospice, Adult Day, PACE, CCRC, and CMS overlays as
            separate official datasets. They are not one North Carolina senior-facilities total. NC
            DHSR Star Rating is official state evidence a consumer may consider. No TrustHub score
            and no ranking.
          </p>
        </section>
        <NcIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
