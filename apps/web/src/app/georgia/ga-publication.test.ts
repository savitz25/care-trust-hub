import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GA_PUBLIC_FINGERPRINT, GA_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Georgia /georgia publication", () => {
  it("uses launch-gated index,follow and the /georgia canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/georgia"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Georgia Senior Care Research/);
    expect(source).toMatch(/Personal Care Home is not an Assisted Living Community/);
    expect(source).not.toMatch(/all Georgia senior/);
  });

  it("lists /georgia exactly once in core.xml and never lists city routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/georgia"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/georgia\/[a-z-]+/);
    expect(block).not.toMatch(/atlanta/);
  });

  it("keeps the GA-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(GA_PUBLIC_SNAPSHOT.version).toBe("senior-ga-state-intel-v1");
    expect(GA_PUBLIC_SNAPSHOT.fingerprint).toBe(GA_PUBLIC_FINGERPRINT);
    expect(GA_PUBLIC_SNAPSHOT.publicationPath).toBe("/georgia");
    expect(GA_PUBLIC_SNAPSHOT.cmsOverlay.nursingHomes).toBe(356);
    expect(GA_PUBLIC_SNAPSHOT.personalCareHomes.rows).toBeNull();
  });
});
