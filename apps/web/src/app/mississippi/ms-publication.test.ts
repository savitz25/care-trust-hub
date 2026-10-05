import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/mississippi-public-snapshot.json";
import { interpretMississippiAsk } from "@/server/care/ms-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Mississippi senior publication", () => {
  it("keeps directory classes separate", () => {
    expect(snapshot.personalCareAssistedLiving + snapshot.personalCareResidentialLiving).toBe(
      snapshot.personalCareHomes,
    );
    expect(snapshot.personalCareAlzheimerUnits + snapshot.personalCareHomes).not.toBe(
      snapshot.personalCareHomes,
    );
    expect(
      snapshot.homeHealthHospitalBased +
        snapshot.homeHealthMemphisBased +
        snapshot.homeHealthPrivateFreestanding,
    ).toBe(snapshot.homeHealthPartsSum);
    expect(snapshot.homeHealthPartsEqualTotal).toBe(false);
    expect(snapshot.homeHealthPartsSum).not.toBe(snapshot.homeHealthAgencies);
    expect(snapshot.nursingBedSum).toBeNull();
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(snapshot.otherClassesAreSeniorCensus).toBe(false);
    expect(snapshot.otherDirectoryClasses.comprehensiveOutpatientRehab).toBe(0);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.nameOnlyAdverseJoins).toBe(0);
    expect(snapshot.surveyCorpus).toBe("NOT_ACQUIRED");
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/mississippi/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/mississippi")');
    expect(page).toContain("209");
    expect(page).toContain("195");
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(/\/mississippi\/(?:jackson|gulfport|biloxi)/);
    expect(sitemap.match(/"\/mississippi"/g)).toHaveLength(1);
    expect(fs.readdirSync("src/app/mississippi")).toEqual(["ms-publication.test.ts", "page.tsx"]);
    expect(normalizedPublishedStatePath("/Mississippi")).toBe("/mississippi");
    expect(normalizedPublishedStatePath("/mississippi")).toBeNull();
    expect(normalizedPublishedStatePath("/mississippi/jackson")).toBeNull();
  });

  it("does not invent one senior census", () => {
    const nursing = interpretSeniorAskQuery("nursing homes in Mississippi");
    expect(nursing.failReason).toContain("209");
    expect(nursing.failReason).toContain("not added");
    const care = interpretSeniorAskQuery("personal care homes in Mississippi");
    expect(care.failReason).toContain("195");
    expect(care.failReason).toContain("not added");
    expect(interpretSeniorAskQuery("best nursing home in Mississippi").failReason).toMatch(
      /does not rank/,
    );
    expect(interpretSeniorAskQuery("nursing home Gulfport Mississippi").failReason).toMatch(
      /geography only/,
    );
    expect(interpretMississippiAsk("nursing home Jackson")).toBeNull();
    expect(interpretSeniorAskQuery("nursing homes in Kentucky").failReason).not.toContain("209");
    expect(interpretMississippiAsk("nursing homes in Missouri")).toBeNull();
    expect(interpretSeniorAskQuery("home health in ms").failReason).toContain("49");
  });
});
