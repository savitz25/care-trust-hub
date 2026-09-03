import type { Metadata } from "next";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { NjIntelligenceView } from "@/components/nj-intelligence";
import { StructuredData } from "@/components/structured-data";
import { brand } from "@/config/brand";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getNjIntelligence } from "@/server/care/nj-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/new-jersey");
  return {
    title: {
      absolute:
        "New Jersey Senior Care Research — NJDOH Licensing, Staffing & Enforcement | SeniorTrustHub",
    },
    description:
      "Research New Jersey nursing homes, assisted living, home health, hospice, PACE, staffing, Medicaid listed rates, and NJDOH enforcement using official sources. No score and no ranking.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function NewJerseyPage() {
  const intel = getNjIntelligence();
  const pageUrl = new URL("/new-jersey", productionOrigin).href;
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
                name: "New Jersey Senior Care Research",
                url: pageUrl,
                description:
                  "Official NJDOH licensing, staffing, enforcement, Medicaid listed rates, and PACE evidence with national CMS class context. No rating.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: "New Jersey NJDOH licensed providers" },
                  { "@type": "Thing", name: "New Jersey nursing homes" },
                  { "@type": "Thing", name: "New Jersey assisted living" },
                ],
              },
              {
                "@type": "Dataset",
                name: "New Jersey NJDOH senior-care intelligence",
                description:
                  "Aggregate counts of current New Jersey NJDOH All_LTC and All_Acute identities plus related official sources. Not a ranking.",
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="new-jersey-title">
          <p className="eyebrow">New Jersey senior care research</p>
          <h1 id="new-jersey-title">New Jersey Senior Care Research</h1>
          <p className="home-hero__lede">
            Official NJDOH licensing, staffing, and enforcement evidence with Medicaid listed rates,
            PACE geography, and national CMS class context. County research pages are published for
            Monmouth, Middlesex, Somerset, and Union. {brand.publicName} does not rank facilities
            and does not publish a Trust Score.
          </p>
        </section>
        <NjIntelligenceView intel={intel} />
      </div>
      <TrustStrip />
    </>
  );
}
