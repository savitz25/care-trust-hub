import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { MaIntelligenceView } from "@/components/ma-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getMaFacilityLists, getMaIntelligence } from "@/server/care/ma-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/massachusetts");
  return {
    title: {
      absolute:
        "Massachusetts Senior Care Research — DPH Nursing & Rest Homes, AGE Assisted Living, CMS | SeniorTrustHub",
    },
    description:
      "Research Massachusetts Nursing Homes, Rest Homes, AGE-certified Assisted Living Residences, Home Health, and Hospice as separate classes from DPH and AGE lists, beside CMS directories. No combined facility total and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function MassachusettsPage() {
  const intel = getMaIntelligence();
  const lists = getMaFacilityLists();
  const pageUrl = new URL("/massachusetts", productionOrigin).href;
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
                name: "Massachusetts Senior Care Research",
                url: pageUrl,
                description:
                  "Massachusetts DPH Nursing Home, Rest Home, Home Health, and Hospice listings and AGE-certified Assisted Living Residences, kept separate from CMS directories. No rating and no combined provider total.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Massachusetts nursing home research" },
                  { "@type": "Thing", name: "Massachusetts rest home research" },
                  { "@type": "Thing", name: "Massachusetts assisted living residence research" },
                  { "@type": "Thing", name: "CMS Massachusetts nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Massachusetts", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Massachusetts senior-care official source snapshot",
                description:
                  "DPH licensed or certified facility workbook (senior classes) and AGE certified Assisted Living Residence list, beside CMS Massachusetts class overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="massachusetts-title">
          <p className="eyebrow">Massachusetts senior care research</p>
          <h1 id="massachusetts-title">Massachusetts Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub keeps Massachusetts care settings separate. A Rest Home is not a Nursing
            Home, and neither is an Assisted Living Residence. DPH licenses nursing homes and rest
            homes; AGE certifies assisted living. A state license is not CMS certification. The DPH
            survey tool is DPH&apos;s own measure, not a TrustHub score. Missing is not zero. No
            ranking.
          </p>
        </section>
        <MaIntelligenceView intel={intel} lists={lists} />
        <TrustStrip />
      </div>
    </>
  );
}
