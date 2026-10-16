import type { Metadata } from "next";
import {
  FLORIDA_ALF_LOOKUP_PATH,
  floridaAlfCountyOptions,
  lookupFloridaPublishedAlf,
  parseFloridaAlfLookupQuery,
} from "@care/domain";
import { TrustStrip, RealDataNotice } from "@/components/evidence";
import { FloridaAlfLookup } from "@/components/florida-alf-lookup";
import { StructuredData } from "@/components/structured-data";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { loadFloridaPublishedAlf } from "@/server/care/florida-alf-cohort";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl(FLORIDA_ALF_LOOKUP_PATH);
  return {
    title: {
      absolute: "Florida Assisted Living Records — AHCA File Lookup | SeniorTrustHub",
    },
    description:
      "Look up the published Phase 1 Florida assisted-living records by facility name or AHCA file number, then open the source-backed record.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function FloridaAssistedLivingLookupPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = parseFloridaAlfLookupQuery({
    name: params.name,
    file: params.file,
    county: params.county,
  });
  const loaded = await loadFloridaPublishedAlf();
  const countyOptions = floridaAlfCountyOptions(loaded.records);
  const countyState = !loaded.countyFilterAvailable
    ? "unavailable"
    : countyOptions.length === 0
      ? "unrecorded"
      : "ready";
  const countyBlocked = query.county.trim().length > 0 && countyState !== "ready";
  const result = countyBlocked
    ? { status: "none" as const, records: [] }
    : lookupFloridaPublishedAlf(loaded.records, {
        name: query.name,
        file: query.file,
        county: countyState === "ready" ? query.county : "",
      });
  const pageUrl = new URL(FLORIDA_ALF_LOOKUP_PATH, productionOrigin).href;

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
                name: "Florida assisted-living records",
                url: pageUrl,
                description:
                  "Published Phase 1 Florida assisted-living records looked up by facility name or AHCA file number. Not a ranking.",
                isPartOf: { "@id": `${productionOrigin.href}#website` },
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: "Florida",
                    item: new URL("/florida", productionOrigin).href,
                  },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: "Assisted living records",
                    item: pageUrl,
                  },
                ],
              },
            ],
          }}
        />
        <FloridaAlfLookup
          query={query}
          result={result}
          cohortCount={loaded.records.length}
          countyState={countyState}
          countyOptions={countyOptions}
          countyBlocked={countyBlocked}
        />
      </div>
      <TrustStrip />
    </>
  );
}
