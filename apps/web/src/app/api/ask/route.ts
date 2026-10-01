import { seniorRequestParams } from "@/server/care/senior-ask-request";
import { NextResponse } from "next/server";
import { executeSeniorRequest } from "@/server/care/senior-ask-execute";
import { SENIOR_ASK_CONTRACT } from "@/server/care/senior-ask-contract";
import {
  isTxHhscAskQuery,
  loadTxHhscLocations,
  normalizeProviderName,
  resolveTxHhscAsk,
  txHhscHref,
  txHhscSource,
  TX_HHSC_CLASSES,
} from "@/server/care/tx-hhsc-locations";

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
  if (
    isTxHhscAskQuery(q, url.searchParams.get("class") ?? undefined) ||
    normalizeProviderName(q).split(" ").length >= 3
  ) {
    const rows = await loadTxHhscLocations();
    if (rows.length) {
      const match = resolveTxHhscAsk(rows, q, url.searchParams.get("class") ?? undefined);
      if (match) {
        const { found, bareName } = match;
        const cms = bareName
          ? await executeSeniorRequest(seniorRequestParams(url.searchParams))
          : null;
        const otherMatches =
          cms?.entities.filter(
            (entity) => normalizeProviderName(entity.providerName) === normalizeProviderName(q),
          ) ?? [];
        return NextResponse.json(
          {
            contract: SENIOR_ASK_CONTRACT,
            terminalState:
              otherMatches.length || (bareName && found.count > 1)
                ? "NEEDS_CLARIFICATION"
                : found.count
                  ? "COMPLETE"
                  : "NO_MATCH",
            resultType:
              otherMatches.length || (bareName && found.count > 1)
                ? "ambiguous_provider_name"
                : "regulated_location",
            ambiguity: otherMatches.length
              ? "The same published name occurs in another provider class or jurisdiction. Narrow by state and provider class; these records are not the same organization."
              : bareName && found.count > 1
                ? `Multiple Texas HHSC locations match this published name. Choose the Facility ID and provider class; they are not one organization.${found.count > 20 ? " Showing the first 20; add a city or class to narrow the search." : ""}`
                : undefined,
            otherMatches: otherMatches.map((entity) => ({
              providerName: entity.providerName,
              providerClass: entity.providerClass,
              recordedLocation: entity.recordedLocation,
              href: entity.href,
            })),
            count: {
              n: found.count,
              grain: "Texas HHSC regulated locations/providers",
              denominator: "Certified Texas HHSC batch only; canonical organizations excluded",
            },
            results: found.rows.map((row) => ({
              identity: row.namespaced_key,
              providerClass: row.provider_class,
              providerClassLabel: TX_HHSC_CLASSES[row.provider_class],
              facilityId: row.facility_id,
              providerName: row.official_name,
              recordedLocation: { city: row.city, state: row.state, county: row.county },
              facilityLicensedRaw: row.facility_licensed_raw,
              licenseNumber: row.license_number,
              href: txHhscHref(row),
              organizationLinkage: "Not established",
              source: txHhscSource(row),
            })),
            pagination: { page: found.page, pageSize: 20, hasMore: found.count > 20 },
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }
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
