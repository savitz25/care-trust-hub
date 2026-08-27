import type { Metadata } from "next";
import { ClassResearchLanding } from "@/components/class-research-landing";
import { productionOrigin } from "@/config/deployment";
import { getSeniorHubIntelligence } from "@/server/care/senior-hub-intelligence";

export const metadata: Metadata = {
  title: {
    absolute: "Home Health Provider Research — CMS Quality, Ownership & Directory | SeniorTrustHub",
  },
  description:
    "Search 12,460 current CMS Home Health providers and research CMS Quality of Patient Care stars, HHCAHPS, ownership, ZIP coverage records, and official-source evidence. No Trust Hub score.",
  robots: { index: false, follow: false },
};

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
