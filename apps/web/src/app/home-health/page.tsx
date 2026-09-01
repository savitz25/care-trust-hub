import type { Metadata } from "next";
import { ClassResearchLanding } from "@/components/class-research-landing";
import { canonicalUrl, productionOrigin, publicRobots } from "@/config/deployment";
import { getSeniorHubIntelligence } from "@/server/care/senior-hub-intelligence";

export async function generateMetadata(): Promise<Metadata> {
  const canonical = canonicalUrl("/home-health");
  return {
    title: {
      absolute:
        "Home Health Provider Research — CMS Quality, Ownership & Directory | SeniorTrustHub",
    },
    description:
      "Search 12,460 current CMS Home Health providers and research CMS Quality of Patient Care stars, HHCAHPS, ownership, ZIP coverage records, and official-source evidence. No Trust Hub score.",
    alternates: canonical ? { canonical } : undefined,
    robots: publicRobots(true),
  };
}

export default function Page() {
  const intel = getSeniorHubIntelligence();
  return (
    <ClassResearchLanding
      classId="home_health"
      intel={intel}
      canonical={new URL("/home-health", productionOrigin).href}
    />
  );
}
