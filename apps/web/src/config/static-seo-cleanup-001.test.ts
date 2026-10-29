import { afterEach, describe, expect, it, vi } from "vitest";
import {
  publicInformationLastModified,
  publicInformationLastModifiedTag,
  publicInformationMetadata,
} from "./metadata";

vi.mock("server-only", () => ({}));

afterEach(() => vi.unstubAllEnvs());

describe("static SEO cleanup 001", () => {
  it("assigns each affected route its own canonical without changing robots metadata", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CARE_ENABLE_PUBLIC_LAUNCH", "true");
    const routes = [
      ["../app/trust/corrections/page", "/trust/corrections"],
      ["../app/sources/page", "/sources"],
      ["../app/independence/page", "/independence"],
      ["../app/terms/page", "/terms"],
      ["../app/contact/page", "/contact"],
    ] as const;

    for (const [modulePath, pathname] of routes) {
      const route = await import(modulePath);
      expect(route.metadata.alternates?.canonical).toBe(
        `https://www.seniortrusthub.com${pathname}`,
      );
      expect(route.metadata).not.toHaveProperty("robots");
    }
  });

  it("generates self-canonicals only when the existing public launch gate is enabled", () => {
    const production = {
      VERCEL_ENV: "production",
      CARE_ENABLE_PUBLIC_LAUNCH: "true",
    };

    for (const pathname of [
      "/trust/corrections",
      "/sources",
      "/independence",
      "/terms",
      "/contact",
    ]) {
      const metadata = publicInformationMetadata("Page title", pathname, production);
      expect(metadata.alternates?.canonical).toBe(`https://www.seniortrusthub.com${pathname}`);
      expect(metadata).not.toHaveProperty("robots");
    }

    expect(
      publicInformationMetadata("Page title", "/sources", {
        VERCEL_ENV: "production",
        CARE_ENABLE_PUBLIC_LAUNCH: "false",
      }),
    ).not.toHaveProperty("alternates");
  });

  it("records only the verified static-page content dates in the core sitemap map", () => {
    expect(publicInformationLastModified).toMatchObject({
      "/sources": "2026-08-26",
      "/independence": "2026-08-16",
      "/terms": "2026-08-16",
      "/contact": "2026-08-24",
      "/trust/corrections": "2026-08-16",
    });
    expect(publicInformationLastModified).not.toHaveProperty("/home-health");
    expect(publicInformationLastModified).not.toHaveProperty("/hospice");
    expect(publicInformationLastModified).not.toHaveProperty("/florida");
    expect(publicInformationLastModifiedTag("/sources")).toBe("<lastmod>2026-08-26</lastmod>");
    expect(publicInformationLastModifiedTag("/home-health")).toBe("");
    expect(publicInformationLastModifiedTag("/hospice")).toBe("");
    expect(publicInformationLastModifiedTag("/florida")).toBe("");
  });

  it("emits the dates in core.xml while retaining affected routes and undated cohorts", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CARE_ENABLE_PUBLIC_LAUNCH", "true");
    const { GET } = await import("../app/sitemaps/[file]/route");
    const response = await GET(new Request("https://www.seniortrusthub.com/sitemaps/core.xml"), {
      params: Promise.resolve({ file: "core.xml" }),
    });
    const xml = await response.text();

    expect(response.status).toBe(200);
    for (const [pathname, date] of Object.entries(publicInformationLastModified)) {
      expect(xml).toContain(
        `<loc>https://www.seniortrusthub.com${pathname}</loc><lastmod>${date}</lastmod>`,
      );
    }
    for (const pathname of ["/home-health", "/hospice", "/florida"]) {
      expect(xml).toContain(`<loc>https://www.seniortrusthub.com${pathname}</loc></url>`);
    }
  });
});
