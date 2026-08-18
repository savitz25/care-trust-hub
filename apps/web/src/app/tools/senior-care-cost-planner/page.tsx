import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SeniorCareCostPlanner } from "@/components/senior-care-cost-planner";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import {
  isCareNeedsNavigatorEnabled,
  isSeniorCareCostPlannerEnabled,
} from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!isSeniorCareCostPlannerEnabled()) {
    return { title: "Tool not found", robots: publicRobots(false) };
  }
  return {
    title: "Senior Care Cost Planner",
    description:
      "Compare senior care costs for home care, assisted living, memory care, and nursing homes using published benchmarks and your own quotes. An educational cost calculator, not a provider quote.",
    alternates: canonicalUrl("/tools/senior-care-cost-planner")
      ? { canonical: canonicalUrl("/tools/senior-care-cost-planner") }
      : undefined,
    robots: publicRobots(true),
  };
}

export default function SeniorCareCostPlannerPage() {
  if (!isSeniorCareCostPlannerEnabled()) notFound();
  return (
    <div className="page-shell">
      <SeniorCareCostPlanner navigatorEnabled={isCareNeedsNavigatorEnabled()} />
    </div>
  );
}
