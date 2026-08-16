import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";
import {
  FACILITY_SITEMAP_PAGE_SIZE,
  getFacilitySitemapCount,
} from "@/server/care/launch-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isPublicLaunchEnabled()) return new Response("Not found", { status: 404 });
  const pages = Math.ceil((await getFacilitySitemapCount()) / FACILITY_SITEMAP_PAGE_SIZE);
  const urls = [
    "core.xml",
    "chains.xml",
    ...Array.from({ length: pages }, (_, index) => `facilities-${index}.xml`),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((value) => `<sitemap><loc>${new URL(`/sitemaps/${value}`, productionOrigin).href}</loc></sitemap>`).join("")}</sitemapindex>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
