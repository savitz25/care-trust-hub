import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { NvIntelligenceView } from "@/components/nv-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getNvFacilityLists, getNvIntelligence } from "@/server/care/nv-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/nevada");
  return {
    title: {
      absolute:
        "Nevada Senior Care Research — HCQC Skilled Nursing, Residential Facilities for Groups, Assisted Living Endorsements, CMS | SeniorTrustHub",
    },
    description:
      "Research Nevada Skilled Nursing, Residential Facilities for Groups, Assisted Living and Alzheimer's endorsements, Homes for Individual Residential Care, Home Health, and Hospice as separate classes from the Nevada Health Authority's HCQC facility search, beside CMS directories. No combined total and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NevadaPage() {
  const intel = getNvIntelligence();
  const lists = getNvFacilityLists();
  const pageUrl = new URL("/nevada", productionOrigin).href;
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
                name: "Nevada Senior Care Research",
                url: pageUrl,
                description:
                  "Nevada Health Authority HCQC licenses for Skilled Nursing, Residential Facilities for Groups with Assisted Living and Alzheimer's endorsements, Homes for Individual Residential Care, Home Health, Hospice, and Adult Day Care, kept separate from CMS directories. No rating and no combined provider total.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Nevada skilled nursing research" },
                  { "@type": "Thing", name: "Nevada residential facility for groups research" },
                  { "@type": "Thing", name: "Nevada assisted living endorsement research" },
                  { "@type": "Thing", name: "CMS Nevada nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Nevada", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Nevada senior-care official source snapshot",
                description:
                  "HCQC active facility licenses by class with endorsements, bed counts, inspection index, and state sanctions, beside CMS Nevada class overlays. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="nevada-title">
          <p className="eyebrow">Nevada senior care research</p>
          <h1 id="nevada-title">Nevada Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub keeps Nevada care settings separate. A Residential Facility for Groups is
            not assisted living unless the state has endorsed it, and neither is a Skilled Nursing
            Facility or a Home for Individual Residential Care. A state license is not CMS
            certification. Beds are capacity, not residents. Missing is not zero. No ranking.
          </p>
        </section>
        <NvIntelligenceView intel={intel} lists={lists} />
        <TrustStrip />
      </div>
    </>
  );
}
