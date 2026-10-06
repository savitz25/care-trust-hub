import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/oklahoma-public-snapshot.json";
import { interpretOklahomaAsk } from "@/server/care/ok-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Oklahoma senior publication", () => {
  it("keeps April directories off the August slide", () => {
    const call = snapshot.providerCall;
    expect(
      call.nursingHomesFederal +
        call.nursingHomesOther +
        call.icfIid +
        call.assistedLivingCenters +
        call.residentialCareHomes +
        call.adultDayCare,
    ).toBe(call.slideTotal);
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.directories.assistedLiving.facilityIds).not.toBe(call.assistedLivingCenters);
    expect(snapshot.directories.nursingHome.facilityIds).not.toBe(call.nursingHomesFederal);
    expect(
      snapshot.directories.nursingHome.nhPrefix + snapshot.directories.nursingHome.continuumPrefix,
    ).toBe(snapshot.directories.nursingHome.facilityIds);
    expect(
      snapshot.directories.assistedLiving.alPrefix +
        snapshot.directories.assistedLiving.nursingIdWithAlSuffix +
        snapshot.directories.assistedLiving.continuumIdWithAlSuffix,
    ).toBe(snapshot.directories.assistedLiving.facilityIds);
    expect(snapshot.directories.residentialCare.parsedFacilityIds).toBe(
      snapshot.directories.residentialCare.printedFacilities,
    );
    expect(snapshot.directories.adultDay.parsedFacilityIds).toBe(
      snapshot.directories.adultDay.printedCenters,
    );
    const cites = snapshot.surveyCitationsSfy2026;
    expect(
      cites.A +
        cites.B +
        cites.C +
        cites.D +
        cites.E +
        cites.F +
        cites.G +
        cites.H +
        cites.I +
        cites.J +
        cites.K +
        cites.L,
    ).toBe(cites.printedCellSum);
    expect(cites.sumIsFacilityCount).toBe(false);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.medicalFacilitiesDirectory.prefixIsClassCensus).toBe(false);
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/oklahoma/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/oklahoma")');
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("NOT_SEPARATED");
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(/\/oklahoma\/(?:tulsa|oklahoma-city|norman)/);
    expect(sitemap.match(/"\/oklahoma"/g)).toHaveLength(1);
    expect(fs.readdirSync("src/app/oklahoma")).toEqual(["ok-publication.test.ts", "page.tsx"]);
    expect(normalizedPublishedStatePath("/Oklahoma")).toBe("/oklahoma");
    expect(normalizedPublishedStatePath("/oklahoma")).toBeNull();
    expect(normalizedPublishedStatePath("/oklahoma/tulsa")).toBeNull();
  });

  it("does not invent one senior census", () => {
    const nursing = interpretSeniorAskQuery("nursing homes in Oklahoma");
    expect(nursing.failReason).toContain("284");
    expect(nursing.failReason).toContain("288");
    expect(nursing.failReason).toContain("not added");
    const total = interpretSeniorAskQuery("how many senior facilities in Oklahoma");
    expect(total.failReason).toContain("659");
    expect(total.failReason).toContain("not a Trust Hub senior census");
    expect(interpretSeniorAskQuery("best nursing home in Oklahoma").failReason).toMatch(
      /does not rank/,
    );
    expect(interpretSeniorAskQuery("assisted living in Tulsa Oklahoma").failReason).toMatch(
      /geography only/,
    );
    expect(interpretOklahomaAsk("nursing home Tulsa")).toBeNull();
    expect(interpretOklahomaAsk("nursing homes in Missouri")).toBeNull();
    expect(interpretOklahomaAsk("nursing homes in Arkansas")).toBeNull();
    expect(interpretOklahomaAsk("nursing homes in Utah")).toBeNull();
    expect(interpretSeniorAskQuery("nursing homes in Mississippi").failReason).not.toContain("284");
  });
});
