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
});
