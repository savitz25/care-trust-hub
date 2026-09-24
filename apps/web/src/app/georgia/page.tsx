import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { GaIntelligenceView } from "@/components/ga-intelligence";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getGaIntelligence } from "@/server/care/ga-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/georgia");
  return {
    title: {
      absolute:
        "Georgia Senior Care Research — DCH HFRD, CMS Nursing Homes & License Classes | SeniorTrustHub",
    },
    description:
      "Research Georgia Personal Care Homes, Assisted Living Communities, and CMS Nursing Home, Home Health, and Hospice directories as separate classes. State rosters were not acquired. No combined facility total and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function GeorgiaPage() {
  const intel = getGaIntelligence();
  const pageUrl = new URL("/georgia", productionOrigin).href;
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
                name: "Georgia Senior Care Research",
                url: pageUrl,
                description:
                  "Georgia DCH HFRD license classes kept separate from CMS Nursing Home, Home Health, and Hospice directories. No rating and no combined provider total.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Georgia nursing home research" },
                  { "@type": "Thing", name: "Georgia personal care home research" },
                  { "@type": "Thing", name: "Georgia assisted living community research" },
                  { "@type": "Thing", name: "CMS Georgia nursing homes" },
                ],
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  { "@type": "ListItem", position: 2, name: "Georgia", item: pageUrl },
                ],
              },
              {
                "@type": "Dataset",
                name: "Georgia senior-care official source snapshot",
                description:
                  "CMS Georgia class overlays plus DCH HFRD class boundaries. State license rosters were not acquired. Not a ranking and not a combined provider total.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="georgia-title">
          <p className="eyebrow">Georgia senior care research</p>
          <h1 id="georgia-title">Georgia Senior Care Research</h1>
          <p className="home-hero__lede">
            SeniorTrustHub keeps Georgia Department of Community Health license classes separate
            from CMS certification. A Personal Care Home is not an Assisted Living Community. An
            Assisted Living Community is not a nursing home. CMS Nursing Homes, Home Health, and
            Hospice in Georgia are already in the federal directories. State license files,
            GaMap2Care rows, and HFRD inspection reports were not acquired. Missing is not zero. No
            ranking.
          </p>
        </section>
        <GaIntelligenceView intel={intel} />
        <TrustStrip />
      </div>
    </>
  );
}
