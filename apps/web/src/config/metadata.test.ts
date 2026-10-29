import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import AboutPage from "../app/about/page";
import MethodologyPage from "../app/methodology/page";
import PrivacyPage from "../app/privacy/page";
import {
  publicInformationLastModified,
  publicInformationMetadata,
  resolveSiteOrigin,
} from "./metadata";

vi.mock("@/server/care/feature-flags", () => ({
  isCareNeedsNavigatorEnabled: () => false,
  isSeniorCareCostPlannerEnabled: () => false,
}));

describe("site metadata origin", () => {
  it("uses an explicit absolute HTTPS site URL", () => {
    expect(resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://care.example.org" }).href).toBe(
      "https://care.example.org/",
    );
  });

  it("normalizes a scheme-free Vercel hostname to HTTPS", () => {
    expect(resolveSiteOrigin({ VERCEL_URL: "care-preview.vercel.app" }).href).toBe(
      "https://care-preview.vercel.app/",
    );
  });

  it("uses the localhost fallback when no configured origin exists", () => {
    expect(resolveSiteOrigin({}).href).toBe("http://localhost:3000/");
  });

  it("ignores a malformed explicit URL and uses the next valid origin", () => {
    expect(
      resolveSiteOrigin({
        NEXT_PUBLIC_SITE_URL: "not an absolute URL",
        VERCEL_PROJECT_PRODUCTION_URL: "care-production.vercel.app",
      }).href,
    ).toBe("https://care-production.vercel.app/");
  });
});

describe("public information page metadata", () => {
  const production = { VERCEL_ENV: "production", CARE_ENABLE_PUBLIC_LAUNCH: "true" };

  it.each([
    ["About SeniorTrustHub", "/about"],
    ["Data methodology", "/methodology"],
    ["Privacy", "/privacy"],
  ])("uses the route's own canonical for %s", (title, pathname) => {
    expect(publicInformationMetadata(title, pathname, production)).toEqual({
      title,
      alternates: { canonical: `https://www.seniortrusthub.com${pathname}` },
    });
  });

  it("uses source-content commit dates for public-information lastmod values", () => {
    expect(publicInformationLastModified).toEqual({
      "/about": "2026-08-16",
      "/methodology": "2026-08-18",
      "/privacy": "2026-08-16",
      "/sources": "2026-08-26",
      "/independence": "2026-08-16",
      "/terms": "2026-08-16",
      "/contact": "2026-08-24",
      "/trust/corrections": "2026-08-16",
    });
  });

  it("does not add a page canonical before public launch", () => {
    expect(
      publicInformationMetadata("About SeniorTrustHub", "/about", { VERCEL_ENV: "preview" }),
    ).toEqual({
      title: "About SeniorTrustHub",
    });
  });

  it.each([
    ["About", AboutPage, "Research senior care without being sold senior care"],
    ["Methodology", MethodologyPage, "How SeniorTrustHub uses evidence"],
    ["Privacy", PrivacyPage, "Collect less, protect what is submitted"],
  ])("server-renders meaningful %s page content", (_name, Page, heading) => {
    const html = renderToStaticMarkup(createElement(Page));
    expect(html).toContain(`<h1>${heading}</h1>`);
    expect(html.length).toBeGreaterThan(200);
  });
});
