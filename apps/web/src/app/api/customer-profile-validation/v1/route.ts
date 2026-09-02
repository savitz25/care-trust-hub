import { NextResponse } from "next/server";
import {
  SENIOR_CUSTOMER_VALIDATION_CAPABILITIES,
  SENIOR_CUSTOMER_VALIDATION_CONTRACT,
  SENIOR_CUSTOMER_VALIDATION_CONTRACT_FINGERPRINT,
  SENIOR_CUSTOMER_VALIDATION_SCHEMA_FINGERPRINT,
  SENIOR_CUSTOMER_VALIDATION_VERSION,
  SeniorCustomerValidationError,
  validateSeniorCustomerProfile,
} from "@/server/care/senior-customer-profile-validation";

export const dynamic = "force-dynamic";
const base = {
  contract: SENIOR_CUSTOMER_VALIDATION_CONTRACT,
  contractVersion: SENIOR_CUSTOMER_VALIDATION_VERSION,
  schemaFingerprint: SENIOR_CUSTOMER_VALIDATION_SCHEMA_FINGERPRINT,
  contractFingerprint: SENIOR_CUSTOMER_VALIDATION_CONTRACT_FINGERPRINT,
  hub: "senior",
};
export async function GET() {
  return NextResponse.json(SENIOR_CUSTOMER_VALIDATION_CAPABILITIES, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
export async function POST(request: Request) {
  try {
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > 8192)
      throw new SeniorCustomerValidationError(
        "invalid_request",
        413,
        "Validation requests must not exceed 8 KiB.",
      );
    return NextResponse.json(await validateSeniorCustomerProfile(await request.json()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    if (error instanceof SyntaxError)
      return NextResponse.json(
        {
          ...base,
          status: "invalid_request",
          errorCode: "invalid_request",
          message: "Request body must be valid JSON.",
        },
        { status: 400 },
      );
    if (error instanceof SeniorCustomerValidationError)
      return NextResponse.json(
        { ...base, status: "rejected", errorCode: error.code, message: error.message },
        { status: error.status },
      );
    console.error("senior_customer_profile_validation_failed", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      {
        ...base,
        status: "unavailable",
        errorCode: "backend_unavailable",
        message: "SeniorTrustHub profile validation is temporarily unavailable.",
      },
      { status: 503 },
    );
  }
}
