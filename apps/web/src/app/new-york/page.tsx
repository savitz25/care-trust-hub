import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { NyIntelligenceView } from "@/components/ny-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getNyIntelligence } from "@/server/care/ny-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/new-york");
  return {
    title: {
      absolute:
        "New York Senior Care Research — Adult Care, Nursing Homes, CMS | SeniorTrustHub",
    },
    description:
      "Research New York Adult Care Facilities, NYSDOH Nursing Home Profile evidence, Do Not Refer observations, and CMS nursing home, home health, and hospice overlays as separate official datasets. Adult Care is not a nursing home. LHCSA is not CMS Home Health. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NewYorkPage() {
  const intel = getNyIntelligence();
  const pageUrl = new URL("/new-york", productionOrigin).href;
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
                name: "New York Senior Care Research",
                url: pageUrl,
                description:
                  "Official New York Adult Care, Nursing Home Profile, Do Not Refer, and CMS class overlays kept as separate datasets. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "New York adult care facility research" },
                  { "@type": "Thing", name: "New York nursing home research" },
                  { "@type": "Thing", name: "New York Do Not Refer list" },
                  { "@type": "Thing", name: "New York home health research" },
                  { "@type": "Thing", name: "New York hospice research" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "New York", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "New York senior-care official source snapshot",
                description:
                  "NYSDOH Adult Care and Nursing Home Profile layers plus CMS New York class overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="new-york-title">
          <p className="eyebrow">New York senior care research</p>
          <h1 id="new-york-title">New York Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub organizes New York State Department of Health Adult Care Facility
            identities, Nursing Home Profile evidence, and the Do Not Refer list, then overlays CMS
            Nursing Homes, Home Health, and Hospice without combining them. Adult Care is not a
            nursing home. No score and no ranking.
          </p>
        </section>
        <NyIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
