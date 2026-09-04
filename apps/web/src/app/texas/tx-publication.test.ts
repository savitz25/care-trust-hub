import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TX_PUBLIC_FINGERPRINT, TX_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Texas page publication", () => {
  it("uses launch-gated index,follow and the /texas canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/texas"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Texas Senior Care Research/);
  });

  it("lists /texas exactly once in core.xml and never lists Texas counties", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/texas"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/texas\/[a-z-]+/);
    expect(block).not.toMatch(/harris|dallas|travis-county|houston/);
  });

  it("keeps the TX-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(TX_PUBLIC_SNAPSHOT.version).toBe("senior-tx-state-intel-v1");
    expect(TX_PUBLIC_SNAPSHOT.fingerprint).toBe(TX_PUBLIC_FINGERPRINT);
  });
});
