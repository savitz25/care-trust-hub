import type { Metadata } from "next";
import { formatHubCount } from "@care/domain";
import { ClassResearchLanding } from "@/components/class-research-landing";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getSeniorHubIntelligence } from "@/server/care/senior-hub-intelligence";
import { getSeniorNetworkMetrics } from "@/server/care/senior-network-metrics";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/hospice");
  const current = getSeniorNetworkMetrics().providerUniverses.hospice.current;
  return {
    title: {
      absolute: "Hospice Provider Research — CMS Quality, Ownership & Directory | SeniorTrustHub",
    },
    description: `Search ${formatHubCount(current)} current CMS Hospice providers and research quality measures, CAHPS Hospice Survey evidence, ownership, and official public records. No overall Hospice star and no Trust Hub score.`,
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function Page() {
  const intel = getSeniorHubIntelligence();
  return (
    <ClassResearchLanding
      classId="hospice"
      intel={intel}
      canonical={new URL("/hospice", productionOrigin).href}
    />
  );
}
