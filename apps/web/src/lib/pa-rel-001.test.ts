import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizedPublishedStatePath } from "./published-state-path";

const webRoot = join(process.cwd());
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf8");

describe("PA-REL-001 Pennsylvania discovery and case normalization", () => {
  it("normalizes mixed-case statewide PA paths", () => {
    expect(normalizedPublishedStatePath("/Pennsylvania")).toBe("/pennsylvania");
    expect(normalizedPublishedStatePath("/PENNSYLVANIA")).toBe("/pennsylvania");
    expect(normalizedPublishedStatePath("/PeNnSyLvAnIa")).toBe("/pennsylvania");
    expect(normalizedPublishedStatePath("/Ohio")).toBe("/ohio");
    expect(normalizedPublishedStatePath("/OHIO")).toBe("/ohio");
    expect(normalizedPublishedStatePath("/oHiO")).toBe("/ohio");
    expect(normalizedPublishedStatePath("/Georgia")).toBe("/georgia");
    expect(normalizedPublishedStatePath("/GEORGIA")).toBe("/georgia");
    expect(normalizedPublishedStatePath("/georgia")).toBeNull();
    expect(normalizedPublishedStatePath("/georgia/atlanta")).toBeNull();
    expect(normalizedPublishedStatePath("/Massachusetts")).toBe("/massachusetts");
    expect(normalizedPublishedStatePath("/MASSACHUSETTS")).toBe("/massachusetts");
    expect(normalizedPublishedStatePath("/massachusetts")).toBeNull();
    expect(normalizedPublishedStatePath("/massachusetts/boston")).toBeNull();
    expect(normalizedPublishedStatePath("/Tennessee")).toBe("/tennessee");
    expect(normalizedPublishedStatePath("/TENNESSEE")).toBe("/tennessee");
    expect(normalizedPublishedStatePath("/tennessee")).toBeNull();
    expect(normalizedPublishedStatePath("/tennessee/nashville")).toBeNull();
    expect(normalizedPublishedStatePath("/Nevada")).toBe("/nevada");
    expect(normalizedPublishedStatePath("/NEVADA")).toBe("/nevada");
    expect(normalizedPublishedStatePath("/nevada")).toBeNull();
    expect(normalizedPublishedStatePath("/nevada/las-vegas")).toBeNull();
    expect(normalizedPublishedStatePath("/ohio")).toBeNull();
    expect(normalizedPublishedStatePath("/ohio/cleveland")).toBeNull();
    expect(normalizedPublishedStatePath("/pennsylvania")).toBeNull();
    expect(normalizedPublishedStatePath("/Pennsylvania/philadelphia")).toBeNull();
  });

  it("proxy permanently redirects mixed-case published state paths", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toMatch(/normalizedPublishedStatePath/);
    expect(proxy).toMatch(/308/);
  });

  it("header and footer publish lowercase /pennsylvania", () => {
    const nav = read("src/components/published-state-navigation.tsx");
    expect(nav).toMatch(/href: "\/pennsylvania"/);
    expect(nav).not.toMatch(/href: "\/Pennsylvania"/);
    const footer = readFileSync(join(webRoot, "../../packages/ui/src/index.tsx"), "utf8");
    expect(footer).toMatch(/href="\/pennsylvania"/);
    expect(footer).not.toMatch(/href="\/Pennsylvania"/);
  });

  it("core sitemap lists /pennsylvania exactly once and no local PA routes", () => {
    const sitemap = read("src/app/sitemaps/[file]/route.ts");
    expect([...sitemap.matchAll(/"\/pennsylvania"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/Pennsylvania"/);
    expect(sitemap).not.toMatch(/"\/pennsylvania\/[a-z-]+"/);
  });

  it("header, footer, and sitemap publish lowercase /ohio with no city routes", () => {
    const nav = read("src/components/published-state-navigation.tsx");
    expect(nav).toMatch(/href: "\/ohio"/);
    expect(nav).not.toMatch(/href: "\/Ohio"/);
    const footer = readFileSync(join(webRoot, "../../packages/ui/src/index.tsx"), "utf8");
    expect(footer).toMatch(/href="\/ohio"/);
    expect(footer).toMatch(/href="\/georgia"/);
    expect(footer).toMatch(/href="\/massachusetts"/);
    expect(footer).toMatch(/href="\/tennessee"/);
    expect(footer).toMatch(/href="\/nevada"/);
    expect(footer).not.toMatch(/href="\/Ohio"/);
    const sitemap = read("src/app/sitemaps/[file]/route.ts");
    expect([...sitemap.matchAll(/"\/ohio"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/Ohio"/);
    expect(sitemap).not.toMatch(/"\/ohio\/[a-z-]+"/);
    expect(nav).toMatch(/href: "\/georgia"/);
    expect([...sitemap.matchAll(/"\/georgia"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/georgia\/[a-z-]+"/);
    expect(nav).toMatch(/href: "\/massachusetts"/);
    expect([...sitemap.matchAll(/"\/massachusetts"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/massachusetts\/[a-z-]+"/);
    expect(nav).toMatch(/href: "\/tennessee"/);
    expect([...sitemap.matchAll(/"\/tennessee"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/tennessee\/[a-z-]+"/);
    expect(nav).toMatch(/href: "\/nevada"/);
    expect([...sitemap.matchAll(/"\/nevada"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/nevada\/[a-z-]+"/);
  });

  it("mixed-case redirect clones the request URL so query strings are preserved", () => {
    const proxy = read("src/proxy.ts");
    expect(proxy).toMatch(/request\.nextUrl\.clone\(\)/);
    expect(proxy).toMatch(/url\.pathname = statePath/);
    expect(proxy).toMatch(/NextResponse\.redirect\(url, 308\)/);
  });
});
