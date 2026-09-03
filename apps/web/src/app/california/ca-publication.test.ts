import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CA_PUBLIC_FINGERPRINT, CA_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("California page publication", () => {
  it("uses launch-gated index,follow and the /california canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/california"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
  });

  it("lists /california exactly once in core.xml and never lists California counties", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/california"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/california\/[a-z-]+-county/);
    expect(block).not.toMatch(/los-angeles-county|orange-county/);
  });

  it("keeps the CA-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(CA_PUBLIC_SNAPSHOT.version).toBe("senior-ca-state-intel-v1");
    expect(CA_PUBLIC_SNAPSHOT.fingerprint).toBe(CA_PUBLIC_FINGERPRINT);
  });
});
