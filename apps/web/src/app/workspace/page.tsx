import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FamilyComparisonWorkspace } from "@/components/family-comparison-workspace";
import { publicRobots } from "@/config/deployment";
import {
  isAssistedLivingIntelligenceEnabled,
  isCareNeedsNavigatorEnabled,
  isFamilyComparisonWorkspaceEnabled,
  isFacilityInterviewBuilderEnabled,
  isSeniorCareCostPlannerEnabled,
} from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!isFamilyComparisonWorkspaceEnabled()) {
    return { title: "Page not found", robots: publicRobots(false) };
  }
  return {
    title: "Family Comparison Workspace",
    description:
      "Compare shortlisted CMS-certified nursing facilities using published evidence and your private browser notes.",
    robots: publicRobots(false),
  };
}

export default function FamilyComparisonWorkspacePage() {
  if (!isFamilyComparisonWorkspaceEnabled()) notFound();
  return (
    <div className="page-shell">
      <FamilyComparisonWorkspace
        navigatorEnabled={isCareNeedsNavigatorEnabled()}
        plannerEnabled={isSeniorCareCostPlannerEnabled()}
        interviewBuilderEnabled={isFacilityInterviewBuilderEnabled()}
        assistedLivingEnabled={isAssistedLivingIntelligenceEnabled()}
      />
    </div>
  );
}
