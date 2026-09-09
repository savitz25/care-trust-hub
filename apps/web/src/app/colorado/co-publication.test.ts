import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CO_PUBLIC_FINGERPRINT, CO_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Colorado page publication", () => {
  it("uses launch-gated index,follow and the /colorado canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/colorado"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Colorado Senior Care Research/);
    expect(source).toMatch(/Colorado nursing home research/);
    expect(source).toMatch(/Colorado assisted living license lookup/);
    expect(source).toMatch(/Colorado CDPHE facility lookup/);
    expect(source).toMatch(/CMS Colorado nursing homes/);
  });

  it("lists /colorado exactly once in core.xml and never lists Colorado cities or counties", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/colorado"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/colorado\/[a-z-]+/);
    expect(block).not.toMatch(/denver|el-paso|arapahoe|jefferson-county|boulder/);
  });

  it("keeps the CO-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(CO_PUBLIC_SNAPSHOT.version).toBe("senior-co-state-intel-v1");
    expect(CO_PUBLIC_SNAPSHOT.fingerprint).toBe(CO_PUBLIC_FINGERPRINT);
  });
});
