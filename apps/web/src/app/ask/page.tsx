import type { Metadata } from "next";
import { RealDataNotice } from "@/components/evidence";
import { executeSeniorResearchQuery } from "@/server/care/senior-ask-execute";
import { AskResultView } from "./ask-result-view";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask SeniorTrustHub",
  description:
    "Structured senior-care research over CMS nursing home, home health, and hospice directories. Not a ranking engine.",
  robots: { index: false, follow: true },
};

const EXAMPLES = [
  "Show nursing homes in Florida.",
  "Show nursing homes in Palm Beach County.",
  "Find CMS CCN 105502",
  "Show Florida nursing homes with 5 CMS overall stars.",
  "Show home health agencies in Florida.",
  "Show hospice providers in Florida.",
];

export default async function SeniorAskPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Number(sp.page ?? "1") || 1;
  const result = q ? await executeSeniorResearchQuery(q, page) : null;
  return (
    <div className="page-shell">
      <RealDataNotice />
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Ask SeniorTrustHub</p>
        <h1>Structured senior-care research</h1>
        <p className="lede">
          Natural language becomes a deterministic query over published CMS directories. Classes stay
          separate. This is not a chatbot and not a “best nursing home” ranking.
        </p>
      </header>
      <form className="senior-ask__form" action="/ask" method="get" role="search" aria-label="Ask SeniorTrustHub">
        <label htmlFor="senior-ask-q">What do you want to research?</label>
        <div className="senior-ask__form-row">
          <input id="senior-ask-q" name="q" defaultValue={q} placeholder="Show nursing homes in Florida." />
          <button className="button button--primary" type="submit">
            Research
          </button>
        </div>
      </form>
      {!q ? (
        <ul className="senior-ask__examples">
          {EXAMPLES.map((ex) => (
            <li key={ex}>
              <a href={`/ask?q=${encodeURIComponent(ex)}`}>{ex}</a>
            </li>
          ))}
        </ul>
      ) : result ? (
        <AskResultView result={result} />
      ) : null}
    </div>
  );
}
