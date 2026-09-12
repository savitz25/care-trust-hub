import type { Metadata } from "next";
import type { SeniorRequestParams } from "@/server/care/senior-ask-request";
import { RealDataNotice } from "@/components/evidence";
import { executeSeniorRequest } from "@/server/care/senior-ask-execute";
import { AskResultView } from "./ask-result-view";
import { SeniorSpecialistSearchShell } from "@/components/specialist-search/senior-specialist-search-shell";
import { SearchAnalytics } from "@/components/specialist-search/search-analytics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask SeniorTrustHub",
  description:
    "Structured senior-care research over CMS nursing home, home health, and hospice directories. Not a ranking engine.",
  robots: { index: false, follow: true },
};

export default async function SeniorAskPage({
  searchParams,
}: {
  searchParams: Promise<SeniorRequestParams>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const result = Object.keys(sp).length ? await executeSeniorRequest(sp) : null;
  return (
    <div className="page-shell">
      <RealDataNotice />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">SeniorTrustHub specialist research</p>
        <h1>Research senior-care providers and evidence</h1>
        <p className="lede">
          Natural language becomes a deterministic query over published CMS directories. Classes
          stay separate. This is not a chatbot and not a “best nursing home” ranking.
        </p>
      </header>
      <SeniorSpecialistSearchShell query={q} filters={result?.query.inputOverrides} />
      {result ? (
        <>
          <SearchAnalytics
            dimensions={{
              hub: "senior",
              intent: intentFor(result.query.mode),
              providerClass: result.query.providerClass,
              state:
                result.query.geography?.type === "state" ? result.query.geography.value : undefined,
              hasCounty: result.query.geography?.type === "county",
              hasIdentifier: Boolean(result.query.identifier),
              hasEvidenceFilter: Boolean(result.query.metric),
              cmsMetric: result.query.metric,
              coverageState: result.query.coverageState,
            }}
            resultCount={result.entities.length}
          />
          <AskResultView result={result} />
        </>
      ) : null}
    </div>
  );
}

function intentFor(
  mode: string,
): "IDENTITY" | "DISCOVERY" | "EVIDENCE" | "EXPLAIN" | "COUNT" | "COMPARE" | "UNKNOWN" {
  return mode === "identifier"
    ? "IDENTITY"
    : mode === "entity"
      ? "DISCOVERY"
      : mode === "evidence"
        ? "EVIDENCE"
        : mode === "definition"
          ? "EXPLAIN"
          : mode === "count" || mode === "aggregate"
            ? "COUNT"
            : mode === "comparison"
              ? "COMPARE"
              : "UNKNOWN";
}
