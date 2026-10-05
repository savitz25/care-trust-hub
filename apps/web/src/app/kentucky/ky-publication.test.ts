import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/kentucky-public-snapshot.json";
import { interpretKentuckyAsk, kentuckyIntent } from "@/server/care/ky-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

const ltc = snapshot.longTermCare;
const alc = snapshot.assistedLiving;
const fch = snapshot.familyCareHomes;
const psa = snapshot.personalServicesAgencies;
const home = snapshot.miscellaneous.homeHealth;
const hospice = snapshot.miscellaneous.hospice;

describe("Kentucky senior publication", () => {
  it("keeps OIG directory grains separate", () => {
    expect(ltc.sheetRows).toBe(ltc.facilityRows + 1);
    expect(ltc.facilityRows).toBe(312);
    expect(ltc.distinctLicenseNumbers).toBe(312);
    expect(ltc.noteRowIsAFacility).toBe(false);
    expect(ltc.certifiedBedNumericRows + ltc.certifiedBedBlankFacilityRows).toBe(ltc.facilityRows);
    expect(ltc.certifiedBedSum).toBe(26236);
    expect(ltc.blankCertifiedBedsAreNotZero).toBe(true);
    expect(alc.types.ALC + alc.types["ALC-BH"] + alc.types["ALC-DC"]).toBe(alc.typeRows);
    expect(alc.typeRows).toBe(247);
    expect(alc.distinctPrintedLicenseNumbers).toBe(244);
    expect(alc.distinctFacilities).toBeNull();
    expect(alc.distinctCampusUnitCapacity).toBeNull();
    expect(alc.sameFacilityTwoTypes.licenseNumber).toBe("101294");
    expect(alc.sameLicenseTwoFacilities.licenseNumber).toBe("101513");
    expect(alc.sameLicenseTwoFacilities.facilities).toHaveLength(2);
    expect(alc.rowWithoutLicenseNumber.name).toBe("FOREST HILLS COMMON");
    expect(snapshot.personalCareHomes.rows).toBe(47);
    expect(snapshot.personalCareHomes.bedSum).toBe(2548);
    expect(fch.rows).toBe(24);
    expect(fch.bedsPrinted3 * 3).toBe(fch.printedBedCellSum);
    expect(fch.bedsPrinted0).toBe(10);
    expect(fch.printedZeroIsAPrintedZero).toBe(true);
    expect(snapshot.miscellaneous.adultDayHealth.rows).toBe(112);
    expect(snapshot.miscellaneous.adultDayHealth.distinctFacilityIds).toBe(112);
    expect(home.rows).toBe(home.distinctFacilityIds + home.rowsWithoutFacilityId + 1);
    expect(home.repeatedFacilityId).toBe("187093");
    expect(hospice.rows).toBe(hospice.distinctFacilityIds + hospice.sharedLocationRows - 1);
    expect(hospice.sharedLocationId).toBe("181500");
    expect(hospice.datedExpirationRows).toBe(27);
    expect(psa.rows).toBe(313);
    expect(
      psa.officeState.KY +
        psa.officeState.IN +
        psa.officeState.OH +
        psa.officeState.TN +
        psa.officeState.WV,
    ).toBe(psa.rows);
    expect(psa.pendingRenewalRows + psa.datedExpirationRows).toBe(psa.rows);
    expect(psa.isFacilityLicense).toBe(false);
    expect(snapshot.miscellaneous.rows).toBe(1671);
    expect(snapshot.miscellaneous.isSeniorCensus).toBe(false);
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.cmsExactBridges).toBeNull();
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.medicaidEnrollment).toBe("NOT_ACQUIRED");
    expect(snapshot.inspectionSearch).toBe("KNOWN");
    expect(snapshot.inspectionCorpus).toBe("NOT_ACQUIRED");
    expect(snapshot.complaintRows).toBe("NOT_ACQUIRED");
    expect(snapshot.enforcementCorpus).toBe("NOT_ACQUIRED");
    expect(snapshot.openRecordsRequest).toBe("NOT_FILED");
    expect(snapshot.countyArrangementFilesLoaded).toBe(false);
    expect(snapshot.priorSeptemberPdfUsedAsPopulation).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.newCanonicalFacilities).toBe(0);
    expect(snapshot.cityRoutes).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.sheetName).toBe("October 2026");
  });

  it("publishes one canonical statewide path and does not print a combined census", () => {
    const page = fs.readFileSync("src/app/kentucky/page.tsx", "utf8");
    const ask = fs.readFileSync("src/server/care/ky-ask.ts", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/kentucky")');
    expect(page).toContain("publicRobots(true)");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).not.toMatch(/AggregateRating|ratingValue|Trust Score/);
    for (const forbidden of ["1173", "1,173", "1174", "1,174", "860"]) {
      expect(page, forbidden).not.toContain(forbidden);
      expect(ask, forbidden).not.toContain(forbidden);
    }
    expect([...sitemap.matchAll(/"\/kentucky"/g)]).toHaveLength(1);
    expect(sitemap).not.toMatch(/"\/kentucky\/[a-z-]+"/);
    expect(normalizedPublishedStatePath("/Kentucky")).toBe("/kentucky");
    expect(normalizedPublishedStatePath("/kentucky/louisville")).toBeNull();
    expect(normalizedPublishedStatePath("/kentucky/lexington")).toBeNull();
    expect(fs.existsSync("src/app/kentucky/louisville")).toBe(false);
  });

  it("routes Kentucky context and refuses a combined total", () => {
    for (const q of [
      "nursing home Kentucky",
      "assisted living Kentucky",
      "memory care Kentucky",
      "personal care home Kentucky",
      "family care Kentucky",
      "home health Kentucky",
      "hospice Kentucky",
      "adult day Kentucky",
      "personal services agency Kentucky",
      "senior care KY",
      "nursing home Louisville",
      "assisted living Lexington",
      "hospice Louisville, Kentucky",
    ])
      expect(kentuckyIntent(q), q).toBe(true);
    for (const q of [
      "nursing home Milwaukee",
      "assisted living Louisiana",
      "nursing home Louisville Alabama",
      "hospice Lafayette",
      "home health mobile",
    ])
      expect(kentuckyIntent(q), q).toBe(false);
    expect(interpretKentuckyAsk("100326")).toBeNull();
    expect(interpretKentuckyAsk("CCN 185001 Kentucky")).toBeNull();
    expect(interpretKentuckyAsk("best nursing home Kentucky")?.coverage).toBe("UNSUPPORTED");
    const nursing = interpretKentuckyAsk("nursing home Kentucky");
    expect(nursing?.message).toContain("312 facility rows");
    expect(nursing?.message).toContain("*licensed under 100326");
    expect(nursing?.message).toContain("26,236");
    expect(nursing?.message).toContain("blank is not zero");
    const assisted = interpretKentuckyAsk("assisted living Kentucky");
    expect(assisted?.message).toContain("247 type rows");
    expect(assisted?.message).toContain("101513");
    expect(assisted?.message).toContain("101294");
    expect(assisted?.message).toContain("FOREST HILLS COMMON");
    expect(assisted?.message).toContain("not a campus capacity");
    expect(interpretKentuckyAsk("memory care Kentucky")?.message).toContain("85");
    expect(interpretKentuckyAsk("memory care Kentucky")?.message).toContain("not added");
    const family = interpretKentuckyAsk("family care Kentucky");
    expect(family?.message).toContain("printed zero");
    expect(family?.message).toContain("42");
    const hh = interpretKentuckyAsk("home health Kentucky");
    expect(hh?.message).toContain("91 rows");
    expect(hh?.message).toContain("86 distinct");
    expect(hh?.message).toContain("187093");
    expect(hh?.message).toContain("not an agency census");
    const hos = interpretKentuckyAsk("hospice Kentucky");
    expect(hos?.message).toContain("27 rows");
    expect(hos?.message).toContain("23 distinct");
    expect(hos?.message).toContain("181500");
    const agency = interpretKentuckyAsk("personal services agency Kentucky");
    expect(agency?.message).toContain("313 license rows");
    expect(agency?.message).toContain("not a facility license");
    expect(agency?.message).toContain("not a service area");
    const combined = interpretKentuckyAsk("how many senior facilities in Kentucky");
    expect(combined?.message).toContain(
      "does not publish a combined Kentucky senior facility total",
    );
    expect(combined?.message).not.toContain("1,173");
    expect(interpretKentuckyAsk("nursing home Louisville")?.message).toContain("geography only");
    expect(interpretKentuckyAsk("Kentucky nursing home inspection")?.coverage).toBe("NOT_ACQUIRED");
    expect(interpretKentuckyAsk("Kentucky nursing home inspection")?.message).toContain("KNOWN");
    expect(interpretKentuckyAsk("Kentucky senior complaints")?.coverage).toBe("NOT_ACQUIRED");
  });

  it("uses the live Senior Ask parser without stealing Alabama or Louisiana", () => {
    expect(interpretSeniorAskQuery("assisted living Kentucky").failReason).toContain("/kentucky");
    expect(interpretSeniorAskQuery("nursing home Louisville").failReason).toContain(
      "312 facility rows",
    );
    expect(interpretSeniorAskQuery("memory care Kentucky").failReason).toContain("ALC-DC");
    expect(interpretSeniorAskQuery("assisted living Alabama").failReason).toContain("/alabama");
    expect(interpretSeniorAskQuery("nursing home Louisiana").failReason).toContain("/louisiana");
    expect(interpretSeniorAskQuery("nursing home Louisville Alabama").failReason).not.toContain(
      "/kentucky",
    );
  });
});
