import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import snapshot from "@/data/connecticut-public-snapshot.json";
import orders from "@/data/connecticut-orders.json";
import { connecticutIntent, interpretConnecticutAsk } from "@/server/care/ct-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, "page.tsx"), "utf8");
const sitemap = readFileSync(join(here, "../sitemaps/[file]/route.ts"), "utf8");

describe("CT-SEN-001 Connecticut DPH publication", () => {
  it("freezes exact facility classes, statuses, source clocks and privacy", () => {
    expect(snapshot.rows).toHaveLength(500);
    expect(new Set(snapshot.rows.map((row) => row.license)).size).toBe(500);
    expect(snapshot.classCounts).toEqual({
      "Assisted Living Service Agency": 126,
      "Chronic & Convalescent Nursing Home": 189,
      "Home Health Care": 86,
      "Homemaker-Home Health Aide": 1,
      Hospice: 2,
      "Residential Care Facility": 96,
    });
    expect(snapshot.statusCounts).toEqual({ ACTIVE: 431, "ACTIVE IN RENEWAL": 69 });
    expect(snapshot.rows.every((row) => ["ACTIVE", "ACTIVE IN RENEWAL"].includes(row.status))).toBe(
      true,
    );
    expect(snapshot.rows.every((row) => row.license && row.credential && row.name)).toBe(true);
    expect(snapshot.sourceLastModified).toBeTruthy();
    expect(snapshot.retrievedAt).toBeTruthy();
    expect(snapshot.generatedAt).toBeTruthy();
    expect(snapshot.rows[0]).not.toHaveProperty("address");
    expect(snapshot.rows[0]).not.toHaveProperty("phone");
  });

  it("attaches orders only by printed exact licenses, never names or CMS guesses", () => {
    expect(orders.rows).toHaveLength(6);
    expect(orders.rows.filter((row) => row.stateLicense)).toHaveLength(4);
    expect(orders.rows.filter((row) => row.currentRosterExactMatch)).toHaveLength(2);
    for (const row of orders.rows.filter((item) => item.currentRosterExactMatch))
      expect(snapshot.rows.some((facility) => facility.license === row.stateLicense)).toBe(true);
    expect(orders.nameOnlyAttachments).toBe(0);
    expect(snapshot.cmsExactBridges).toBe(0);
    expect(snapshot.newCanonicalFacilities).toBe(0);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.claimEligibilityChanged).toBe(false);
  });

  it("publishes canonical, robots and one sitemap URL without rating schema or city pages", () => {
    expect(page).toMatch(/canonicalUrl\("\/connecticut"\)/);
    expect(page).toMatch(/robots:\s*publicRobots\(true\)/);
    expect(page).not.toMatch(/aggregateRating|ratingValue|reviewCount|Trust Score/);
    const core = sitemap.slice(
      sitemap.indexOf("const corePaths"),
      sitemap.indexOf("];", sitemap.indexOf("const corePaths")) + 2,
    );
    expect([...core.matchAll(/"\/connecticut"/g)]).toHaveLength(1);
    expect(core).not.toMatch(/\/connecticut\/hartford|\/connecticut\/new-haven/);
    expect(normalizedPublishedStatePath("/Connecticut")).toBe("/connecticut");
    expect(normalizedPublishedStatePath("/connecticut/hartford")).toBeNull();
  });

  it("routes classes and cities without ranking or overriding labeled CCNs", () => {
    for (const query of [
      "nursing home Connecticut",
      "residential care home Connecticut",
      "assisted living Connecticut",
      "senior care Connecticut",
      "hospice Connecticut",
      "home health Connecticut",
      "Connecticut nursing home license",
      "Connecticut nursing home inspection",
      "senior facility enforcement Connecticut",
      "senior complaints Connecticut",
      "nursing home Hartford",
      "nursing home New Haven",
      "nursing home Stamford",
      "nursing home Bridgeport",
    ])
      expect(connecticutIntent(query), query).toBe(true);
    expect(interpretConnecticutAsk("assisted living Connecticut")?.message).toMatch(/126/);
    expect(interpretConnecticutAsk("senior facility enforcement Connecticut")?.message).toMatch(
      /Four documents print exact CCNH licenses/,
    );
    expect(interpretConnecticutAsk("CCN 123456 Connecticut")).toBeNull();
    expect(
      interpretSeniorAskQuery("CCN 123456 Connecticut mover insurance contractor").identifier,
    ).toEqual({ type: "ccn", value: "123456" });
    expect(interpretSeniorAskQuery("123456").identifier).toBeUndefined();
    for (const query of [
      "best nursing home Connecticut",
      "safest nursing home Connecticut",
      "recommended Connecticut hospice",
      "most trustworthy Connecticut senior care",
      "top-rated nursing home Connecticut",
      "highest-rated nursing home Connecticut",
      "#1 nursing home Connecticut",
      "Trust Score Connecticut",
      "AggregateRating Connecticut",
      "ratingValue Connecticut",
      "paid ranking Connecticut",
      "sponsored ranking Connecticut",
    ])
      expect(interpretSeniorAskQuery(query).mode, query).toBe("fail_closed");
    expect(connecticutIntent("nursing home Michigan", "MI")).toBe(false);
  });
});
