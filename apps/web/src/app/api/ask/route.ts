import { NextResponse } from "next/server";
import { executeSeniorResearchQuery } from "@/server/care/senior-ask-execute";
import { SENIOR_ASK_CONTRACT } from "@/server/care/senior-ask-contract";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  if (!q) {
    return NextResponse.json(
      {
        contract: SENIOR_ASK_CONTRACT,
        error: "Missing q",
        capability: {
          askExecution: "live",
          identifierLookup: "ccn_labeled",
          providerClasses: ["nursing_home", "home_health", "hospice"],
        },
      },
      { status: 400 },
    );
  }
  const result = await executeSeniorResearchQuery(q, page);
  const publicSafe = {
    contract: result.contract,
    query: result.query,
    interpretation: result.interpretation,
    resultType: result.resultType,
    results: result.entities.map((e) => ({
      providerClass: e.providerClass,
      ccn: e.ccn,
      providerName: e.providerName,
      location: e.location,
      statusLabel: e.statusLabel,
      href: e.href,
      evidence: e.evidence,
      whyMatched: e.whyMatched,
    })),
    count: result.count,
    buckets: result.buckets,
    comparison: result.comparison,
    definition: result.definition,
    pagination: result.pagination,
    provenance: result.provenance,
    limitations: result.limitations,
    failClosed: result.failClosed,
  };
  return NextResponse.json(publicSafe, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
