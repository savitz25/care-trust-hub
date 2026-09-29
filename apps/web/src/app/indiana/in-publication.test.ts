import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/indiana-public-snapshot.json";
import { indianaIntent, interpretIndianaAsk } from "@/server/care/in-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Indiana senior publication", () => {
  it("keeps four IDOH license classes, exact identifiers and bed evidence separate", () => {
    expect(
      snapshot.sources.map((s) => [
        s.class,
        s.rows,
        s.distinctLicenses,
        s.rowsWithCcn,
        s.postedToWeb,
      ]),
    ).toEqual([
      ["comprehensive-care", 507, 507, 0, "2026-09-24"],
      ["residential-care", 230, 230, 0, "2026-09-24"],
      ["home-health-agency", 361, 344, 0, "2026-09-24"],
      ["hospice", 113, 112, 0, "2026-09-24"],
    ]);
    for (const source of snapshot.sources) {
      const rows = snapshot.rows.filter((row) => row.class === source.class);
      expect(rows).toHaveLength(source.rows);
      expect(new Set(rows.filter((r) => r.license).map((r) => r.license)).size).toBe(
        source.distinctLicenses,
      );
      expect(source.url).toMatch(/^https:\/\/www\.in\.gov\/health\/reports\/QAMIS\/.*\.htm$/);
      expect(source.sha256).toMatch(/^[a-f0-9]{64}$/);
      for (const row of rows) {
        if (row.license) expect(row.license).toMatch(/^\d{2}-\d{6}-\d$/);
      }
    }
    const cc = snapshot.sources[0];
    expect(cc.bedCapacity).toBe(59891);
    expect(cc.beds).toEqual({ SNF: 5484, NF: 582, "SNF/NF": 42759, NCC: 323, RES: 10743 });
    expect(Object.values(cc.beds ?? {}).reduce((a, b) => a + b, 0)).toBe(cc.bedCapacity);
    expect(cc.rowsWithResidentialBeds).toBe(149);
    expect(snapshot.crossClassLicenseOverlap).toBe(1);
    expect(snapshot.cmsExactBridges).toBe(0);
    expect(snapshot.inspectionIndex).toBe("NOT_ACQUIRED");
    expect(snapshot.inspectionExactAttachments).toBe(0);
    expect(snapshot.enforcementRows).toBe("NOT_ACQUIRED");
    expect(snapshot.enforcementExactAttachments).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.newCanonicalFacilities).toBe(0);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.claimEligibilityChanges).toBe(0);
    expect(
      snapshot.rows.every(
        (row) => !("street" in row || "administrator" in row || "telephone" in row || "fax" in row),
      ),
    ).toBe(true);
  });

  it("publishes one canonical statewide path with no ranking schema", () => {
    const page = fs.readFileSync("src/app/indiana/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/indiana")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("A complaint is not a violation");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    expect([...sitemap.matchAll(/"\/indiana"/g)]).toHaveLength(1);
    expect(normalizedPublishedStatePath("/Indiana")).toBe("/indiana");
    expect(normalizedPublishedStatePath("/indiana/indianapolis")).toBeNull();
  });

  it("routes state and city context while refusing winners and untyped IDs", () => {
    for (const q of [
      "nursing home Indiana",
      "residential care Indiana",
      "assisted living Indiana",
      "senior care Indiana",
      "hospice Indiana",
      "home health Indiana",
      "Indiana long term care license",
      "Indiana residential care license",
      "nursing home Indianapolis",
      "nursing home Fort Wayne",
      "nursing home Evansville",
      "nursing home South Bend",
    ])
      expect(indianaIntent(q), q).toBe(true);
    expect(indianaIntent("nursing home Milwaukee")).toBe(false);
    expect(interpretIndianaAsk("CCN 155001 Indiana")).toBeNull();
    expect(interpretIndianaAsk("155001")).toBeNull();
    expect(interpretIndianaAsk("best nursing home Indiana")?.coverage).toBe("UNSUPPORTED");
    expect(interpretIndianaAsk("assisted living Indiana")?.message).toContain(
      "not the state license class name",
    );
    expect(interpretIndianaAsk("hospice Indiana")?.message).toContain("113 rows");
    expect(interpretIndianaAsk("Indiana senior complaints")?.message).toContain("NOT_ACQUIRED");
    expect(interpretIndianaAsk("Indiana nursing home enforcement")?.coverage).toBe("NOT_ACQUIRED");
  });

  it("uses the live Senior Ask parser for Indiana research, CCN precedence and safety", () => {
    const assisted = interpretSeniorAskQuery("assisted living Indiana");
    expect(assisted.failReason).toContain("Residential Care");
    expect(assisted.failReason).toContain("/indiana");
    expect(interpretSeniorAskQuery("nursing home Fort Wayne").failReason).toContain("/indiana");
    expect(interpretSeniorAskQuery("CCN 155001 Indiana").identifier?.value).toBe("155001");
    expect(interpretSeniorAskQuery("155001").identifier).toBeUndefined();
    for (const q of [
      "best nursing home Indiana",
      "safest nursing home Indiana",
      "top-rated hospice Indiana",
      "#1 nursing home Indianapolis",
      "Trust Score nursing home Indiana",
    ])
      expect(interpretSeniorAskQuery(q).failReason, q).toMatch(/does not rank/);
    expect(interpretSeniorAskQuery("nursing home Wisconsin").failReason).toContain("/wisconsin");
    expect(interpretSeniorAskQuery("nursing home Maryland").failReason).toContain("OHCQ");
  });
});
