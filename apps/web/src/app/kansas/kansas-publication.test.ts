import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import snapshot from "../../../../../data/kansas-public-snapshot.json";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";
import { PUBLISHED_STATES } from "@/lib/published-states";

const page = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const sitemap = readFileSync(new URL("../sitemaps/[file]/route.ts", import.meta.url), "utf8");

describe("KS-SEN-001 Kansas facility publication", () => {
  it("preserves facility IDs, distinct class rows, and source clocks", () => {
    const adult = snapshot.sourceSets.adultCare;
    const health = snapshot.sourceSets.healthFacilities;
    expect(adult.rawRowCount).toBe(783);
    expect(adult.distinctFacilityStateIds).toBe(783);
    expect(adult.typeObservations["Nursing Facility"]).toEqual({
      rows: 271,
      distinctStateIds: 271,
    });
    expect(adult.typeObservations["Assisted Living Facility"]).toEqual({
      rows: 233,
      distinctStateIds: 233,
    });
    expect(adult.typeObservations["Residential Health Care Facility"]).toEqual({
      rows: 118,
      distinctStateIds: 118,
    });
    expect(adult.lastSurveyPostingDateRows).toBe(732);
    expect(adult.rowsWithoutSurveyPostingDate).toBe(51);
    expect(adult.latestPrintedSurveyPostingDate).toBe("12/31/2025");
    expect(health.rawRowCount).toBe(962);
    expect(health.distinctFacilityStateIds).toBe(959);
    expect(health.typeObservations.Hospice).toEqual({ rows: 94, distinctStateIds: 93 });
    expect(health.typeObservations["Home Health Agency STATE ONLY"]).toEqual({
      rows: 254,
      distinctStateIds: 254,
    });
    expect(adult.rawSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(health.rawSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("publishes canonical indexed state route and no local pages or rating claims", () => {
    expect(page).toMatch(/canonicalUrl\("\/kansas"\)/);
    expect(page).toMatch(/robots: publicRobots\(true\)/);
    expect(page).toMatch(/facility search corpus was added/);
    expect(page).toMatch(/bed or capacity value/);
    expect(page).toMatch(/CMS certification is a separate federal status/);
    expect(page).not.toMatch(/aggregateRating|ratingValue|Trust Score/);
    expect(sitemap).toContain('"/kansas"');
    expect(normalizedPublishedStatePath("/KANSAS")).toBe("/kansas");
    expect(normalizedPublishedStatePath("/kansas")).toBeNull();
    expect(normalizedPublishedStatePath("/kansas/wichita")).toBeNull();
    expect(PUBLISHED_STATES.some((state) => state.slug === "kansas" && state.code === "KS")).toBe(
      true,
    );
  });
});
