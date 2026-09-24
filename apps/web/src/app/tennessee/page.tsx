import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { TnIntelligenceView } from "@/components/tn-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getTnFacilityLists, getTnIntelligence } from "@/server/care/tn-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/tennessee");
  return {
    title: {
      absolute:
        "Tennessee Senior Care Research — HFC Nursing Homes, Assisted Care Living, Homes for the Aged, CMS | SeniorTrustHub",
    },
    description:
      "Research Tennessee Nursing Homes, Assisted Care Living Facilities, Residential Homes for the Aged, Home Health, and Hospice as separate classes from Health Facilities Commission reports, beside CMS directories. HFC facility actions 2024-2026. No combined total and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function TennesseePage() {
  const intel = getTnIntelligence();
  const lists = getTnFacilityLists();
  const pageUrl = new URL("/tennessee", productionOrigin).href;
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
                name: "Tennessee Senior Care Research",
                url: pageUrl,
                description:
                  "Tennessee Health Facilities Commission Nursing Home, Assisted Care Living Facility, and Residential Home for the Aged reports, Home Health and Hospice county lists, and facility actions, kept separate from CMS directories. No rating and no combined provider total.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Tennessee nursing home research" },
                  { "@type": "Thing", name: "Tennessee assisted care living facility research" },
                  { "@type": "Thing", name: "Tennessee residential home for the aged research" },
                  { "@type": "Thing", name: "CMS Tennessee nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Tennessee", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Tennessee senior-care official source snapshot",
                description:
                  "HFC July 2026 Nursing Home, ACLF, and Residential Home for the Aged bed reports, Home Health and Hospice county lists, and monthly facility actions, beside CMS Tennessee class overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="tennessee-title">
          <p className="eyebrow">Tennessee senior care research</p>
          <h1 id="tennessee-title">Tennessee Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub keeps Tennessee care settings separate. An Assisted Care Living Facility
            is not a Nursing Home, and a Residential Home for the Aged is neither. The Health
            Facilities Commission licenses all of them; a state license is not CMS certification.
            Beds are capacity, not residents. Missing is not zero. No ranking.
          </p>
        </section>
        <TnIntelligenceView intel={intel} lists={lists} />
        <TrustStrip />
      </div>
    </>
  );
}
