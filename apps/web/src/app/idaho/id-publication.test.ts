import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/idaho-public-snapshot.json";
import { interpretIdahoAsk } from "@/server/care/id-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath, PUBLISHED_STATEWIDE_SLUGS } from "@/lib/published-state-path";
import { PUBLISHED_STATES } from "@/lib/published-states";

const BANNED = /\b(107|108)\b/;

describe("Idaho senior publication", () => {
  it("keeps every class unacquired and off one census", () => {
    expect(snapshot.ticket).toBe("ID-SEN-001");
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.classesAdded).toBe(false);
    expect(snapshot.classes.map((row) => row.roster)).toEqual([
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
      "NOT_ACQUIRED",
    ]);
    expect(snapshot.listBrowserOpened).toBe(false);
    expect(snapshot.listBrowserIsCsvExport).toBe(false);
    expect(snapshot.pageChromeIsRosterClock).toBe(false);
    expect(snapshot.cmsCertificationDownloaded).toBe(false);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.complaintInvestigationIsViolation).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.netNewEntities).toBe(0);
    expect(snapshot.cityRoutesPublished).toBe(false);
    expect(JSON.stringify(snapshot)).not.toMatch(BANNED);
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/idaho/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/idaho")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("not a roster clock");
    expect(page).toContain("A browser is not a roster");
    expect(page).toContain("not a violation");
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(BANNED);
    expect(page).not.toMatch(/\/idaho\/boise/);
    expect(sitemap.match(/"\/idaho"/g)).toHaveLength(1);
    expect(fs.readdirSync("src/app/idaho").sort()).toEqual(["id-publication.test.ts", "page.tsx"]);
    expect(fs.existsSync("src/app/idaho/boise")).toBe(false);
    expect(normalizedPublishedStatePath("/Idaho")).toBe("/idaho");
    expect(normalizedPublishedStatePath("/IDAHO")).toBe("/idaho");
    expect(normalizedPublishedStatePath("/idaho")).toBeNull();
    expect(normalizedPublishedStatePath("/idaho/boise")).toBeNull();
    expect(PUBLISHED_STATEWIDE_SLUGS).toContain("idaho");
    expect(PUBLISHED_STATES.some((state) => state.slug === "idaho" && state.code === "ID")).toBe(true);
  });

  it("fails closed without a senior census", () => {
    const nursing = interpretSeniorAskQuery("nursing homes in Idaho");
    expect(nursing.failReason).toMatch(/NOT_ACQUIRED/);
    expect(nursing.failReason).not.toMatch(BANNED);
    const postal = interpretSeniorAskQuery("nursing homes in id");
    expect(postal.failReason).toMatch(/NOT_ACQUIRED/);
    const total = interpretSeniorAskQuery("how many senior facilities in Idaho");
    expect(total.failReason).toMatch(/cannot be combined/);
    expect(interpretSeniorAskQuery("best nursing home in Idaho").failReason).toMatch(/does not rank/);
    expect(interpretSeniorAskQuery("assisted living in Boise Idaho").failReason).toMatch(/geography only/);
    expect(interpretSeniorAskQuery("certified family homes in Idaho").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretIdahoAsk("nursing homes id")).toBeNull();
    expect(interpretIdahoAsk("nursing homes ID")).toBeNull();
    const nm = interpretSeniorAskQuery("nursing homes in New Mexico");
    expect(nm.failReason).toMatch(/New Mexico/);
    expect(nm.failReason).not.toMatch(/Department of Health and Welfare/);
  });
});
