import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Florida page publication", () => {
  it("uses launch-gated index,follow and the /florida canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/florida"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).not.toMatch(/\/florida\/intelligence/);
  });

  it("lists /florida exactly once in core.xml and never lists counties or unpublished providers", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/florida"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/miami-dade|broward|palm-beach|pinellas/i);
    expect(block).not.toMatch(/state_licensed_provider|\/florida\/provider/);
  });
});
