import type { Metadata } from "next";
import type { SeniorRequestParams } from "@/server/care/senior-ask-request";
import { RealDataNotice } from "@/components/evidence";
import { executeSeniorRequest } from "@/server/care/senior-ask-execute";
import { AskResultView } from "./ask-result-view";
import { SeniorSpecialistSearchShell } from "@/components/specialist-search/senior-specialist-search-shell";
import { SearchAnalytics } from "@/components/specialist-search/search-analytics";
import Link from "next/link";
import {
  isTxHhscAskQuery,
  loadTxHhscLocations,
  searchTxHhscLocations,
  txHhscAskSearch,
  txHhscHref,
  TX_HHSC_CLASSES,
} from "@/server/care/tx-hhsc-locations";

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
  const txRequested = q && isTxHhscAskQuery(q, typeof sp.class === "string" ? sp.class : undefined);
  const txAll = txRequested ? await loadTxHhscLocations() : [];
  const txResult = txAll.length ? searchTxHhscLocations(txAll, txHhscAskSearch(q)) : null;
  const result = !txResult && Object.keys(sp).length ? await executeSeniorRequest(sp) : null;
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
      <SeniorSpecialistSearchShell
        query={q}
        filters={txResult ? { class: "tx_hhsc_location" } : result?.query.inputOverrides}
      />
      {txResult ? (
        <section
          aria-label="Texas HHSC regulated location research"
          className="senior-ask__results"
        >
          <h2>Texas HHSC regulated locations/providers</h2>
          <p>
            {txResult.count.toLocaleString()} matching regulated locations. These are source-native
            locations, not canonical organizations or CMS facilities.
          </p>
          <ul>
            {txResult.rows.map((row) => (
              <li key={row.namespaced_key}>
                <Link href={txHhscHref(row)}>{row.official_name}</Link> ·{" "}
                {TX_HHSC_CLASSES[row.provider_class]} · Texas HHSC Facility ID {row.facility_id} ·
                Facility Licensed: {row.facility_licensed_raw}
              </li>
            ))}
          </ul>
          <Link href="/texas/regulated-locations">
            Open Texas location lookup for class and geography filters
          </Link>
        </section>
      ) : null}
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
