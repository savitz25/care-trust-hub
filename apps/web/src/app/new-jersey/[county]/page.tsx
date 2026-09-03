import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { NjCountyIntelligenceView } from "@/components/nj-county-intelligence";
import { StructuredData } from "@/components/structured-data";
import { brand } from "@/config/brand";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { isNjCountySlug, loadNjCountyIntelligence } from "@/server/care/nj-county-intelligence";
import { NJ_COUNTY_SLUGS } from "@care/domain";

type Params = { county: string };

export function generateStaticParams() {
  return NJ_COUNTY_SLUGS.map((county) => ({ county }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { county } = await params;
  if (!isNjCountySlug(county)) {
    return { title: "Not found", robots: { index: false, follow: false } };
  }
  const intel = loadNjCountyIntelligence(county);
  if (!intel) return { title: "Not found", robots: { index: false, follow: false } };
  const canonical = canonicalUrl(intel.path);
  return {
    title: {
      absolute: `${intel.county} County Senior Care Research — NJDOH, PACE & County Resources | SeniorTrustHub`,
    },
    description: `Research ${intel.county} County nursing homes, assisted living, home health, hospice, PACE, and county aging resources using official NJDOH and county sources. No score and no ranking.`,
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(intel.publicationGate.indexable),
  };
}

export default async function NewJerseyCountyPage({ params }: { params: Promise<Params> }) {
  const { county } = await params;
  const intel = loadNjCountyIntelligence(county);
  if (!intel) notFound();
  const pageUrl = new URL(intel.path, productionOrigin).href;
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
                name: `${intel.county} County Senior Care Research`,
                url: pageUrl,
                description: `Official NJDOH licensed identities and county aging resources for ${intel.county} County, New Jersey. Not a ranking.`,
                isPartOf: { "@id": `${productionOrigin.href}#website` },
                about: [
                  { "@type": "Thing", name: `${intel.county} County NJDOH licensed providers` },
                  { "@type": "Thing", name: `${intel.county} County senior care` },
                ],
              },
              {
                "@type": "Dataset",
                name: `${intel.county} County NJDOH senior-care intelligence`,
                description: `County projection of NJDOH All_LTC and All_Acute identities plus county resources. Not a ranking.`,
                creator: { "@id": `${productionOrigin.href}#organization` },
                isAccessibleForFree: true,
                license: "https://www.seniortrusthub.com/methodology",
              },
            ],
          }}
        />
        <section className="home-hero" aria-labelledby="nj-county-title">
          <p className="eyebrow">{intel.county} County senior care research</p>
          <h1 id="nj-county-title">{intel.county} County Senior Care Research</h1>
          <p className="home-hero__lede">
            Official NJDOH licensing evidence for {intel.county} County, with PACE geography and
            county aging resources kept separate from licensed identities. {brand.publicName} does
            not rank facilities and does not publish a Trust Score.
          </p>
        </section>
        <NjCountyIntelligenceView intel={intel} />
      </div>
      <TrustStrip />
    </>
  );
}
