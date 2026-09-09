import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { executeSeniorResearchQuery } from "@/server/care/senior-ask-execute";
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
  searchParams: Promise<{
    q?: string;
    page?: string;
    class?: string;
    state?: string;
    evidence?: string;
    stars?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 180);
  const page = Math.min(500, Math.max(1, Number(sp.page ?? "1") || 1));
  const effectiveQuery = buildEffectiveQuery(q, sp);
  const result = effectiveQuery ? await executeSeniorResearchQuery(effectiveQuery, page) : null;
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
      <SeniorSpecialistSearchShell query={q} />
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

function buildEffectiveQuery(
  q: string,
  sp: { class?: string; state?: string; evidence?: string; stars?: string },
): string {
  if (!q) return "";
  const classText: Record<string, string> = {
    nursing_home: "nursing homes",
    home_health: "home health agencies",
    hospice: "hospice providers",
  };
  const stateText: Record<string, string> = {
    FL: "Florida",
    NJ: "New Jersey",
    CA: "California",
    TX: "Texas",
    WA: "Washington",
    AZ: "Arizona",
    CO: "Colorado",
  };
  const evidenceText: Record<string, string> = {
    deficiencies: "with indexed deficiencies",
    penalties: "with civil monetary penalties",
    staffing: "with staffing HPRD",
    chow: "with CHOW evidence",
    hhcahps: "with HHCAHPS evidence",
    hospice_cahps: "with CAHPS evidence",
  };
  const starText: Record<string, string> = {
    "5_overall": "with 5 CMS overall stars",
    "5_staffing": "with 5 staffing stars",
    "5_inspection": "with 5 health inspection stars",
  };
  return [
    q,
    classText[sp.class ?? ""],
    stateText[sp.state ?? ""],
    evidenceText[sp.evidence ?? ""],
    starText[sp.stars ?? ""],
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 180);
}
