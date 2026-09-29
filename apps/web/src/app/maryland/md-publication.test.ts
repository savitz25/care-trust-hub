import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/maryland-public-snapshot.json";
import { interpretMarylandAsk, marylandIntent } from "@/server/care/md-ask";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Maryland senior publication", () => {
  it("keeps official directory classes and license grains separate", () => {
    expect(
      snapshot.sources.map((source) => [source.class, source.rows, source.distinctLicenses]),
    ).toEqual([
      ["Assisted Living Programs", 1673, 1672],
      ["Long Term Care Facilities", 221, 220],
      ["Home Health Agencies", 53, 53],
      ["Hospices", 28, 27],
      ["Adult Medical Day Care Centers", 128, 128],
    ]);
    for (const source of snapshot.sources) {
      const rows = snapshot.rows.filter((row) => row.class === source.class);
      expect(rows).toHaveLength(source.rows);
      expect(new Set(rows.map((row) => row.license).filter(Boolean)).size).toBe(
        source.distinctLicenses,
      );
      expect(source.url).toMatch(/^https:\/\/health\.maryland\.gov\/ohcq\/docs\//);
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(snapshot.cmsExactBridges).toBe(0);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.enforcementExactAttachments).toBe(0);
    expect(snapshot.inspectionAttachments).toBe(0);
    expect(snapshot.rows.every((row) => !("email" in row || "contact" in row))).toBe(true);
  });

  it("publishes only the canonical state route with source-specific limitations", () => {
    const page = fs.readFileSync("src/app/maryland/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/maryland")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    expect([...sitemap.matchAll(/"\/maryland"/g)]).toHaveLength(1);
    expect(normalizedPublishedStatePath("/Maryland")).toBe("/maryland");
    expect(normalizedPublishedStatePath("/maryland/baltimore")).toBeNull();
  });

  it("routes state and city context, preserves CCN and bare-number paths, refuses winners", () => {
    for (const q of [
      "nursing home Maryland",
      "assisted living Maryland",
      "hospice Maryland",
      "home health Maryland",
      "Maryland nursing home inspection",
      "Maryland senior enforcement",
      "Maryland senior complaints",
      "nursing home Baltimore",
      "nursing home Annapolis",
      "nursing home Frederick",
      "nursing home Rockville",
    ])
      expect(marylandIntent(q), q).toBe(true);
    expect(interpretMarylandAsk("CCN 215123 Maryland")).toBeNull();
    expect(interpretMarylandAsk("215123")).toBeNull();
    expect(interpretMarylandAsk("nursing home in Hollywood Maryland")).toBeNull();
    expect(interpretMarylandAsk("best nursing home Maryland")?.coverage).toBe("UNSUPPORTED");
    expect(interpretMarylandAsk("Maryland senior complaints")?.message).toContain("NOT_ACQUIRED");
  });
});
