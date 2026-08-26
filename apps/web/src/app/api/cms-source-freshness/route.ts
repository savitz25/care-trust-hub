import { loadCmsSourceFreshness } from "@/server/care/cms-source-freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sources = await loadCmsSourceFreshness();
    return Response.json(
      {
        version: "cms-source-freshness-v1",
        globalLastUpdated: null,
        sources,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      {
        version: "cms-source-freshness-v1",
        globalLastUpdated: null,
        error: "cms_source_freshness_unavailable",
        sources: [],
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
