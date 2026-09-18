import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OH_PUBLIC_FINGERPRINT, OH_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Ohio /ohio publication", () => {
  it("uses launch-gated index,follow and the /ohio canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/ohio"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Ohio Senior Care & Long-Term Care Intelligence/);
    expect(source).toMatch(/Ohio nursing home research/);
    expect(source).toMatch(/Ohio Residential Care Facility research/);
  });

  it("lists /ohio exactly once in core.xml and never lists city routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/ohio"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/ohio\/[a-z-]+/);
    expect(block).not.toMatch(/cleveland|columbus|cincinnati/);
  });

  it("keeps the OH-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(OH_PUBLIC_SNAPSHOT.version).toBe("senior-oh-state-intel-v1");
    expect(OH_PUBLIC_SNAPSHOT.fingerprint).toBe(OH_PUBLIC_FINGERPRINT);
    expect(OH_PUBLIC_SNAPSHOT.publicationPath).toBe("/ohio");
  });
});
