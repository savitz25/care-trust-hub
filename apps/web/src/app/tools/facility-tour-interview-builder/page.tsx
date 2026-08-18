import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FacilityInterviewBuilder } from "@/components/facility-interview-builder";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import {
  isCareNeedsNavigatorEnabled,
  isFacilityInterviewBuilderEnabled,
  isSeniorCareCostPlannerEnabled,
} from "@/server/care/feature-flags";
import { loadInterviewFacilityContext } from "@/server/care/interview-facility-context";

export const dynamic = "force-dynamic";

const BUILDER_PATH = "/tools/facility-tour-interview-builder";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ ccn?: string }>;
}): Promise<Metadata> {
  if (!isFacilityInterviewBuilderEnabled()) {
    return { title: "Tool not found", robots: publicRobots(false) };
  }
  const { ccn } = await searchParams;
  const facilitySpecific = Boolean(ccn?.trim());
  return {
    title: "Build your care-provider interview checklist",
    description:
      "Create a personalized nursing home tour checklist, assisted living or memory care tour questions, or home-care agency interview questions. Educational questions only — not a facility score.",
    alternates: canonicalUrl(BUILDER_PATH) ? { canonical: canonicalUrl(BUILDER_PATH) } : undefined,
    robots: publicRobots(!facilitySpecific),
  };
}

export default async function FacilityTourInterviewBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ ccn?: string }>;
}) {
  if (!isFacilityInterviewBuilderEnabled()) notFound();
  const { ccn } = await searchParams;
  const facility = await loadInterviewFacilityContext(ccn);
  return (
    <div className="page-shell">
      <FacilityInterviewBuilder
        facilityName={facility?.facilityName ?? null}
        facilityCcn={facility?.ccn ?? null}
        facilityHref={facility?.facilityHref ?? null}
        facilityEvidence={facility?.evidence ?? null}
        navigatorEnabled={isCareNeedsNavigatorEnabled()}
        plannerEnabled={isSeniorCareCostPlannerEnabled()}
      />
    </div>
  );
}
