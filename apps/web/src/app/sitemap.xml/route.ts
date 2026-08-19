import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";
import {
  isAssistedLivingIntelligenceEnabled,
  isOwnershipIntelligenceV2Enabled,
} from "@/server/care/feature-flags";
import {
  ASSISTED_LIVING_SITEMAP_PAGE_SIZE,
  getAssistedLivingSitemapCount,
} from "@/server/care/assisted-living-publication";
import {
  FACILITY_SITEMAP_PAGE_SIZE,
  getFacilitySitemapCount,
} from "@/server/care/launch-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isPublicLaunchEnabled()) return new Response("Not found", { status: 404 });
  const pages = Math.ceil((await getFacilitySitemapCount()) / FACILITY_SITEMAP_PAGE_SIZE);
  const assistedPages = isAssistedLivingIntelligenceEnabled()
    ? Math.ceil((await getAssistedLivingSitemapCount()) / ASSISTED_LIVING_SITEMAP_PAGE_SIZE)
    : 0;
  const urls = [
    "core.xml",
    "chains.xml",
    ...(isOwnershipIntelligenceV2Enabled() ? ["organizations.xml"] : []),
    ...Array.from({ length: pages }, (_, index) => `facilities-${index}.xml`),
    ...Array.from({ length: assistedPages }, (_, index) => `assisted-living-${index}.xml`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((value) => `<sitemap><loc>${new URL(`/sitemaps/${value}`, productionOrigin).href}</loc></sitemap>`).join("")}</sitemapindex>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
