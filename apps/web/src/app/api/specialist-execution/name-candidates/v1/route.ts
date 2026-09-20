import { NextResponse } from "next/server";
import {
  SENIOR_NAME_CANDIDATES_CONTRACT,
  SeniorNameCandidatesRequestError,
  executeSeniorNameCandidates,
  normalizeSeniorNameCandidatesRequest,
} from "@/server/care/senior-name-candidates";

export const dynamic = "force-dynamic";

function errorResponse(error: unknown) {
  if (error instanceof SeniorNameCandidatesRequestError) {
    return NextResponse.json(
      {
        contract: SENIOR_NAME_CANDIDATES_CONTRACT,
        hub: "senior",
        status: "invalid_request",
        errorCode: error.code,
        message: error.message,
        ...error.details,
      },
      { status: error.status },
    );
  }
  console.error("senior_name_candidates_failed", {
    name: error instanceof Error ? error.name : "unknown",
  });
  return NextResponse.json(
    {
      contract: SENIOR_NAME_CANDIDATES_CONTRACT,
      hub: "senior",
      status: "execution_unavailable",
      errorCode: "execution_unavailable",
      message: "SeniorTrustHub name-candidates execution is temporarily unavailable.",
    },
    { status: 503 },
  );
}

async function execute(input: unknown) {
  const normalized = normalizeSeniorNameCandidatesRequest(input);
  const result = await executeSeniorNameCandidates(normalized);
  const status =
    result.resultState === "TECHNICAL_FAILURE"
      ? 503
      : result.resultState === "UNSUPPORTED_OPERATION"
        ? 422
        : 200;
  return NextResponse.json(
    { contract: SENIOR_NAME_CANDIDATES_CONTRACT, hub: "senior", ...result },
    {
      status,
      headers:
        status === 200
          ? { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
          : {},
    },
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");
    if (!name)
      return NextResponse.json({ contract: SENIOR_NAME_CANDIDATES_CONTRACT, hub: "senior" });
    return await execute({
      operation: "provider_name_candidates",
      name,
      providerClass: url.searchParams.get("providerClass") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > 16_384) {
      throw new SeniorNameCandidatesRequestError(
        "payload_too_large",
        413,
        "Name-candidates requests must not exceed 16 KiB.",
      );
    }
    return await execute(await request.json());
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse(
        new SeniorNameCandidatesRequestError(
          "invalid_json",
          400,
          "Request body must be valid JSON.",
        ),
      );
    }
    return errorResponse(error);
  }
}
