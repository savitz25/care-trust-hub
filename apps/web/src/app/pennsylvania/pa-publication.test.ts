import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PA_PUBLIC_FINGERPRINT, PA_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Pennsylvania /pennsylvania publication", () => {
  it("uses launch-gated index,follow and the /pennsylvania canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/pennsylvania"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Pennsylvania Senior Care & Long-Term Care Intelligence/);
    expect(source).toMatch(/Pennsylvania nursing home research/);
    expect(source).toMatch(/Pennsylvania personal care home research/);
    expect(source).toMatch(/CMS Pennsylvania nursing homes/);
  });

  it("lists /pennsylvania exactly once in core.xml and never lists Philadelphia or Pittsburgh routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/pennsylvania"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/pennsylvania\/[a-z-]+/);
    expect(block).not.toMatch(/philadelphia|pittsburgh|allegheny/);
  });

  it("keeps the PA-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(PA_PUBLIC_SNAPSHOT.version).toBe("senior-pa-state-intel-v1");
    expect(PA_PUBLIC_SNAPSHOT.fingerprint).toBe(PA_PUBLIC_FINGERPRINT);
    expect(PA_PUBLIC_SNAPSHOT.publicationPath).toBe("/pennsylvania");
  });
});
