import { NextResponse } from "next/server";
import { isTrustParticipationEnabled } from "@/server/care/feature-flags";
import { submitTrustRequest } from "@/server/care/trust-participation";
export async function POST(request: Request) {
  if (!isTrustParticipationEnabled())
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > 20_000) throw new RangeError("Request is too large.");
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new RangeError("Enter a valid request.");
    }
    const result = await submitTrustRequest(body);
    return NextResponse.json({ requestId: result.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof RangeError ? error.message : "Unable to submit request." },
      { status: error instanceof RangeError ? 400 : 500 },
    );
  }
}
