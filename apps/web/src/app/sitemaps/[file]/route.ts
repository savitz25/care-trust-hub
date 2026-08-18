import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";
import { chainHref, organizationHref, providerSlug } from "@/server/care/consumer";
import {
  isCareNeedsNavigatorEnabled,
  isOwnershipIntelligenceV2Enabled,
  isSeniorCareCostPlannerEnabled,
} from "@/server/care/feature-flags";
import {
  getChainSitemapRows,
  getFacilitySitemapPage,
  getIndexableOrganizationSitemapRows,
} from "@/server/care/launch-repository";

export const dynamic = "force-dynamic";

const corePaths = [
  "/",
  "/about",
  "/methodology",
  "/sources",
  "/independence",
  "/privacy",
  "/terms",
  "/contact",
  "/trust/corrections",
];
const response = (xml: string) =>
  new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
const urlset = (urls: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  if (!isPublicLaunchEnabled()) return new Response("Not found", { status: 404 });
  const { file } = await params;
  if (file === "core.xml") {
    const paths = [
      ...corePaths,
      ...(isCareNeedsNavigatorEnabled() ? ["/tools/care-needs-navigator"] : []),
      ...(isSeniorCareCostPlannerEnabled() ? ["/tools/senior-care-cost-planner"] : []),
    ];
    return response(
      urlset(
        paths
          .map((path) => `<url><loc>${new URL(path, productionOrigin).href}</loc></url>`)
          .join(""),
      ),
    );
  }
  if (file === "chains.xml") {
    const rows = await getChainSitemapRows();
    return response(
      urlset(
        rows
          .map(
            (row) =>
              `<url><loc>${new URL(chainHref({ cmsChainId: row.cms_chain_id, chainName: row.chain_name }), productionOrigin).href}</loc><lastmod>${row.release_month.toISOString().slice(0, 10)}</lastmod></url>`,
          )
          .join(""),
      ),
    );
  }
  if (file === "organizations.xml") {
    if (!isOwnershipIntelligenceV2Enabled()) return new Response("Not found", { status: 404 });
    const rows = await getIndexableOrganizationSitemapRows();
    return response(
      urlset(
        rows
          .map(
            (row) =>
              `<url><loc>${new URL(organizationHref({ organizationId: row.organization_id, organizationName: row.display_name }), productionOrigin).href}</loc><lastmod>${row.derived_at.toISOString().slice(0, 10)}</lastmod></url>`,
          )
          .join(""),
      ),
    );
  }
  const match = /^facilities-(\d+)\.xml$/.exec(file);
  if (!match) return new Response("Not found", { status: 404 });
  const rows = await getFacilitySitemapPage(Number(match[1]));
  if (!rows.length) return new Response("Not found", { status: 404 });
  return response(
    urlset(
      rows
        .map(
          (row) =>
            `<url><loc>${new URL(`/facility/cms/${row.ccn}/${providerSlug(row.provider_name)}`, productionOrigin).href}</loc>${row.observed_at ? `<lastmod>${row.observed_at.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`,
        )
        .join(""),
    ),
  );
}
