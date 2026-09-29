import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/wisconsin-public-snapshot.json";
import { interpretWisconsinAsk, wisconsinIntent } from "@/server/care/wi-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Wisconsin senior publication", () => {
  it("keeps six DHS provider classes and exact identifiers separate", () => {
    expect(
      snapshot.sources.map((s) => [s.class, s.rows, s.distinctLicenses, s.rowsWithCcn]),
    ).toEqual([
      ["adult-family-home", 2479, 2479, 0],
      ["community-based-residential-facility", 1534, 1534, 0],
      ["residential-care-apartment-complex", 360, 360, 0],
      ["nursing-home", 334, 334, 319],
      ["hospice", 100, 100, 85],
      ["home-health-agency", 133, 127, 88],
    ]);
    for (const source of snapshot.sources) {
      const rows = snapshot.rows.filter((row) => row.class === source.class);
      expect(rows).toHaveLength(source.rows);
      expect(new Set(rows.map((row) => row.license)).size).toBe(source.distinctLicenses);
      expect(rows.filter((row) => row.ccn).length).toBe(source.rowsWithCcn);
      expect(source.url).toMatch(/^https:\/\/www\.dhs\.wisconsin\.gov\/guide\/.*\.xlsx$/);
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(snapshot.cmsSourceKeys).toBe(492);
    expect(snapshot.cmsExactBridges).toBe(0);
    expect(snapshot.surveyAdditionsSource.rows).toBe(96);
    expect(snapshot.surveyAdditionsSource.exactRosterMatches).toBe(95);
    expect(snapshot.inspectionIndex).toBe("NOT_ACQUIRED");
    expect(snapshot.inspectionExactAttachments).toBe(0);
    expect(snapshot.enforcementExactAttachments).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.graphWrites).toBe(0);
    expect(
      snapshot.rows.every((row) => !("street" in row || "phone" in row || "contact" in row)),
    ).toBe(true);
  });

  it("publishes one canonical statewide path with no ranking schema", () => {
    const page = fs.readFileSync("src/app/wisconsin/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/wisconsin")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    expect([...sitemap.matchAll(/"\/wisconsin"/g)]).toHaveLength(1);
    expect(normalizedPublishedStatePath("/Wisconsin")).toBe("/wisconsin");
    expect(normalizedPublishedStatePath("/wisconsin/milwaukee")).toBeNull();
  });

  it("routes state and city context while refusing winners and untyped IDs", () => {
    for (const q of [
      "nursing home Wisconsin",
      "assisted living Wisconsin",
      "CBRF Wisconsin",
      "residential care Wisconsin",
      "adult family home Wisconsin",
      "hospice Wisconsin",
      "home health Wisconsin",
      "Wisconsin senior inspection",
      "Wisconsin senior enforcement",
      "senior complaints Wisconsin",
      "nursing home Milwaukee",
      "nursing home Madison",
      "nursing home Green Bay",
      "nursing home Kenosha",
    ])
      expect(wisconsinIntent(q), q).toBe(true);
    expect(interpretWisconsinAsk("CCN 525435 Wisconsin")).toBeNull();
    expect(interpretWisconsinAsk("525435")).toBeNull();
    expect(interpretWisconsinAsk("best nursing home Wisconsin")?.coverage).toBe("UNSUPPORTED");
    expect(interpretWisconsinAsk("assisted living Wisconsin")?.message).toContain(
      "AFH, CBRF and RCAC",
    );
    expect(interpretWisconsinAsk("Wisconsin senior complaints")?.message).toContain("NOT_ACQUIRED");
  });

  it("uses the live Senior Ask parser for Wisconsin state research and safety", () => {
    const assisted = interpretSeniorAskQuery("assisted living Wisconsin");
    expect(assisted.failReason).toContain("AFH, CBRF and RCAC");
    expect(assisted.failReason).toContain("/wisconsin");
    expect(interpretSeniorAskQuery("CCN 525435 Wisconsin").identifier?.value).toBe("525435");
    expect(interpretSeniorAskQuery("525435").identifier).toBeUndefined();
    expect(interpretSeniorAskQuery("best nursing home Wisconsin").failReason).toContain(
      "does not rank",
    );
    expect(interpretSeniorAskQuery("nursing home Maryland").failReason).toContain("OHCQ");
  });
});
