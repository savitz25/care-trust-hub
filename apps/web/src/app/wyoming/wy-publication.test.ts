import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import snapshot from "../../../../../data/wyoming/wy-sen-001/summary.json";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("WY-SEN-001 Wyoming facility directory publication", () => {
  it("preserves the current directory clock, source hash, and class-level row grains", () => {
    expect(snapshot.source_updated).toBe("2026-10-12");
    expect(snapshot.retrieved).toBe("2026-10-14");
    expect(snapshot.raw_entity_rows).toBe(275);
    expect(snapshot.sha256).toHaveLength(64);
    expect(snapshot.classes.find((item) => item.source_type === "NH")?.observations).toBe(36);
    expect(snapshot.classes.find((item) => item.source_type === "HOSP")?.observations).toBe(8);
    expect(snapshot.classes.find((item) => item.source_type === "HSPC")?.observations).toBe(21);
  });

  it("publishes one indexable statewide route with class and status boundaries", () => {
    expect(page).toContain('canonicalUrl("/wyoming")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("current license-status field");
    expect(page).toContain("not a combined denominator");
    expect([...sitemap.matchAll(/"\/wyoming"/g)]).toHaveLength(1);
    expect(normalizedPublishedStatePath("/Wyoming")).toBe("/wyoming");
    expect(normalizedPublishedStatePath("/wyoming/casper")).toBeNull();
    expect(page).not.toMatch(/aggregateRating|ratingValue|reviewCount|Trust Score/);
  });
});
