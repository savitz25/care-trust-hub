import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { IL_PUBLIC_FINGERPRINT, IL_PUBLIC_SNAPSHOT } from "@care/domain";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Illinois /illinois publication", () => {
  it("uses launch-gated index,follow and the /illinois canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/illinois"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).toMatch(/BreadcrumbList/);
    expect(source).toMatch(/Dataset/);
    expect(source).toMatch(/Illinois Senior Care Research/);
    expect(source).toMatch(/Illinois nursing home research/);
    expect(source).toMatch(/Illinois assisted living license lookup/);
    expect(source).toMatch(/Illinois supportive living program/);
    expect(source).toMatch(/CMS Illinois nursing homes/);
  });

  it("lists /illinois exactly once in core.xml and never lists Chicago or Cook routes", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/illinois"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/\/illinois\/[a-z-]+/);
    expect(block).not.toMatch(/chicago|cook-county/);
  });

  it("keeps the IL-SEN-001 public snapshot fingerprint deterministic", () => {
    expect(IL_PUBLIC_SNAPSHOT.version).toBe("senior-il-state-intel-v1");
    expect(IL_PUBLIC_SNAPSHOT.fingerprint).toBe(IL_PUBLIC_FINGERPRINT);
    expect(IL_PUBLIC_SNAPSHOT.publicationPath).toBe("/illinois");
  });
});
