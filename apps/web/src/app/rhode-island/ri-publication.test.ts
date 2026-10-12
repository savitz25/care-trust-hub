import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import snapshot from "@/data/rhode-island-senior-snapshot.json";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("RI-SEN-001 Rhode Island RIDOH publication", () => {
  it("preserves source classes, exact license grain, active status, clocks and source hashes", () => {
    expect(snapshot.sourceLastUpdated).toBe("12th October 2026");
    expect(snapshot.classes).toHaveLength(11);
    expect(snapshot.classes.every((item) => item.url === snapshot.classes[0]?.url)).toBe(true);
    expect(snapshot.classes.every((item) => item.sha256.length === 64)).toBe(true);
    expect(
      snapshot.classes.every((item) => item.activeRows === item.distinctActiveLicenseNumbers),
    ).toBe(true);
    expect(snapshot.rows.every((row) => row.Status === "Active" && row["License No"])).toBe(true);
    expect(
      snapshot.classes.find((item) => item.class === "Home Nursing Care Branch")
        ?.distinctActiveLicenseNumbers,
    ).toBe(10);
    expect(
      snapshot.classes.find((item) => item.class === "Hospice Provider Branch")
        ?.distinctActiveLicenseNumbers,
    ).toBe(3);
    expect(snapshot.rows[0]).not.toHaveProperty("Phone");
    expect(snapshot.rows[0]).not.toHaveProperty("Owner Manager Name");
  });

  it("publishes one canonical, indexable statewide page with class boundaries", () => {
    expect(page).toContain('canonicalUrl("/rhode-island")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("combined senior-facility census");
    expect(page).toContain("complaint outcomes");
    expect([...sitemap.matchAll(/"\/rhode-island"/g)]).toHaveLength(1);
    expect(normalizedPublishedStatePath("/Rhode-Island")).toBe("/rhode-island");
    expect(normalizedPublishedStatePath("/rhode-island/providence")).toBeNull();
    expect(page).not.toMatch(/aggregateRating|ratingValue|reviewCount|Trust Score/);
  });
});
