import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { OR_PUBLIC_FINGERPRINT, OR_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Oregon /oregon publication", () => {
  it("uses launch-gated index,follow and the /oregon canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/oregon"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Oregon Senior Care Research/);
    expect(source).toMatch(/Oregon nursing facility research/);
    expect(source).toMatch(/Oregon assisted living license lookup/);
    expect(source).toMatch(/CMS Oregon nursing homes/);
  });

  it("lists /oregon exactly once in core.xml and never lists Portland or Multnomah routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/oregon"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/oregon\/[a-z-]+/);
    expect(block).not.toMatch(/portland|multnomah/);
  });

  it("keeps the OR-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(OR_PUBLIC_SNAPSHOT.version).toBe("senior-or-state-intel-v1");
    expect(OR_PUBLIC_SNAPSHOT.fingerprint).toBe(OR_PUBLIC_FINGERPRINT);
    expect(OR_PUBLIC_SNAPSHOT.publicationPath).toBe("/oregon");
  });
});
