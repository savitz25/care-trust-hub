import type { Metadata } from "next";
import { ClassResearchLanding } from "@/components/class-research-landing";
import { productionOrigin } from "@/config/deployment";
import { getSeniorHubIntelligence } from "@/server/care/senior-hub-intelligence";

export const metadata: Metadata = {
  title: {
    absolute: "Hospice Provider Research — CMS Quality, Ownership & Directory | SeniorTrustHub",
  },
  description:
    "Search 6,669 current CMS Hospice providers and research quality measures, CAHPS Hospice Survey evidence, ownership, and official public records. No overall Hospice star and no Trust Hub score.",
  robots: { index: false, follow: false },
};

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
