import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/south-carolina-public-snapshot.json";
import { interpretSouthCarolinaAsk, southCarolinaIntent } from "@/server/care/sc-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const nh = snapshot.nursingHomes;
const crcf = snapshot.communityResidentialCare;

describe("South Carolina senior publication", () => {
  it("keeps DPH permit types separate", () => {
    expect(nh.rows).toBe(192);
    expect(nh.distinctLicenseNumbers).toBe(192);
    expect(nh.licensedBedSum).toBe(nh.nursingHomeBedSum + nh.institutionalBedSum);
    expect(nh.institutionalBedBlankRows).toBe(101);
    expect(nh.blankInstitutionalBedsAreNotZero).toBe(true);
    expect(nh.printedZeroExample.nursingHomeBeds).toBe(0);
    expect(nh.printedZeroExample.licensedBeds).toBe(32);
    expect(nh.cmsIndicatorYes + nh.cmsIndicatorBlank).toBe(nh.rows);
    expect(crcf.rows).toBe(428);
    expect(
      crcf.alzheimerFlags.unitYCareY +
        crcf.alzheimerFlags.unitNCareN +
        crcf.alzheimerFlags.unitNCareY +
        crcf.alzheimerFlags.unitYCareN,
    ).toBe(crcf.rows);
    expect(crcf.crcTotalBedsNumericRows + crcf.crcTotalBedsBlankRows).toBe(crcf.rows);
    expect(crcf.licensedNumberEqualsCrcTotalBedsOnBothPopulatedRows).toBe(false);
    expect(snapshot.homeHealth.rows).toBe(106);
    expect(snapshot.homeHealth.isNotInHomeCare).toBe(true);
    expect(snapshot.hospiceFacilities.rows).toBe(13);
    expect(snapshot.hospicePrograms.rows).toBe(98);
    expect(snapshot.hospicePrograms.licensedNumberEqualsCountiesServed).toBe(true);
    expect(snapshot.adultDay.participantNumericRows + snapshot.adultDay.participantBlankRows).toBe(
      snapshot.adultDay.rows,
    );
    expect(snapshot.inHomeCare.rows).toBe(1403);
    expect(
      snapshot.inHomeCare.officeState.SC +
        snapshot.inHomeCare.officeState.NC +
        snapshot.inHomeCare.officeState.GA,
    ).toBe(snapshot.inHomeCare.rows);
    expect(snapshot.inHomeCare.sentinelIsNotABedCount).toBe(true);
    expect(snapshot.intermediateCare15OrFewer.rows).toBe(56);
    expect(snapshot.intermediateCare16OrMore.rows).toBe(8);
    expect(snapshot.intermediateCare15OrFewer.isNotASeniorCensus).toBe(true);
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.cmsExactBridges).toBeNull();
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.inspectionCorpus).toBe("NOT_ACQUIRED");
    expect(snapshot.administratorRoster).toBe("NOT_ACQUIRED");
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.cityRoutes).toBe(0);
  });

  it("publishes one statewide path and does not print a combined census", () => {
    const page = fs.readFileSync("src/app/south-carolina/page.tsx", "utf8");
    const ask = fs.readFileSync("src/server/care/sc-ask.ts", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/south-carolina")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("does not publish a combined South Carolina senior facility total");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    for (const forbidden of ["2,400", "2400", "2,336", "2336"]) {
      expect(page, forbidden).not.toContain(forbidden);
      expect(ask, forbidden).not.toContain(forbidden);
    }
    expect([...sitemap.matchAll(/"\/south-carolina"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/south-carolina\/[a-z-]+"/);
    expect(normalizedPublishedStatePath("/South-Carolina")).toBe("/south-carolina");
    expect(normalizedPublishedStatePath("/south-carolina")).toBeNull();
    expect(normalizedPublishedStatePath("/south-carolina/charleston")).toBeNull();
    expect(normalizedPublishedStatePath("/south-carolina/columbia")).toBeNull();
    expect(normalizedPublishedStatePath("/south-carolina/greenville")).toBeNull();
    expect(fs.existsSync("src/app/south-carolina/charleston")).toBe(false);
  });

  it("routes South Carolina by class and refuses a combined total", () => {
    for (const q of [
      "nursing home South Carolina",
      "assisted living South Carolina",
      "home health in sc",
      "hospice South Carolina",
    ])
      expect(southCarolinaIntent(q), q).toBe(true);
    for (const q of ["nursing home Charleston", "best sc nursing home", "nursing home Kentucky"])
      expect(southCarolinaIntent(q), q).toBe(false);
    expect(interpretSouthCarolinaAsk("CCN 425321 South Carolina")).toBeNull();
    const nursing = interpretSouthCarolinaAsk("nursing home South Carolina");
    expect(nursing?.message).toContain("192 license rows");
    expect(nursing?.message).toContain("20,576");
    expect(nursing?.message).toContain("blank is not zero");
    expect(nursing?.message).toContain("NCF-0579");
    const assisted = interpretSouthCarolinaAsk("assisted living South Carolina");
    expect(assisted?.message).toContain("428");
    expect(assisted?.message).toContain("not a nursing-home count");
    expect(assisted?.message).toContain("CRC-2011");
    const memory = interpretSouthCarolinaAsk("memory care South Carolina");
    expect(memory?.message).toContain("not a license class");
    expect(memory?.message).toContain("137");
    const hospice = interpretSouthCarolinaAsk("hospice South Carolina");
    expect(hospice?.message).toContain("13");
    expect(hospice?.message).toContain("98");
    expect(hospice?.message).toContain("not added");
    expect(hospice?.message).not.toContain("111");
    const home = interpretSouthCarolinaAsk("home health South Carolina");
    expect(home?.message).toContain("106");
    expect(home?.message).toContain("not in-home care");
    const inHome = interpretSouthCarolinaAsk("in-home care South Carolina");
    expect(inHome?.message).toContain("1,403");
    expect(inHome?.message).toContain("not a bed count");
    expect(inHome?.message).not.toContain("-1,403");
    const day = interpretSouthCarolinaAsk("adult day South Carolina");
    expect(day?.message).toContain("ADC-0549");
    expect(day?.message).toContain("blank is not zero");
    expect(
      interpretSouthCarolinaAsk("how many senior facilities in South Carolina")?.message,
    ).toContain("does not publish a combined South Carolina senior facility total");
    expect(interpretSouthCarolinaAsk("best nursing home South Carolina")?.coverage).toBe(
      "UNSUPPORTED",
    );
    expect(interpretSouthCarolinaAsk("nursing home Charleston South Carolina")?.message).toContain(
      "geography only",
    );
    expect(interpretSouthCarolinaAsk("South Carolina nursing home inspection")?.coverage).toBe(
      "NOT_ACQUIRED",
    );
  });

  it("uses the live Senior Ask parser without stealing Kentucky", () => {
    expect(interpretSeniorAskQuery("nursing home South Carolina").failReason).toContain(
      "192 license rows",
    );
    expect(interpretSeniorAskQuery("assisted living South Carolina").failReason).toContain(
      "/south-carolina",
    );
    expect(interpretSeniorAskQuery("memory care South Carolina").failReason).toContain(
      "not a license class",
    );
    expect(interpretSeniorAskQuery("nursing home Kentucky").failReason).toContain("/kentucky");
    expect(interpretSeniorAskQuery("nursing home Charleston").failReason ?? "").not.toContain(
      "HLNURSINGCARE",
    );
  });
});
