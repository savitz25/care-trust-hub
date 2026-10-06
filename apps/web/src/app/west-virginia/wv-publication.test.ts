import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/west-virginia-public-snapshot.json";
import { interpretWestVirginiaAsk } from "@/server/care/wv-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import {
  normalizedPublishedStatePath,
  PUBLISHED_STATEWIDE_SLUGS,
} from "@/lib/published-state-path";
import { PUBLISHED_STATES } from "@/lib/published-states";

describe("West Virginia senior publication", () => {
  it("keeps every class unacquired and off one census", () => {
    expect(snapshot.ticket).toBe("WV-SEN-001");
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.classesAdded).toBe(false);
    expect(snapshot.classes).toHaveLength(8);
    expect(snapshot.classes.map((row) => row.roster)).toEqual([
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
    ]);
    expect(snapshot.classRostersDownloaded).toBe(false);
    expect(snapshot.lookupHtmlBytes).toBe(50821);
    expect(snapshot.lookupHtmlSha256).toBe(
      "88008b70c1802a8c537331dbb24959e99b3fcd3b846270723b3be73f32b0330f",
    );
    expect(snapshot.cmsCertificationDownloaded).toBe(false);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.administratorIsFacility).toBe(false);
    expect(snapshot.surveyIsEnforcement).toBe(false);
    expect(snapshot.complaintInvestigationIsViolation).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.netNewEntities).toBe(0);
    expect(snapshot.cityRoutesPublished).toBe(false);
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/west-virginia/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/west-virginia")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("A search form is not a roster");
    expect(page).toContain("The rows are not added");
    expect(page).toContain("An administrator is not a facility");
    expect(page).toMatch(/A survey\s+is not enforcement/);
    expect(page).toContain("A complaint");
    expect(page).toMatch(/investigation is not a\s+violation/);
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(/\/west-virginia\/charleston/);
    expect(sitemap.match(/"\/west-virginia"/g)).toHaveLength(1);
    expect(sitemap).toContain('"/idaho"');
    expect(sitemap).toContain('"/kansas"');
    expect(sitemap).toContain('"/nebraska"');
    expect(fs.readdirSync("src/app/west-virginia").sort()).toEqual([
      "page.tsx",
      "wv-publication.test.ts",
    ]);
    expect(fs.existsSync("src/app/west-virginia/charleston")).toBe(false);
    expect(normalizedPublishedStatePath("/West-Virginia")).toBe("/west-virginia");
    expect(normalizedPublishedStatePath("/west-virginia")).toBeNull();
    expect(normalizedPublishedStatePath("/west-virginia/charleston")).toBeNull();
    expect(PUBLISHED_STATEWIDE_SLUGS).toContain("west-virginia");
    expect(PUBLISHED_STATEWIDE_SLUGS).toContain("idaho");
    expect(PUBLISHED_STATEWIDE_SLUGS).toContain("kansas");
    expect(
      PUBLISHED_STATES.some((state) => state.slug === "west-virginia" && state.code === "WV"),
    ).toBe(true);
  });

  it("fails closed without a senior census", () => {
    const nursing = interpretSeniorAskQuery("nursing homes in West Virginia");
    expect(nursing.failReason).toMatch(/NOT_ACQUIRED/);
    expect(nursing.failReason).not.toMatch(/Virginia assisted living/);
    const postal = interpretSeniorAskQuery("nursing homes in wv");
    expect(postal.failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretWestVirginiaAsk("nursing homes wv")).toBeNull();
    expect(interpretWestVirginiaAsk("nursing homes WV")).toBeNull();
    const virginia = interpretSeniorAskQuery("nursing homes in Virginia");
    expect(virginia.failReason ?? "").not.toMatch(/OHFLAC|West Virginia/);
    const total = interpretSeniorAskQuery("how many senior facilities in West Virginia");
    expect(total.failReason).toMatch(/cannot be combined/);
    expect(interpretSeniorAskQuery("best nursing home in West Virginia").failReason).toMatch(
      /does not rank/,
    );
    expect(
      interpretSeniorAskQuery("assisted living in Charleston, West Virginia").failReason,
    ).toMatch(/geography only/);
    expect(interpretSeniorAskQuery("assisted living in West Virginia").failReason).not.toMatch(
      /Virginia assisted living is a DSS/,
    );
  });
});
