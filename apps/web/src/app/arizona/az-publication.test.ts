import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AZ_PUBLIC_FINGERPRINT, AZ_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Arizona page publication", () => {
  it("uses launch-gated index,follow and the /arizona canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/arizona"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Arizona Senior Care Research/);
  });

  it("lists /arizona exactly once in core.xml and never lists Arizona cities or counties", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/arizona"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/arizona\/[a-z-]+/);
    expect(block).not.toMatch(/phoenix|maricopa|tucson|pima|mesa|scottsdale|tempe|chandler/);
  });

  it("keeps the AZ-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(AZ_PUBLIC_SNAPSHOT.version).toBe("senior-az-state-intel-v1");
    expect(AZ_PUBLIC_SNAPSHOT.fingerprint).toBe(AZ_PUBLIC_FINGERPRINT);
  });
});
