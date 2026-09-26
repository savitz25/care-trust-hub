import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { MnIntelligenceView } from "@/components/mn-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getMnFacilityLists, getMnIntelligence } from "@/server/care/mn-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/minnesota");
  return {
    title: {
      absolute:
        "Minnesota Senior Care Research — MDH Nursing Homes, Assisted Living, Dementia Care, Home Care, CMS | SeniorTrustHub",
    },
    description:
      "Research Minnesota Nursing Homes, Assisted Living Facilities, Assisted Living with Dementia Care, Boarding Care Homes, Home Care, Home Health, and Hospice as separate MDH license classes from the daily provider directory, beside CMS directories and MDH evaluation and investigation results. No combined total and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function MinnesotaPage() {
  const intel = getMnIntelligence();
  const lists = getMnFacilityLists();
  const pageUrl = new URL("/minnesota", productionOrigin).href;
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
                name: "Minnesota Senior Care Research",
                url: pageUrl,
                description:
                  "Minnesota Department of Health licenses for Nursing Homes, Assisted Living Facilities, Assisted Living with Dementia Care, Boarding Care Homes, Home Care, Home Health, and Hospice, kept separate from CMS directories. No rating and no combined provider total.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Minnesota nursing home research" },
                  { "@type": "Thing", name: "Minnesota assisted living research" },
                  {
                    "@type": "Thing",
                    name: "Minnesota assisted living with dementia care research",
                  },
                  { "@type": "Thing", name: "CMS Minnesota nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Minnesota", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Minnesota senior-care official source snapshot",
                description:
                  "MDH daily provider-directory licenses by class with licensed beds and exact CMS links, plus MDH evaluation and OHFC investigation results attached by HFID. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="minnesota-title">
          <p className="eyebrow">Minnesota senior care research</p>
          <h1 id="minnesota-title">Minnesota Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub keeps Minnesota care settings separate. An Assisted Living Facility with
            Dementia Care is its own MDH license, a Boarding Care Home is not a nursing home, and
            home care is not home health. A state license is not CMS certification. Licensed beds
            are capacity, not residents. Missing is not zero. No ranking.
          </p>
        </section>
        <MnIntelligenceView intel={intel} lists={lists} />
        <TrustStrip />
      </div>
    </>
  );
}
