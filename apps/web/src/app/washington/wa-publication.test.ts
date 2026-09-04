import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { WA_PUBLIC_FINGERPRINT, WA_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Washington page publication", () => {
  it("uses launch-gated index,follow and the /washington canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/washington"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Washington Senior Care Research/);
  });

  it("lists /washington exactly once in core.xml and never lists Washington counties", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/washington"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/washington\/[a-z-]+/);
    expect(block).not.toMatch(/seattle|king-county|tacoma|pierce|spokane|snohomish|bellevue/);
  });

  it("keeps the WA-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(WA_PUBLIC_SNAPSHOT.version).toBe("senior-wa-state-intel-v1");
    expect(WA_PUBLIC_SNAPSHOT.fingerprint).toBe(WA_PUBLIC_FINGERPRINT);
  });
});
