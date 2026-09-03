import type { Metadata } from "next";
import { TrustStrip, RealDataNotice, SyntheticDataNotice } from "@/components/evidence";
import { SeniorHomeIntelligence } from "@/components/senior-home-intelligence";
import { StructuredData } from "@/components/structured-data";
import { JourneyNextStep } from "@/components/journey-next-step";
import { brand } from "@/config/brand";
import { productionOrigin } from "@/config/deployment";
import { parseNetworkJourney, resolveSeniorJourneyModule } from "@/lib/journey-handoff";
import { getSeniorHomeIntel } from "@/server/care/senior-home-intel";
import { getSeniorNetworkMetrics } from "@/server/care/senior-network-metrics";

export const metadata: Metadata = {
  title: {
    absolute: `${brand.publicName} — Independent Senior-Care Intelligence`,
  },
  description:
    "Research nursing homes, home health, and hospice through published government evidence. Classes stay separate. No Trust Hub score, ranking, or paid placement.",
  alternates: { canonical: productionOrigin.origin },
};

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const navigatorEnabled = process.env.CARE_ENABLE_CARE_NEEDS_NAVIGATOR === "true";
  const plannerEnabled = process.env.CARE_ENABLE_SENIOR_CARE_COST_PLANNER === "true";
  const workspaceEnabled = process.env.CARE_ENABLE_FAMILY_COMPARISON_WORKSPACE === "true";
  const sp = searchParams ? await searchParams : {};
  const journeyModule = resolveSeniorJourneyModule(parseNetworkJourney(sp), "home");
  const intel = getSeniorHomeIntel();
  const networkMetrics = getSeniorNetworkMetrics();
  return (
    <>
      <div className="page-shell home-page">
        {process.env.CARE_ENABLE_REAL_PROVIDER_UI === "true" ? (
          <RealDataNotice compact />
        ) : (
          <SyntheticDataNotice compact />
        )}
        <StructuredData
          value={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            "@id": `${productionOrigin.href}#webpage`,
            name: `${brand.publicName} — Independent Senior-Care Intelligence`,
            url: productionOrigin.href,
            description:
              "National senior-care research hub using published CMS evidence. No aggregate rating.",
            isPartOf: { "@id": `${productionOrigin.href}#website` },
            about: [
              { "@type": "Thing", name: "CMS Nursing Homes" },
              { "@type": "Thing", name: "CMS Home Health Agencies" },
              { "@type": "Thing", name: "CMS Hospice Providers" },
            ],
          }}
        />
        <SeniorHomeIntelligence
          intel={intel}
          networkMetrics={networkMetrics}
          tools={{
            navigator: navigatorEnabled,
            planner: plannerEnabled,
            workspace: workspaceEnabled,
          }}
        />
      </div>
      <div className="page-shell" style={{ paddingBlock: "0 3rem" }}>
        <JourneyNextStep module={journeyModule} />
      </div>
      <TrustStrip />
    </>
  );
}
