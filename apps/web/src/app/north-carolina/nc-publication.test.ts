import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { NC_PUBLIC_FINGERPRINT, NC_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("North Carolina /north-carolina publication", () => {
  it("uses launch-gated index,follow and the /north-carolina canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/north-carolina"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/North Carolina Senior Care & Long-Term Care Intelligence/);
    expect(source).toMatch(/North Carolina adult care home research/);
    expect(source).toMatch(/North Carolina family care home research/);
    expect(source).toMatch(/CMS North Carolina nursing homes/);
    expect(source).toMatch(/NC DHSR Star Rating/);
  });

  it("lists /north-carolina exactly once in core.xml and never lists Charlotte or Raleigh routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/north-carolina"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/north-carolina\/[a-z-]+/);
    expect(block).not.toMatch(/charlotte|raleigh|mecklenburg|wake/);
  });

  it("keeps the NC-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(NC_PUBLIC_SNAPSHOT.version).toBe("senior-nc-state-intel-v1");
    expect(NC_PUBLIC_SNAPSHOT.fingerprint).toBe(NC_PUBLIC_FINGERPRINT);
    expect(NC_PUBLIC_SNAPSHOT.publicationPath).toBe("/north-carolina");
  });
});
