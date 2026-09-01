import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("Florida page publication", () => {
  it("uses launch-gated index,follow and the /florida canonical", () => {
    expect(source).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(source).toMatch(/canonicalUrl\("\/florida"\)/);
    expect(source).not.toMatch(/robots:\s*\{\s*index:\s*false/);
    expect(source).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(source).not.toMatch(/\/florida\/intelligence/);
  });

  it("lists /florida exactly once in core.xml and never lists counties or unpublished providers", () => {
    const start = sitemap.indexOf("const corePaths");
    const end = sitemap.indexOf("];", start) + 2;
    const block = sitemap.slice(start, end);
    expect([...block.matchAll(/"\/florida"/g)]).toHaveLength(1);
    expect(block).not.toMatch(/miami-dade|broward|palm-beach|pinellas/i);
    expect(block).not.toMatch(/state_licensed_provider|\/florida\/provider/);
  });
});

describe("Florida Phase 1 public provider route", () => {
  it("fail-closes unpublished kinds and never emits rating structured data", () => {
    const page = readFileSync(join(here, "[kind]/[fileNumber]/[slug]/page.tsx"), "utf8");
    expect(page).toMatch(/loadPublishedFloridaProfile/);
    expect(page).toMatch(/notFound\(\)/);
    expect(page).toMatch(/publicRobots\(indexable\)/);
    expect(page).not.toMatch(/aggregateRating|ratingValue|reviewCount/);
    expect(page).not.toMatch(
      /CARE_ENABLE_FLORIDA_PROVIDER_INDEX === "true" &&[\s\S]*publicRobots\(true\)/,
    );
  });
});

describe("Florida intelligence snapshot stability", () => {
  it("keeps the FL-SEN-005B fingerprint and does not invent county pages", () => {
    const intel = JSON.parse(
      readFileSync(join(here, "../../data/florida-intelligence.json"), "utf8"),
    ) as { sourceFingerprint: string };
    expect(intel.sourceFingerprint).toBe(
      "1aff3a096a2ae790bfba2d9b6a4686f25051ee0577b74275106669ec96a6d2bb",
    );
  });
});
