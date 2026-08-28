import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sitemap = readFileSync(join(here, "../[file]/route.ts"), "utf8");
const robots = readFileSync(join(here, "../../robots.ts"), "utf8");
const webRoot = join(here, "../..");

describe("FL-SEN-006 unpublished Florida provider profiles", () => {
  it("FLPROF46–47: /florida remains once in core.xml", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/florida"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/assisted-living|adult-family-care|nursing-home|internal/);
  });

  it("keeps core.xml free of provider URLs and internal QA noindex", () => {
    expect(robots).toMatch(/"\/florida\/internal"/);
    const internalPage = readFileSync(join(webRoot, "florida/internal/page.tsx"), "utf8");
    expect(internalPage).toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(internalPage).toMatch(/notFound\(\)/);
    expect(sitemap).toMatch(/florida-providers\.xml/);
    expect(existsSync(join(webRoot, "florida/[kind]/[fileNumber]/[slug]/page.tsx"))).toBe(true);
  });
});
