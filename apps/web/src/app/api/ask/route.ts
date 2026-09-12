import { seniorRequestParams } from "@/server/care/senior-ask-request";
import { NextResponse } from "next/server";
import { executeSeniorRequest } from "@/server/care/senior-ask-execute";
import { SENIOR_ASK_CONTRACT } from "@/server/care/senior-ask-contract";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
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
  const result = await executeSeniorRequest(seniorRequestParams(url.searchParams));
  const publicSafe = {
    contract: result.contract,
    terminalState:
      result.query.terminalState ??
      (result.candidateSelection
        ? "NEEDS_CLARIFICATION"
        : result.facilityAnswer?.status === "UNSUPPORTED"
          ? "UNSUPPORTED"
          : result.failClosed
            ? "UNSUPPORTED"
            : result.entities.length ||
                result.count ||
                result.comparison ||
                result.buckets ||
                result.definition
              ? "COMPLETE"
              : "NO_MATCH"),
    query: result.query,
    interpretation: result.interpretation,
    resultType: result.resultType,
    results: result.entities.map((e) => ({
      providerClass: e.providerClass,
      ccn: e.ccn,
      providerName: e.providerName,
      location: e.location,
      recordedLocation: e.recordedLocation,
      sourceAsOf: e.sourceAsOf,
      statusLabel: e.statusLabel,
      href: e.href,
      evidence: e.evidence,
      whyMatched: e.whyMatched,
      selectionHref: e.selectionHref,
    })),
    count: result.count,
    buckets: result.buckets,
    comparison: result.comparison,
    definition: result.definition,
    pagination: result.pagination,
    provenance: result.provenance,
    limitations: result.limitations,
    failClosed: result.failClosed,
    facilityAnswer: result.facilityAnswer,
    candidateSelection: result.candidateSelection,
  };
  return NextResponse.json(publicSafe, {
    status: result.query.terminalState === "INVALID_INPUT" ? 400 : 200,
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
