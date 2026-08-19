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
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items = rawItems.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { kind?: unknown; id?: unknown };
    if (typeof row.id !== "string") return [];
    if (row.kind === "assisted_living" || row.kind === "cms") {
      return [{ kind: row.kind as "assisted_living" | "cms", id: row.id }];
    }
    return [];
  });
  const rawCcns = Array.isArray(record.ccns) ? record.ccns : [];
  const ccns = rawCcns.filter((value): value is string => typeof value === "string");
  const comparison = await loadFamilyWorkspaceComparison(ccns, items);
  return Response.json(comparison, { headers: { "Cache-Control": "no-store" } });
}
