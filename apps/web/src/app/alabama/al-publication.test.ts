import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/alabama-public-snapshot.json";
import { alabamaIntent, interpretAlabamaAsk } from "@/server/care/al-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const COMBINED = 232 + 187 + 107 + 197 + 188;

describe("Alabama senior publication", () => {
  it("keeps ADPH directory classes separate and preserves the source gaps", () => {
    expect(snapshot.sources.map((s) => [s.class, s.directoryRows, s.distinctFacIds])).toEqual([
      ["nursing-home", 232, 232],
      ["assisted-living", 187, 187],
      ["specialty-care-assisted-living", 107, 107],
      ["home-health", 197, 197],
      ["hospice", 188, 188],
    ]);
    const nursing = snapshot.sources.find((s) => s.class === "nursing-home")!;
    const home = snapshot.sources.find((s) => s.class === "home-health")!;
    const hospice = snapshot.sources.find((s) => s.class === "hospice")!;
    const scalf = snapshot.sources.find((s) => s.class === "specialty-care-assisted-living")!;
    expect(nursing.licensedBedsSum).toBe(27342);
    expect(nursing.medicareNumberPrintedRows).toBe(226);
    expect(nursing.licenseStatus).toEqual([
      { label: "Regular", count: 230 },
      { label: "Not subject to licensure", count: 2 },
    ]);
    expect(home.distinctPrintedNames).toBe(133);
    expect(home.licensedBedsSum).toBeNull();
    expect(home.licensedBedsBlankRows).toBe(197);
    expect(home.medicareNumberPrintedRows).toBe(134);
    expect(home.licenseStatus).toEqual([{ label: "Not subject to licensure", count: 197 }]);
    expect(hospice.licensedBedsSum).toBe(99);
    expect(hospice.medicareNumberPrintedRows).toBe(89);
    expect(scalf.licenseStatus.map((row) => row.count)).toEqual([106, 1]);
    expect(snapshot.hospiceInpatientBedRows.reduce((sum, row) => sum + row.licensedBeds, 0)).toBe(
      99,
    );
    expect(snapshot.directoryExceptions.map((row) => row.facId)).toEqual([
      "N0806",
      "N6104",
      "P4903",
      "E1004",
    ]);
    expect(snapshot.statisticalSummary.reportClock).toBe("2026-10-05 9:58 AM");
    expect(snapshot.statisticalSummary.allFacilityGrandTotalUsed).toBe(false);
    const nursingTotal = snapshot.statisticalSummary.classes
      .find((s) => s.class === "nursing-home")!
      .lines.find((line) => line.label === "Total")!;
    expect(nursingTotal).toEqual({
      label: "Total",
      licensedFacilities: 230,
      certifiedFacilities: 226,
      licensedBedsOrStations: 27342,
    });
    const hospiceLine = snapshot.statisticalSummary.classes.find((s) => s.class === "hospice")!
      .lines[0]!;
    expect(hospiceLine.licensedBedsOrStations).toBe(100);
    expect(hospiceLine.licensedFacilities).toBe(187);
    expect(hospiceLine.certifiedFacilities).toBe(89);
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.cmsExactBridges).toBe(0);
    expect(snapshot.specialFocusFacility.joinedToDirectoryFacId).toBe(false);
    expect(snapshot.surveyProgram).toBe("KNOWN");
    expect(snapshot.inspectionEventRows).toBe("NOT_ACQUIRED");
    expect(snapshot.deficiencyRows).toBe("NOT_ACQUIRED");
    expect(snapshot.complaintIntake).toBe("KNOWN");
    expect(snapshot.complaintProviderRows).toBe("NOT_ACQUIRED");
    expect(snapshot.enforcementRows).toBe("NOT_ACQUIRED");
    expect(snapshot.adultDay.count).toBeNull();
    expect(snapshot.alabamaDepartmentOfSeniorServices.usedAsFacilityRoster).toBe(false);
    expect(snapshot.licenseNumberColumn).toBe("NOT_IN_SOURCE");
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.cityRoutes).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.newCanonicalFacilities).toBe(0);
    expect("rows" in snapshot).toBe(false);
    for (const source of snapshot.sources) {
      expect(source.licenseeType.reduce((sum, row) => sum + row.count, 0)).toBe(
        source.directoryRows,
      );
      expect(source.distinctFacIds).toBe(source.directoryRows);
    }
  });

  it("publishes one canonical statewide path and does not print a combined census", () => {
    const page = fs.readFileSync("src/app/alabama/page.tsx", "utf8");
    const ask = fs.readFileSync("src/server/care/al-ask.ts", "utf8");
    const json = fs.readFileSync("src/data/alabama-public-snapshot.json", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/alabama")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page.toLowerCase()).toContain("specialty care");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    for (const forbidden of [
      String(COMBINED),
      "1719",
      "1,719",
      "59435",
      "59,435",
      "1225",
      "1,225",
    ]) {
      expect(page, forbidden).not.toContain(forbidden);
      expect(ask, forbidden).not.toContain(forbidden);
      expect(json, forbidden).not.toContain(forbidden);
    }
    expect(json).not.toContain("01-G011");
    expect(json).not.toContain("01-1517");
    expect([...sitemap.matchAll(/"\/alabama"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/alabama\/[a-z-]+"/);
    expect(normalizedPublishedStatePath("/Alabama")).toBe("/alabama");
    expect(normalizedPublishedStatePath("/alabama/birmingham")).toBeNull();
    expect(normalizedPublishedStatePath("/alabama/mobile")).toBeNull();
    expect(fs.existsSync("src/app/alabama/birmingham")).toBe(false);
  });

  it("routes explicit Alabama context and refuses a combined total", () => {
    for (const q of [
      "nursing home Alabama",
      "assisted living Alabama",
      "specialty care assisted living Alabama",
      "home health Alabama",
      "hospice Alabama",
      "senior care Alabama",
      "Alabama senior inspection",
      "senior complaints Alabama",
      "nursing home Birmingham",
      "assisted living Montgomery",
      "hospice Huntsville",
      "nursing home Tuscaloosa",
      "nursing home Mobile, Alabama",
      "home health mobile alabama",
      "nursing home AL",
    ])
      expect(alabamaIntent(q), q).toBe(true);
    for (const q of [
      "nursing home mobile",
      "mobile home",
      "hospice Lafayette",
      "nursing home Milwaukee",
      "nursing home Birmingham Michigan",
      "assisted living Louisiana",
    ])
      expect(alabamaIntent(q), q).toBe(false);
    expect(interpretAlabamaAsk("nursing home mobile", "AL")).toBeNull();
    expect(interpretAlabamaAsk("CCN 015019 Alabama")).toBeNull();
    expect(interpretAlabamaAsk("015019")).toBeNull();
    expect(interpretAlabamaAsk("best nursing home Alabama")?.coverage).toBe("UNSUPPORTED");
    const nursing = interpretAlabamaAsk("nursing home Alabama");
    expect(nursing?.message).toContain("232 directory rows");
    expect(nursing?.message).toContain("N0806");
    expect(nursing?.message).toContain("not a licensed-only nursing-home census");
    expect(interpretAlabamaAsk("assisted living Alabama")?.message).toContain("187 directory rows");
    expect(interpretAlabamaAsk("assisted living Alabama")?.message).not.toContain(
      "107 directory rows",
    );
    const scalf = interpretAlabamaAsk("specialty care Alabama");
    expect(scalf?.message).toContain("107 directory rows");
    expect(scalf?.message).toContain("P4903");
    const home = interpretAlabamaAsk("home health Alabama");
    expect(home?.message).toContain("197 directory rows");
    expect(home?.message).toContain("not a licensed-agency count");
    expect(home?.message).toContain("134 certified");
    const hospice = interpretAlabamaAsk("hospice Alabama");
    expect(hospice?.message).toContain("188 directory rows");
    expect(hospice?.message).toContain("100");
    expect(hospice?.message).toContain("99");
    expect(hospice?.message).toContain("E1004");
    const combined = interpretAlabamaAsk("how many senior facilities in Alabama");
    expect(combined?.message).toContain(
      "does not publish a combined Alabama senior facility total",
    );
    expect(combined?.message).not.toContain(String(COMBINED));
    expect(interpretAlabamaAsk("assisted living and specialty care Alabama")?.message).toContain(
      "will not add",
    );
    expect(interpretAlabamaAsk("nursing home Birmingham")?.message).toContain("geography only");
    expect(interpretAlabamaAsk("adult day Alabama")?.message).toContain("not a count of zero");
    expect(interpretAlabamaAsk("memory care Alabama")?.message).toContain("not a separate");
    expect(interpretAlabamaAsk("memory care Alabama")?.message).toContain("107");
    expect(interpretAlabamaAsk("Alabama senior complaints")?.coverage).toBe("NOT_ACQUIRED");
    expect(interpretAlabamaAsk("Alabama nursing home inspection")?.message).toContain("KNOWN");
    expect(interpretAlabamaAsk("Alabama nursing home inspection")?.coverage).toBe("NOT_ACQUIRED");
  });

  it("uses the live Senior Ask parser without stealing Louisiana, Michigan, or bare Mobile", () => {
    expect(interpretSeniorAskQuery("assisted living Alabama").failReason).toContain("/alabama");
    expect(interpretSeniorAskQuery("nursing home Birmingham").failReason).toContain(
      "232 directory rows",
    );
    expect(interpretSeniorAskQuery("nursing home Mobile, Alabama").failReason).toContain(
      "geography only",
    );
    expect(interpretSeniorAskQuery("specialty care assisted living Alabama").failReason).toContain(
      "P4903",
    );
    expect(interpretSeniorAskQuery("home health Alabama").failReason).toContain(
      "not a licensed-agency count",
    );
    expect(interpretSeniorAskQuery("hospice Alabama").failReason).toContain("E1004");
    expect(interpretSeniorAskQuery("senior care Alabama").failReason).toContain(
      "combined Alabama senior facility total",
    );
    expect(interpretSeniorAskQuery("memory care Alabama").failReason).toContain("107");
    expect(interpretSeniorAskQuery("memory care Alabama").failReason).not.toContain(
      "not a CMS provider class",
    );
    const bareMobile = JSON.stringify(interpretSeniorAskQuery("nursing home mobile"));
    expect(bareMobile).not.toContain("/alabama");
    expect(bareMobile).not.toContain("232 directory rows");
    expect(interpretSeniorAskQuery("hospice Lafayette").failReason).toContain("/louisiana");
    expect(interpretSeniorAskQuery("hospice Lafayette").failReason).not.toContain("/alabama");
    expect(interpretSeniorAskQuery("nursing home Birmingham Michigan").failReason).toContain(
      "/michigan",
    );
    expect(interpretSeniorAskQuery("CCN 015019 Alabama").identifier?.value).toBe("015019");
    expect(interpretSeniorAskQuery("best nursing home Alabama").failReason).toMatch(
      /does not rank/,
    );
    expect(interpretSeniorAskQuery("nursing home Louisiana").failReason).toContain("/louisiana");
  });
});
