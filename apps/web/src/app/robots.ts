import type { MetadataRoute } from "next";
import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";

export default function robots(): MetadataRoute.Robots {
  if (!isPublicLaunchEnabled()) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/development/",
        "/search",
        "/shortlist",
        "/compare",
        "/research",
        "/trust/claim",
        "/trust/correction",
        "/trust/source-concern",
        "/trust/provider-context",
        "/florida/internal",
      ],
    },
    sitemap: new URL("/sitemap.xml", productionOrigin).href,
    host: productionOrigin.origin,
  };
}
