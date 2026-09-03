import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function source(rel: string): string {
  return readFileSync(join(root, rel), "utf8");
}

describe("class landing publication", () => {
  it("uses launch-gated index,follow and class canonicals", () => {
    for (const file of ["home-health/page.tsx", "hospice/page.tsx"] as const) {
      const text = source(file);
      expect(text).toMatch(/robots:\s*publicRobots\(true\)/);
      expect(text).toMatch(/canonicalUrl\("\/(?:home-health|hospice)"\)/);
      expect(text).toMatch(/getSeniorNetworkMetrics/);
      expect(text).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    }
  });

  it("lists each class landing once in core.xml and never lists /search", () => {
    const text = source("sitemaps/[file]/route.ts");
    const start = text.indexOf("const corePaths");
    const end = text.indexOf("];", start) + 2;
    const block = text.slice(start, end);
    expect([...block.matchAll(/"\/home-health"/g)]).toHaveLength(1);
    expect([...block.matchAll(/"\/hospice"/g)]).toHaveLength(1);
    expect([...block.matchAll(/"\/florida"/g)]).toHaveLength(1);
    expect([...block.matchAll(/"\/new-jersey"/g)]).toHaveLength(1);
    expect([...block.matchAll(/"\/california"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/search/);
  });
});
