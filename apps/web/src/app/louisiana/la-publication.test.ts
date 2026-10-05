import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/louisiana-public-snapshot.json";
import { interpretLouisianaAsk, louisianaIntent } from "@/server/care/la-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const COMBINED = 266 + 164 + 196 + 127 + 28 + 450;

describe("Louisiana senior publication", () => {
  it("keeps LDH directory classes separate and does not sum them", () => {
    expect(
      snapshot.sources.map((s) => [
        s.class,
        s.rowCount,
        s.pageCount,
        s.distinctPrintedNames,
        s.sourceUrl,
      ]),
    ).toEqual([
      ["nursing-home", 266, 14, 266, "https://ldh.la.gov/directory/category/173"],
      ["adult-residential-care", 164, 9, 162, "https://ldh.la.gov/directory/category/161"],
      ["home-health", 196, 10, 165, "https://ldh.la.gov/directory/category/167"],
      ["hospice", 127, 7, 106, "https://ldh.la.gov/directory/category/168"],
      ["adult-day-health-care", 28, 2, 28, "https://ldh.la.gov/directory/category/238"],
      ["icf-iid", 450, 23, 449, "https://ldh.la.gov/directory/category/170"],
    ]);
    for (const source of snapshot.sources) {
      expect(source.retrievedAt).toBe("2026-10-05");
      expect(source.rowsAreDeduplicatedLicensedCampuses).toBe(false);
      expect(source.distinctDirectoryLinks).toBe(source.rowCount);
      expect(source.rowCount).toBeGreaterThan((source.pageCount - 1) * 20);
      expect(source.rowCount).toBeLessThanOrEqual(source.pageCount * 20);
    }
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.cmsExactBridges).toBe(0);
    expect(snapshot.surveyProgram).toBe("KNOWN");
    expect(snapshot.inspectionEventRows).toBe("NOT_ACQUIRED");
    expect(snapshot.complaintIntake).toBe("KNOWN");
    expect(snapshot.complaintProviderRows).toBe("NOT_ACQUIRED");
    expect(snapshot.enforcementRows).toBe("NOT_ACQUIRED");
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.parishRoutes).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect("rows" in snapshot).toBe(false);
    expect(String(COMBINED)).not.toBe("0");
  });

  it("publishes one canonical statewide path with no ranking schema or parish route", () => {
    const page = fs.readFileSync("src/app/louisiana/page.tsx", "utf8");
    const ask = fs.readFileSync("src/server/care/la-ask.ts", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/louisiana")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("Adult residential care");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    expect(page).not.toContain(String(COMBINED));
    expect(page).not.toContain(COMBINED.toLocaleString("en-US"));
    expect(ask).not.toContain(String(COMBINED));
    expect([...sitemap.matchAll(/"\/louisiana"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/louisiana\/[a-z-]+"/);
    expect(normalizedPublishedStatePath("/Louisiana")).toBe("/louisiana");
    expect(normalizedPublishedStatePath("/louisiana/new-orleans")).toBeNull();
    expect(normalizedPublishedStatePath("/louisiana/orleans")).toBeNull();
  });

  it("routes state and city context while refusing a combined total and untyped IDs", () => {
    for (const q of [
      "nursing home Louisiana",
      "assisted living Louisiana",
      "adult residential care Louisiana",
      "home health Louisiana",
      "hospice Louisiana",
      "adult day health care Louisiana",
      "ICF Louisiana",
      "senior care Louisiana",
      "Louisiana senior inspection",
      "senior complaints Louisiana",
      "nursing home New Orleans",
      "nursing home Baton Rouge",
      "nursing home Shreveport",
      "hospice Lafayette",
    ])
      expect(louisianaIntent(q), q).toBe(true);
    expect(louisianaIntent("nursing home Milwaukee")).toBe(false);
    expect(interpretLouisianaAsk("CCN 195001 Louisiana")).toBeNull();
    expect(interpretLouisianaAsk("195001")).toBeNull();
    expect(interpretLouisianaAsk("best nursing home Louisiana")?.coverage).toBe("UNSUPPORTED");
    const assisted = interpretLouisianaAsk("assisted living Louisiana");
    expect(assisted?.message).toContain("Adult residential care");
    expect(assisted?.message).toContain("164 source rows");
    expect(assisted?.message).toContain("not a generic assisted-living census");
    expect(interpretLouisianaAsk("nursing home Louisiana")?.message).toContain("266 source rows");
    expect(interpretLouisianaAsk("home health Louisiana")?.message).toContain("196 source rows");
    expect(interpretLouisianaAsk("hospice Louisiana")?.message).toContain("127 source rows");
    expect(interpretLouisianaAsk("adult day Louisiana")?.message).toContain("28 source rows");
    expect(interpretLouisianaAsk("ICF/IID Louisiana")?.message).toContain("450 source rows");
    const combined = interpretLouisianaAsk("how many senior facilities in Louisiana");
    expect(combined?.message).toContain("does not publish a combined Louisiana facility total");
    expect(combined?.message).not.toContain(String(COMBINED));
    expect(interpretLouisianaAsk("nursing homes and assisted living Louisiana")?.message).toContain(
      "will not add",
    );
    expect(interpretLouisianaAsk("nursing home New Orleans")?.message).toContain("geography only");
    expect(interpretLouisianaAsk("Louisiana senior complaints")?.message).toContain("NOT_ACQUIRED");
    expect(interpretLouisianaAsk("Louisiana nursing home inspection")?.message).toContain("KNOWN");
    expect(interpretLouisianaAsk("Louisiana nursing home inspection")?.coverage).toBe(
      "NOT_ACQUIRED",
    );
    expect(interpretLouisianaAsk("memory care Louisiana")?.message).toContain("not a separate");
  });

  it("uses the live Senior Ask parser for Louisiana research, CCN precedence and safety", () => {
    const assisted = interpretSeniorAskQuery("assisted living Louisiana");
    expect(assisted.failReason).toContain("Adult residential care");
    expect(assisted.failReason).toContain("/louisiana");
    expect(interpretSeniorAskQuery("nursing home New Orleans").failReason).toContain(
      "266 source rows",
    );
    expect(interpretSeniorAskQuery("nursing home Baton Rouge").failReason).toContain(
      "geography only",
    );
    expect(interpretSeniorAskQuery("home health Shreveport").failReason).toContain(
      "196 source rows",
    );
    expect(interpretSeniorAskQuery("hospice Lafayette").failReason).toContain("127 source rows");
    expect(interpretSeniorAskQuery("senior care Louisiana").failReason).toContain(
      "combined Louisiana facility total",
    );
    expect(interpretSeniorAskQuery("CCN 195001 Louisiana").identifier?.value).toBe("195001");
    expect(interpretSeniorAskQuery("195001").identifier).toBeUndefined();
    for (const q of [
      "best nursing home Louisiana",
      "safest nursing home Louisiana",
      "top-rated hospice Louisiana",
      "#1 nursing home New Orleans",
      "Trust Score nursing home Louisiana",
    ])
      expect(interpretSeniorAskQuery(q).failReason, q).toMatch(/does not rank/);
    expect(interpretSeniorAskQuery("nursing home Wisconsin").failReason).toContain("/wisconsin");
    expect(interpretSeniorAskQuery("nursing home Indiana").failReason).toContain("/indiana");
    expect(interpretSeniorAskQuery("memory care Louisiana").failReason).toContain(
      "Adult residential care",
    );
  });
});
