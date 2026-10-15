import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";
import { PUBLISHED_STATE_COUNT, PUBLISHED_STATES } from "@/lib/published-states";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("SD-SEN-001 South Dakota facility-class publication", () => {
  it("keeps missing rosters unknown and does not publish a combined census", () => {
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("not a count of zero");
    expect(page).toContain("living centers are registered annually");
    expect(page).toContain("CMS certification is a separate federal population");
    expect(page).toContain("not a license roster");
    expect(page).not.toMatch(/\b\d{2,}\s+(nursing|assisted|facilities|beds)\b/i);
    expect(page).not.toMatch(/aggregateRating|ratingValue|reviewCount|Trust Score/);
  });

  it("publishes one indexable statewide route", () => {
    expect(page).toContain('canonicalUrl("/south-dakota")');
    expect(page).toContain("publicRobots(true)");
    expect([...sitemap.matchAll(/"\/south-dakota"/g)]).toHaveLength(1);
    expect(normalizedPublishedStatePath("/South-Dakota")).toBe("/south-dakota");
    expect(normalizedPublishedStatePath("/south-dakota/sioux-falls")).toBeNull();
    expect(PUBLISHED_STATES.some((state) => state.slug === "south-dakota" && state.code === "SD")).toBe(
      true,
    );
    expect(PUBLISHED_STATE_COUNT).toBe(PUBLISHED_STATES.length);
  });
});
