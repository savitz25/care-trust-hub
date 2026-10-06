import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "../../../../../data/nebraska/ne-sen-001/dhhs-roster-snapshot.json";
import { interpretNebraskaAsk } from "@/server/care/ne-ask";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Nebraska senior publication", () => {
  it("keeps DHHS classes off one another", () => {
    const facilities = snapshot.nursing.classes.reduce((sum, row) => sum + row.facilities, 0);
    const beds = snapshot.nursing.classes.reduce((sum, row) => sum + row.beds, 0);
    expect(facilities).toBe(snapshot.nursing.printedTotalFacilities);
    expect(beds).toBe(snapshot.nursing.printedTotalBeds);
    expect(snapshot.nursing.printedTotalFacilities).toBe(188);
    expect(snapshot.assistedLiving.totalLicensedFacilities).toBe(277);
    expect(snapshot.assistedLiving.totalLicensedBeds).toBe(13957);
    expect(snapshot.adultDay.totalLicensed).toBe(20);
    expect(snapshot.nursing.addedToAssistedLiving).toBe(false);
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.homeHealth).toBe("NOT_ACQUIRED");
    expect(snapshot.hospice).toBe("NOT_ACQUIRED");
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.facilityNamesPublished).toBe(false);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/nebraska/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/nebraska")');
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("totalLicensedFacilities");
    expect(page).toContain("printedTotalFacilities");
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(/\/nebraska\/(?:omaha|lincoln)/);
    expect(sitemap.match(/"\/nebraska"/g)).toHaveLength(1);
    expect(sitemap).toContain('"/utah"');
    expect(sitemap).toContain('"/arkansas"');
    expect(fs.existsSync("src/app/iowa/page.tsx")).toBe(true);
    expect(fs.readdirSync("src/app/nebraska").sort()).toEqual(["ne-publication.test.ts", "page.tsx"]);
    expect(normalizedPublishedStatePath("/Nebraska")).toBe("/nebraska");
    expect(normalizedPublishedStatePath("/nebraska")).toBeNull();
    expect(normalizedPublishedStatePath("/nebraska/omaha")).toBeNull();
  });

  it("does not invent one senior census", () => {
    const assisted = interpretNebraskaAsk("assisted living in Nebraska");
    expect(assisted?.message).toContain("277");
    expect(assisted?.message).toContain("13,957");
    expect(interpretNebraskaAsk("nursing homes in Nebraska")?.message).toContain("188");
    expect(interpretNebraskaAsk("nursing homes in Nebraska")?.message).toContain("not added");
    expect(interpretNebraskaAsk("adult day in ne")?.message).toContain("20");
    expect(interpretNebraskaAsk("how many senior facilities in Nebraska")?.message).toContain(
      "cannot be combined",
    );
    expect(interpretNebraskaAsk("home health in Nebraska")?.message).toMatch(/NOT_ACQUIRED/);
    expect(interpretNebraskaAsk("hospice in Nebraska")?.message).toMatch(/NOT_ACQUIRED/);
    expect(interpretNebraskaAsk("best nursing home in Nebraska")?.message).toMatch(/does not rank/);
    expect(interpretNebraskaAsk("nursing home Omaha Nebraska")?.message).toMatch(/geography only/);
    expect(interpretNebraskaAsk("nursing home Omaha")).toBeNull();
    expect(interpretNebraskaAsk("assisted living in Nevada")).toBeNull();
    expect(interpretNebraskaAsk("nursing homes in Iowa")).toBeNull();
    expect(fs.readFileSync("src/server/care/senior-ask-parse.ts", "utf8")).toContain(
      "interpretNebraskaAsk",
    );
  });
});
