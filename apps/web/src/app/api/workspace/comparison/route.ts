import { isFamilyComparisonWorkspaceEnabled } from "@/server/care/feature-flags";
import { loadFamilyWorkspaceComparison } from "@/server/care/family-workspace-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isFamilyComparisonWorkspaceEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const rawCcns = body && typeof body === "object" && "ccns" in body ? body.ccns : [];
  const ccns = Array.isArray(rawCcns) ? rawCcns.filter((value) => typeof value === "string") : [];
  const comparison = await loadFamilyWorkspaceComparison(ccns);
  return Response.json(comparison, { headers: { "Cache-Control": "no-store" } });
}
