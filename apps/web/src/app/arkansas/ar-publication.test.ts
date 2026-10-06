import { describe, expect, it } from "vitest";
import fs from "node:fs";
import snapshot from "@/data/arkansas-public-snapshot.json";
import { interpretArkansasAsk } from "@/server/care/ar-ask";
import { interpretSeniorAskQuery } from "@/server/care/senior-ask-parse";
import { normalizedPublishedStatePath } from "@/lib/published-state-path";

describe("Arkansas senior publication", () => {
  it("keeps the SFY 2022 classes off one another", () => {
    const narrative = snapshot.narrativeResidence;
    const icf = snapshot.icfIidDivision;
    const medicaid = snapshot.medicaidNursingClassification;
    expect(
      icf.stateOwnedHumanDevelopmentCenters +
        icf.privatePediatricFacilities +
        icf.adultFacilitiesFifteenBedsOrFewer,
    ).toBe(narrative.icfIid);
    expect(
      medicaid.publicFacilities +
        medicaid.privateUnderMedicaid +
        medicaid.additionalPrivateWithoutMedicaidFunding,
    ).not.toBe(narrative.nursingFacilities);
    expect(snapshot.combinedSeniorDenominator).toBeNull();
    expect(narrative.added).toBe(false);
    expect(narrative.isCurrentRoster).toBe(false);
    expect(medicaid.sameAsNarrativeNursingCount).toBe(false);
    expect(snapshot.surveys.surveyIsViolation).toBe(false);
    expect(snapshot.surveys.surveyIsFacilityCount).toBe(false);
    expect(snapshot.surveys.complaintSurveys).not.toBe(
      snapshot.complaints.nursingHomeComplaintsReceived,
    );
    expect(snapshot.complaints.addedToSurveys).toBe(false);
    expect(snapshot.page228LicenseTablePublished).toBe(false);
    expect(snapshot.cmsBridgeAttempted).toBe(false);
    expect(snapshot.graphWrites).toBe(0);
    expect(snapshot.newCanonicalFacilities).toBe(0);
    expect(snapshot.sha256).toBe(
      "4ef0ebd66e1d7abac127bad129e434b6c3e738075f48b6b597f6346577b591a2",
    );
  });

  it("publishes one statewide route", () => {
    const page = fs.readFileSync("src/app/arkansas/page.tsx", "utf8");
    const sitemap = fs.readFileSync("src/app/sitemaps/[file]/route.ts", "utf8");
    expect(page).toContain('canonicalUrl("/arkansas")');
    expect(page).toContain("NOT_ACQUIRED");
    expect(page).toContain("approximately");
    expect(page).not.toMatch(/AggregateRating|Trust Score|ratingValue/);
    expect(page).not.toMatch(/\/arkansas\/(?:little-rock|fayetteville|fort-smith)/);
    expect(sitemap.match(/"\/arkansas"/g)).toHaveLength(1);
    expect(sitemap).toContain('"/utah"');
    expect(fs.readdirSync("src/app/arkansas")).toEqual(["ar-publication.test.ts", "page.tsx"]);
    expect(normalizedPublishedStatePath("/Arkansas")).toBe("/arkansas");
    expect(normalizedPublishedStatePath("/arkansas")).toBeNull();
    expect(normalizedPublishedStatePath("/arkansas/little-rock")).toBeNull();
  });

  it("does not invent one senior census", () => {
    const nursing = interpretSeniorAskQuery("nursing homes in Arkansas");
    expect(nursing.failReason).toContain("approximately 224");
    expect(nursing.failReason).toContain("223");
    expect(nursing.failReason).toContain("not added");
    const total = interpretSeniorAskQuery("how many senior facilities in Arkansas");
    expect(total.failReason).toContain("cannot be combined");
    expect(total.failReason).toContain("40");
    expect(total.failReason).toContain("13");
    expect(interpretSeniorAskQuery("best nursing home in Arkansas").failReason).toMatch(
      /does not rank/,
    );
    expect(interpretSeniorAskQuery("assisted living in Little Rock Arkansas").failReason).toMatch(
      /NOT_ACQUIRED/,
    );
    expect(interpretSeniorAskQuery("assisted living in Little Rock Arkansas").failReason).toMatch(
      /geography only/,
    );
    expect(interpretSeniorAskQuery("home health in Arkansas").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretSeniorAskQuery("hospice in Arkansas").failReason).toMatch(/NOT_ACQUIRED/);
    expect(interpretSeniorAskQuery("nursing home complaints in Arkansas").failReason).toContain(
      "1,400",
    );
    expect(interpretSeniorAskQuery("nursing home surveys in Arkansas").failReason).toContain(
      "1,281",
    );
    expect(interpretArkansasAsk("nursing home Fayetteville")).toBeNull();
    expect(interpretArkansasAsk("nursing homes in Arizona")).toBeNull();
    expect(interpretArkansasAsk("nursing homes in Oklahoma")).toBeNull();
    expect(interpretArkansasAsk("nursing homes in Missouri")).toBeNull();
    expect(interpretArkansasAsk("nursing homes in Utah")).toBeNull();
    expect(interpretSeniorAskQuery("nursing homes in Oklahoma").failReason).not.toContain("224");
    expect(interpretSeniorAskQuery("nursing homes in Mississippi").failReason).not.toContain(
      "approximately 224",
    );
  });
});
