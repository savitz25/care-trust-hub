import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CareNeedsNavigator } from "@/components/care-needs-navigator";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { isCareNeedsNavigatorEnabled } from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  if (!isCareNeedsNavigatorEnabled()) {
    return { title: "Tool not found", robots: publicRobots(false) };
  }
  return {
    title: "What kind of senior care should I look into?",
    description:
      "Answer questions about daily care, safety, memory, medical needs, and caregiver support. SeniorTrustHub explains which care settings may be worth investigating, including home care, assisted living, memory-supportive care, and skilled nursing.",
    alternates: canonicalUrl("/tools/care-needs-navigator")
      ? { canonical: canonicalUrl("/tools/care-needs-navigator") }
      : undefined,
    robots: publicRobots(true),
  };
}

export default function CareNeedsNavigatorPage() {
  if (!isCareNeedsNavigatorEnabled()) notFound();
  return (
    <div className="page-shell">
      <CareNeedsNavigator />
    </div>
  );
}
