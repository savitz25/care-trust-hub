import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADL_ASSISTANCE_PERSONA,
  CARE_NEEDS_NAVIGATOR_VERSION,
  HIGH_NEEDS_HOME_SUPPORT_PERSONA,
  INDEPENDENT_PERSONA,
  MEMORY_SAFETY_PERSONA,
  POST_HOSPITAL_REHAB_PERSONA,
  SKILLED_MEDICAL_PERSONA,
  UNCERTAIN_PERSONA,
  evaluateCareNeeds,
  resultHasSetting,
} from "./care-needs-navigator";

describe("care needs navigator v1", () => {
  it("has no Google Places or paid enrichment dependency", () => {
    const source = readFileSync(new URL("./care-needs-navigator.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/google|places text search|place details|GOOGLE_PLACES/i);
    expect(CARE_NEEDS_NAVIGATOR_VERSION).toBe("care-needs-navigator-v1");
  });

  it("does not invent a proprietary care score", () => {
    const result = evaluateCareNeeds(INDEPENDENT_PERSONA);
    expect(JSON.stringify(result)).not.toMatch(/Care Needs Score|Placement Score|96% match/i);
  });

  it("persona A: independent older adult points to aging in place", () => {
    const result = evaluateCareNeeds(INDEPENDENT_PERSONA);
    expect(resultHasSetting(result, "aging_in_place")).toBe(true);
    expect(resultHasSetting(result, "skilled_nursing")).toBe(false);
    expect(result.limitedCertainty).toBe(false);
  });

  it("persona B: ADL assistance points to home care and/or assisted living", () => {
    const result = evaluateCareNeeds(ADL_ASSISTANCE_PERSONA);
    expect(resultHasSetting(result, "home_care")).toBe(true);
    expect(resultHasSetting(result, "assisted_living")).toBe(true);
    expect(resultHasSetting(result, "skilled_nursing")).toBe(false);
    const assisted = result.recommendations.find((item) => item.setting === "assisted_living");
    expect(assisted?.nextActionHref).toBeNull();
    expect(assisted?.coverageNote).toMatch(/not assisted living/i);
  });

  it("persona C: memory and safety uses non-diagnostic memory-supportive language", () => {
    const result = evaluateCareNeeds(MEMORY_SAFETY_PERSONA);
    expect(resultHasSetting(result, "memory_care")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(/this person has dementia|requires memory care/i);
    expect(JSON.stringify(result)).toMatch(/Memory-supportive care/i);
    const memory = result.recommendations.find((item) => item.setting === "memory_care");
    expect(memory?.nextActionHref).toBeNull();
  });

  it("persona D: skilled medical needs make skilled nursing worth investigating", () => {
    const result = evaluateCareNeeds(SKILLED_MEDICAL_PERSONA);
    expect(resultHasSetting(result, "skilled_nursing")).toBe(true);
    expect(result.showSkilledNursingBridge).toBe(true);
    const snf = result.recommendations.find((item) => item.setting === "skilled_nursing");
    expect(snf?.why.length).toBeGreaterThan(1);
    expect(snf?.nextActionHref).toBe("/search");
    expect(JSON.stringify(result)).not.toMatch(/clinically indicated|is medically necessary/i);
  });

  it("persona E: post-hospital therapy supports short-term rehab, not automatic long-term placement", () => {
    const result = evaluateCareNeeds(POST_HOSPITAL_REHAB_PERSONA);
    expect(resultHasSetting(result, "short_term_rehab")).toBe(true);
    expect(result.alternatives.join(" ")).toMatch(/not automatically a long-term/i);
    expect(result.showSkilledNursingBridge).toBe(true);
  });

  it("persona F: high needs with strong home support keeps home options open", () => {
    const result = evaluateCareNeeds(HIGH_NEEDS_HOME_SUPPORT_PERSONA);
    expect(
      resultHasSetting(result, "home_care", [
        "strongly_worth_investigating",
        "may_be_appropriate",
        "could_remain_an_option",
      ]) ||
        resultHasSetting(result, "home_health", [
          "strongly_worth_investigating",
          "may_be_appropriate",
          "could_remain_an_option",
        ]),
    ).toBe(true);
    expect(
      resultHasSetting(result, "skilled_nursing", [
        "strongly_worth_investigating",
        "may_be_appropriate",
        "could_remain_an_option",
      ]),
    ).toBe(true);
    expect(result.alternatives.join(" ")).toMatch(/Remaining at home may still be possible/i);
  });

  it("persona G: uncertain answers do not overstate certainty or treat not sure as yes", () => {
    const result = evaluateCareNeeds(UNCERTAIN_PERSONA);
    expect(result.limitedCertainty).toBe(true);
    expect(result.summary).toMatch(/not sure|cautious|professional/i);
    expect(
      result.recommendations.some((item) => item.alignment === "strongly_worth_investigating"),
    ).toBe(false);
    expect(result.profile.clinicalNeeds).toBe("uncertain");
    expect(result.profile.urgentSafetyConcern).toBe(false);
  });

  it("does not recommend skilled nursing from a single weak ADL signal", () => {
    const result = evaluateCareNeeds({
      ...INDEPENDENT_PERSONA,
      bathing: "some_help",
    });
    expect(resultHasSetting(result, "skilled_nursing")).toBe(false);
  });

  it("does not treat hospitalization alone as inpatient rehab", () => {
    const result = evaluateCareNeeds({
      ...INDEPENDENT_PERSONA,
      recentRecovery: "yes",
      therapyNeeds: "none",
    });
    expect(resultHasSetting(result, "short_term_rehab")).toBe(false);
  });

  it("surfaces urgent safety guidance without a normal-only facility answer", () => {
    const result = evaluateCareNeeds({
      ...MEMORY_SAFETY_PERSONA,
      immediateSafety: "immediate_concern",
    });
    expect(result.urgentSafetyMessage).toMatch(/immediate danger/i);
    expect(result.showSkilledNursingBridge).toBeDefined();
  });
});
