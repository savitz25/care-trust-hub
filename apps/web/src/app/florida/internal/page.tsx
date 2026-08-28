import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FloridaProfileQaList } from "@/components/florida-profile-qa";
import { floridaInternalQaAllowed, floridaQaCohort } from "@/server/care/florida-internal-qa";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return {
    title: floridaInternalQaAllowed() ? "Florida profile internal QA" : "Not found",
    robots: { index: false, follow: false },
  };
}

export default function FloridaInternalQaIndexPage() {
  if (!floridaInternalQaAllowed()) notFound();
  return (
    <main className="page-shell">
      <FloridaProfileQaList profiles={floridaQaCohort()} />
    </main>
  );
}
