/**
 * ASK-SEARCH-SENIOR-002 — fail-closed Ask handoff (unsupported care type / invalid).
 * noindex.
 */
import Link from "next/link";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask handoff — unsupported search",
  description: "This AskTrustHub handoff is not supported on SeniorTrustHub nursing-facility search.",
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const REASONS = new Set(["assisted_living", "memory_care", "home_care", "wrong_entity", "invalid_context"]);

function reasonCopy(reason: string): { title: string; body: string } {
  if (reason === "assisted_living") {
    return {
      title: "Assisted living is not this nursing-facility search",
      body: "SeniorTrustHub Ask handoff for Universal Search v1 is CMS-certified nursing facilities only. We do not substitute skilled nursing facilities for assisted living.",
    };
  }
  if (reason === "memory_care") {
    return {
      title: "Memory care is not a supported Ask search type yet",
      body: "We do not infer memory care from facility names, marketing text, or nursing-facility records. This search is not converted into skilled nursing results.",
    };
  }
  if (reason === "home_care") {
    return {
      title: "Home care agencies are not nursing facilities",
      body: "Home care and home health are a different entity type. We will not list CMS nursing facilities as a substitute.",
    };
  }
  if (reason === "wrong_entity") {
    return {
      title: "That care type is not in this Ask handoff",
      body: "Only nursing homes, nursing facilities, skilled nursing facilities, and SNFs resolve into this search. We will not guess another care setting.",
    };
  }
  return {
    title: "This Ask handoff could not be applied",
    body: "The structured search context was missing, invalid, or not allowlisted. We will not invent filters or follow unsafe redirects.",
  };
}

export default async function FromAskUnsupportedPage({ searchParams }: Props) {
  const params = await searchParams;
  const reasonRaw = params.reason;
  const raw = Array.isArray(reasonRaw) ? reasonRaw[0] ?? "" : reasonRaw ?? "";
  const reason = REASONS.has(raw) ? raw : "invalid_context";
  const copy = reasonCopy(reason);

  return (
    <div className="page-shell">
      <header className="page-intro page-intro--compact">
        <p className="eyebrow">Ask handoff</p>
        <h1>{copy.title}</h1>
        <p className="lede">{copy.body}</p>
      </header>
      <p>
        <Link href="/search">Search CMS-certified nursing homes</Link>
        {" · "}
        <Link href="/">SeniorTrustHub home</Link>
      </p>
      <p className="methodology-note">
        Research only. Not an endorsement. No open redirects from Ask context. No health information
        is collected from the handoff.
      </p>
    </div>
  );
}
