/**
 * ASK-SEARCH-SENIOR-002 — Ask handoff receiving entry.
 * noindex — does not create geo SEO pages or duplicate search architecture.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { parseSeniorAskSearchContext, resolveAskHandoffDestination } from "@care/domain";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask handoff — SeniorTrustHub",
  description: "Structured AskTrustHub search handoff receiver.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FromAskPage({ searchParams }: Props) {
  const params = await searchParams;
  const ctx = parseSeniorAskSearchContext(params);

  if (!ctx) {
    redirect("/from-ask/unsupported?reason=invalid_context");
  }

  const dest = resolveAskHandoffDestination(ctx);
  redirect(dest.href);
}
