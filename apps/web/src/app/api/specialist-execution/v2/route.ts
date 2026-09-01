import { NextResponse } from "next/server";
import { productionOrigin } from "@/config/deployment";
import { executeSeniorResearchPlan } from "@/server/care/senior-ask-execute";
import {
  SENIOR_SPECIALIST_CAPABILITIES,
  SENIOR_SPECIALIST_EXECUTION_CONTRACT,
  SeniorSpecialistRequestError,
  normalizeSeniorSpecialistRequest,
} from "@/server/care/senior-specialist-execution-v2";

export const dynamic = "force-dynamic";

function publicUrl(path: string): string {
  return new URL(path, productionOrigin.href).href;
}

function errorResponse(error: unknown) {
  if (error instanceof SeniorSpecialistRequestError) {
    return NextResponse.json(
      {
        contract: SENIOR_SPECIALIST_EXECUTION_CONTRACT,
        hub: "senior",
        status: error.status === 422 ? "unsupported_capability" : "invalid_request",
        errorCode: error.code,
        message: error.message,
        ...error.details,
        provenance: {
          sourceFamily: "CMS Care Compare / SeniorTrustHub current directory snapshots",
        },
      },
      { status: error.status },
    );
  }
  console.error("senior_specialist_execution_failed", {
    name: error instanceof Error ? error.name : "unknown",
  });
  return NextResponse.json(
    {
      contract: SENIOR_SPECIALIST_EXECUTION_CONTRACT,
      hub: "senior",
      status: "execution_unavailable",
      errorCode: "execution_unavailable",
      message: "SeniorTrustHub structured execution is temporarily unavailable.",
    },
    { status: 503 },
  );
}

function stars(value: string | null): number[] | undefined {
  return value ? value.split(",").map(Number) : undefined;
}

function requestFromUrl(url: URL): Record<string, unknown> | null {
  const providerClass = url.searchParams.get("providerClass") ?? undefined;
  const identifier = url.searchParams.get("identifier") ?? undefined;
  const geographyType = url.searchParams.get("geographyType") ?? undefined;
  const geographyValue = url.searchParams.get("geographyValue") ?? undefined;
  if (!providerClass && !identifier && !geographyType && !geographyValue) return null;
  return {
    providerClass,
    identifier,
    geography:
      geographyType || geographyValue ? { type: geographyType, value: geographyValue } : undefined,
    filters: {
      overallStars: stars(url.searchParams.get("overallStars")),
      staffingStars: stars(url.searchParams.get("staffingStars")),
      inspectionStars: stars(url.searchParams.get("inspectionStars")),
      qpcStars: stars(url.searchParams.get("qpcStars")),
    },
    page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
  };
}

async function execute(input: unknown) {
  const { request, query } = normalizeSeniorSpecialistRequest(input);
  const result = await executeSeniorResearchPlan(query);
  const countResult = query.identifier
    ? null
    : await executeSeniorResearchPlan({ ...query, mode: "count", page: 1 });
  const total = query.identifier ? result.entities.length : (countResult?.count?.n ?? 0);
  return NextResponse.json(
    {
      contract: SENIOR_SPECIALIST_EXECUTION_CONTRACT,
      hub: "senior",
      status: "ok",
      queryInterpretation: {
        providerClass: query.providerClass ?? null,
        identifier: query.identifier ?? null,
        geography: query.geography ?? null,
        filters: query.qualityFilters ?? null,
        ordering: "neutral_provider_name_then_identifier",
      },
      resultType: query.identifier ? "identity" : "cohort",
      rows: result.entities.map((entity) => ({
        providerClass: entity.providerClass,
        name: entity.providerName,
        cmsCcn: entity.ccn,
        recordedLocation: entity.location,
        status: entity.statusLabel,
        evidence: entity.evidence,
        canonicalProfileUrl: publicUrl(entity.href),
      })),
      total,
      pagination: {
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        hasMore: result.pagination.hasMore,
      },
      availableRefinements: SENIOR_SPECIALIST_CAPABILITIES.refinements,
      provenance: result.provenance,
      limitations: result.limitations,
      request,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

export async function GET(request: Request) {
  try {
    const input = requestFromUrl(new URL(request.url));
    if (!input) return NextResponse.json(SENIOR_SPECIALIST_CAPABILITIES);
    return await execute(input);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > 16_384) {
      throw new SeniorSpecialistRequestError(
        "payload_too_large",
        413,
        "Structured execution requests must not exceed 16 KiB.",
      );
    }
    return await execute(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse(
        new SeniorSpecialistRequestError("invalid_json", 400, "Request body must be valid JSON."),
      );
    }
    return errorResponse(error);
  }
}
