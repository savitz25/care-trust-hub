import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COST_PLANNER_VERSION,
  HIGH_HOME_CARE_WARNING,
  MEDICARE_SNF_2026,
  WEEKS_PER_MONTH,
  WEEKS_PER_YEAR,
} from "./senior-care-cost-benchmarks";
import {
  calculateAgingAtHome,
  calculateAssistedLiving,
  calculateBreakEvenHomeCareHours,
  calculateHomeCare,
  calculateHomeHealth,
  calculateMemoryCare,
  calculateShortTermRehab,
  calculateSkilledNursing,
  compareScenarioCosts,
  resolveGeography,
  roundMoney,
} from "./senior-care-cost-planner";

describe("senior care cost planner v1", () => {
  it("uses 52 / 12 weeks per month and reconstructable home-care math", () => {
    expect(WEEKS_PER_MONTH).toBe(WEEKS_PER_YEAR / 12);
    expect(WEEKS_PER_MONTH).toBeCloseTo(4.333, 3);
    const result = calculateHomeCare({
      scenarioName: "A",
      hoursPerDay: 4,
      daysPerWeek: 3,
    });
    expect(result.inputs.weeklyHours).toBe(12);
    expect(result.inputs.hourlyRateUsed).toBe(35);
    expect(result.weekly).toBe(420);
    expect(result.monthly).toBe(roundMoney(420 * (52 / 12)));
    expect(result.annual).toBe(result.monthly * 12);
    expect(result.benchmark.publicationYear).toBe(2025);
    expect(result.benchmark.publishedValue).toBe(35);
    expect(result.version).toBe(COST_PLANNER_VERSION);
  });

  it("persona B: 8 hours/day × 7 days/week home care", () => {
    const result = calculateHomeCare({ hoursPerDay: 8, daysPerWeek: 7 });
    expect(result.weekly).toBe(1960);
    expect(result.monthly).toBe(roundMoney(1960 * (52 / 12)));
    expect(result.warnings).toHaveLength(0);
  });

  it("persona C: 24-hour planning includes a labor-structure warning", () => {
    const result = calculateHomeCare({ hoursPerDay: 24, daysPerWeek: 7 });
    expect(result.inputs.weeklyHours).toBe(168);
    expect(result.warnings.join(" ")).toBe(HIGH_HOME_CARE_WARNING);
    expect(result.warnings.join(" ")).toMatch(/not simply one worker/i);
  });

  it("persona D: assisted living plus care add-on and one-time fee", () => {
    const result = calculateAssistedLiving({
      careAddonMonthly: 800,
      communityFeeOneTime: 4000,
    });
    expect(result.benchmark.publishedValue).toBe(6200);
    expect(result.monthly).toBe(7000);
    expect(result.annual).toBe(84000);
    expect(result.oneTimeCosts).toBe(4000);
    expect(result.firstYearPlanningAmount).toBe(88000);
  });

  it("persona E: memory care uses an explicit custom amount and no invented premium", () => {
    expect(() => calculateMemoryCare({})).toThrow(/custom monthly/i);
    const result = calculateMemoryCare({ customMonthlyRate: 8500 });
    expect(result.monthly).toBe(8500);
    expect(result.benchmark.publishedValue).toBeNull();
    expect(result.benchmark.customOverride).toBe(true);
    expect(result.methodologyNotes.join(" ")).not.toMatch(/plus \d+%|hidden premium/i);
    expect(result.methodologyNotes.join(" ")).toMatch(/will not invent a memory-care premium/i);
  });

  it("persona F: skilled nursing private and semi-private daily conversions", () => {
    const semi = calculateSkilledNursing({ room: "semi_private" });
    const privateRoom = calculateSkilledNursing({ room: "private" });
    expect(semi.benchmark.publishedValue).toBe(315);
    expect(privateRoom.benchmark.publishedValue).toBe(355);
    expect(semi.weekly).toBe(315 * 7);
    expect(semi.monthly).toBe(roundMoney((315 * 365) / 12));
    expect(semi.annual).toBe(semi.monthly * 12);
    expect(privateRoom.monthly).toBeGreaterThan(semi.monthly);
    expect(semi.methodologyNotes.join(" ")).toMatch(/not SeniorTrustHub facility-specific/i);
  });

  it("persona G: short-term rehab keeps Medicare as context, not an individual payment", () => {
    const result = calculateShortTermRehab({ planningDays: 21, expectedOutOfPocket: 217 });
    expect(result.benchmark.publicationYear).toBe(2026);
    expect(result.inputs.medicareSnfDays21to100DailyCoinsurance).toBe(
      MEDICARE_SNF_2026.snfDays21to100DailyCoinsurance,
    );
    expect(JSON.stringify(result)).not.toMatch(/Medicare will pay \$/i);
    expect(result.warnings.join(" ")).toMatch(/does not determine whether any person is eligible/i);
  });

  it("persona H: LTC insurance offset floors remaining amount at zero", () => {
    const result = calculateAssistedLiving({
      offsets: { ltcInsuranceMonthly: 10000 },
    });
    expect(result.monthly).toBe(6200);
    expect(result.supportOffsetsMonthly).toBe(10000);
    expect(result.remainingPlanningAmount).toBe(0);
    expect(result.remainingFirstYearPlanningAmount).toBe(0);
  });

  it("persona I: multi-scenario comparison returns the calculated values", () => {
    const rows = compareScenarioCosts([
      calculateHomeCare({ scenarioName: "Home 12h/week", hoursPerDay: 4, daysPerWeek: 3 }),
      calculateAssistedLiving({ scenarioName: "Assisted living" }),
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.monthly).toBe(roundMoney(420 * (52 / 12)));
    expect(rows[1]?.monthly).toBe(6200);
  });

  it("persona J: requested state geography falls back to the national benchmark", () => {
    const geography = resolveGeography({ stateCode: "NJ" });
    expect(geography.fallbackApplied).toBe(true);
    expect(geography.used).toBe("US");
    expect(geography.basis).toMatch(/National/i);
    const result = calculateHomeCare({
      hoursPerDay: 4,
      daysPerWeek: 3,
      geography: { stateCode: "ny" },
    });
    expect(result.geography.requested).toBe("NY");
    expect(result.geography.fallbackApplied).toBe(true);
    expect(result.benchmark.publishedValue).toBe(35);
  });

  it("applies custom overrides while preserving the published benchmark", () => {
    const result = calculateHomeCare({
      hoursPerDay: 6,
      daysPerWeek: 5,
      customHourlyRate: 32,
    });
    expect(result.weekly).toBe(6 * 5 * 32);
    expect(result.benchmark.publishedValue).toBe(35);
    expect(result.benchmark.valueUsed).toBe(32);
    expect(result.benchmark.customOverride).toBe(true);
  });

  it("includes recurring add-ons and one-time aging-at-home items without inventing extras", () => {
    const result = calculateAgingAtHome({
      items: [
        { name: "Meals", amount: 400, cadence: "monthly" },
        { name: "Ramp", amount: 2500, cadence: "one_time" },
      ],
      household: { mortgageOrRentMonthly: 1800, utilitiesMonthly: 200 },
    });
    expect(result.monthly).toBe(400);
    expect(result.oneTimeCosts).toBe(2500);
    expect(result.householdCostsMonthly).toBe(2000);
    expect(result.benchmark.publishedValue).toBeNull();
  });

  it("calculates a transparent home-care vs assisted-living break-even", () => {
    const result = calculateBreakEvenHomeCareHours({});
    expect(result.hoursPerWeek).toBe(Math.round((6200 / (35 * (52 / 12))) * 10) / 10);
    expect(result.formula).toMatch(/52 \/ 12/);
    expect(result.note).toMatch(/does not mean assisted living is the correct care setting/i);
  });

  it("rejects impossible hours, days, and negative money", () => {
    expect(() => calculateHomeCare({ hoursPerDay: 25, daysPerWeek: 3 })).toThrow(RangeError);
    expect(() => calculateHomeCare({ hoursPerDay: 4, daysPerWeek: 8 })).toThrow(RangeError);
    expect(() => calculateAssistedLiving({ careAddonMonthly: -1 })).toThrow(RangeError);
    expect(() => calculateAssistedLiving({ offsets: { familyContributionMonthly: -50 } })).toThrow(
      RangeError,
    );
  });

  it("does not determine payer eligibility, recommend a setting, or call Google", () => {
    const source = [
      readFileSync(new URL("./senior-care-cost-planner.ts", import.meta.url), "utf8"),
      readFileSync(new URL("./senior-care-cost-benchmarks.ts", import.meta.url), "utf8"),
    ].join("\n");
    expect(source).not.toMatch(/google|GOOGLE_PLACES|place details|text search/i);
    expect(source).not.toMatch(/you are eligible for Medicaid|Medicare will pay \$/i);
    const rehab = calculateShortTermRehab({ expectedOutOfPocket: 0 });
    const homeHealth = calculateHomeHealth({ expectedMonthlyOutOfPocket: 200 });
    expect(JSON.stringify({ rehab, homeHealth })).not.toMatch(
      /you are eligible|medically necessary|correct care setting/i,
    );
    expect(homeHealth.warnings.join(" ")).toMatch(
      /does not determine Medicare home-health eligibility/i,
    );
    expect(rehab.benchmark.publicationYear).toBe(2026);
    expect(calculateAssistedLiving({}).benchmark.publicationYear).toBe(2025);
  });
});
