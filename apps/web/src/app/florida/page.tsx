import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { FloridaIntelligenceView } from "@/components/florida-intelligence";
import { StructuredData } from "@/components/structured-data";
import { brand } from "@/config/brand";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getFloridaIntelligence } from "@/server/care/florida-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/florida");
  return {
    title: {
      absolute:
        "Florida Senior Care Research — Licensing, Inspections & Regulatory History | SeniorTrustHub",
    },
    description:
      "Research Florida nursing homes, assisted living, adult family care homes, home health and hospice using official AHCA licensing, inspection, enforcement and CMS evidence. No score.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function FloridaPage() {
  const intel = getFloridaIntelligence();
  const pageUrl = new URL("/florida", productionOrigin).href;
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
                name: "Florida Senior Care Research",
                url: pageUrl,
                description:
                  "Official AHCA licensing, inspection and regulatory evidence for current Florida senior-care provider classes, with national CMS aggregate context. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "Florida AHCA licensed providers" },
                  { "@type": "Thing", name: "Florida assisted living" },
                  { "@type": "Thing", name: "Florida nursing homes" },
                ],
              },
              {
                "@type": "Dataset",
                name: "Florida CURRENT AHCA P0 provider intelligence",
                description:
                  "Aggregate counts of current Florida AHCA P0 identities and connected regulatory observations. Not a ranking.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="florida-title">
          <p className="eyebrow">Florida senior care research</p>
          <h1 id="florida-title">Florida Senior Care Research</h1>
          <p className="home-hero__lede">
            Official AHCA licensing, inspection, and regulatory evidence combined with national CMS
            research. {brand.publicName} does not rank facilities and does not publish a Trust
            Score.
          </p>
        </section>
        <FloridaIntelligenceView intel={intel} />
      </div>
      <TrustStrip />
    </>
  );
}
