import {
  COST_PLANNER_VERSION,
  DAYS_PER_YEAR,
  HIGH_HOME_CARE_WARNING,
  HOME_HEALTH_CONTEXT,
  MEDICARE_SNF_2026,
  MEDICARE_SNF_CONTEXT,
  MEMORY_CARE_CONTEXT,
  NATIONAL_ADULT_DAY_DAILY,
  NATIONAL_ASSISTED_LIVING_MONTHLY,
  NATIONAL_HOME_CARE_HOURLY,
  NATIONAL_PRIVATE_DUTY_NURSE_HOURLY,
  NATIONAL_SNF_PRIVATE_DAILY,
  NATIONAL_SNF_SEMI_PRIVATE_DAILY,
  WEEKS_PER_MONTH,
  WEEKS_PER_YEAR,
  type CareCostSetting,
  type CostBenchmark,
} from "./senior-care-cost-benchmarks";

export interface GeographyRequest {
  stateCode?: string;
  metro?: string;
}

export interface GeographyResolution {
  requested: string | null;
  used: "US";
  basis: string;
  fallbackApplied: boolean;
}

export interface BenchmarkUse {
  setting: CareCostSetting;
  sourceOrganization: string;
  sourceTitle: string;
  sourceUrl: string;
  publicationYear: number;
  unit: string;
  statistic: "median" | "none";
  publishedValue: number | null;
  valueUsed: number | null;
  customOverride: boolean;
}

export interface SupportOffsets {
  ltcInsuranceMonthly?: number;
  vaBenefitMonthly?: number;
  medicaidContributionMonthly?: number;
  familyContributionMonthly?: number;
  otherSupportMonthly?: number;
}

export interface HouseholdCosts {
  mortgageOrRentMonthly?: number;
  utilitiesMonthly?: number;
  propertyTaxMonthly?: number;
  groceriesMonthly?: number;
  maintenanceMonthly?: number;
}

export interface CustomLineItem {
  name: string;
  amount: number;
  cadence: "monthly" | "one_time";
}

export interface CostScenarioResult {
  version: typeof COST_PLANNER_VERSION;
  scenarioName: string;
  setting: CareCostSetting;
  geography: GeographyResolution;
  benchmark: BenchmarkUse;
  inputs: Record<string, number | string | boolean | null>;
  weekly: number | null;
  monthly: number;
  annual: number;
  oneTimeCosts: number;
  firstYearPlanningAmount: number;
  supportOffsetsMonthly: number;
  remainingPlanningAmount: number;
  remainingFirstYearPlanningAmount: number;
  householdCostsMonthly: number;
  warnings: string[];
  methodologyNotes: string[];
}

export function roundMoney(value: number): number {
  return Math.round(value);
}

export function resolveGeography(request: GeographyRequest = {}): GeographyResolution {
  const requested = request.metro?.trim() || request.stateCode?.trim().toUpperCase() || null;
  return {
    requested,
    used: "US",
    basis: requested
      ? `National benchmark. No published ${request.metro ? "metro" : "statewide"} median is stored in ${COST_PLANNER_VERSION}, so the lookup fell back to the national CareScout 2025 median.`
      : "National benchmark",
    fallbackApplied: Boolean(requested),
  };
}

function requireNonNegative(name: string, value: number | undefined): number {
  const amount = value ?? 0;
  if (!Number.isFinite(amount) || amount < 0) {
    throw new RangeError(`${name} must be a non-negative finite number.`);
  }
  return amount;
}

function requireHoursPerDay(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 24) {
    throw new RangeError("hoursPerDay must be between 0 and 24.");
  }
  return value;
}

function requireDaysPerWeek(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 7) {
    throw new RangeError("daysPerWeek must be between 0 and 7.");
  }
  return value;
}

export function sumSupportOffsets(offsets: SupportOffsets = {}): number {
  return (
    requireNonNegative("ltcInsuranceMonthly", offsets.ltcInsuranceMonthly) +
    requireNonNegative("vaBenefitMonthly", offsets.vaBenefitMonthly) +
    requireNonNegative("medicaidContributionMonthly", offsets.medicaidContributionMonthly) +
    requireNonNegative("familyContributionMonthly", offsets.familyContributionMonthly) +
    requireNonNegative("otherSupportMonthly", offsets.otherSupportMonthly)
  );
}

export function sumHouseholdCosts(household: HouseholdCosts = {}): number {
  return (
    requireNonNegative("mortgageOrRentMonthly", household.mortgageOrRentMonthly) +
    requireNonNegative("utilitiesMonthly", household.utilitiesMonthly) +
    requireNonNegative("propertyTaxMonthly", household.propertyTaxMonthly) +
    requireNonNegative("groceriesMonthly", household.groceriesMonthly) +
    requireNonNegative("maintenanceMonthly", household.maintenanceMonthly)
  );
}

function remaining(grossMonthly: number, offsetsMonthly: number): number {
  return Math.max(0, roundMoney(grossMonthly) - roundMoney(offsetsMonthly));
}

function useBenchmark(
  setting: CareCostSetting,
  benchmark: CostBenchmark | null,
  customValue: number | undefined,
): BenchmarkUse {
  if (customValue !== undefined) requireNonNegative("custom value", customValue);
  return {
    setting,
    sourceOrganization: benchmark?.source.organization ?? "User-entered planning amount",
    sourceTitle: benchmark?.source.title ?? "No published benchmark in this version",
    sourceUrl: benchmark?.source.url ?? "",
    publicationYear: benchmark?.source.publicationYear ?? 0,
    unit: benchmark?.unit ?? "USD",
    statistic: benchmark ? "median" : "none",
    publishedValue: benchmark?.value ?? null,
    valueUsed: customValue ?? benchmark?.value ?? null,
    customOverride: customValue !== undefined,
  };
}

function finish(input: {
  scenarioName: string;
  setting: CareCostSetting;
  geography: GeographyResolution;
  benchmark: BenchmarkUse;
  inputs: CostScenarioResult["inputs"];
  weekly: number | null;
  monthly: number;
  oneTimeCosts?: number;
  offsets?: SupportOffsets;
  household?: HouseholdCosts;
  warnings?: string[];
  methodologyNotes: string[];
}): CostScenarioResult {
  const monthly = roundMoney(input.monthly);
  const annual = roundMoney(monthly * 12);
  const oneTimeCosts = roundMoney(requireNonNegative("oneTimeCosts", input.oneTimeCosts));
  const supportOffsetsMonthly = roundMoney(sumSupportOffsets(input.offsets));
  const householdCostsMonthly = roundMoney(sumHouseholdCosts(input.household));
  const firstYearPlanningAmount = annual + oneTimeCosts;
  return {
    version: COST_PLANNER_VERSION,
    scenarioName: input.scenarioName,
    setting: input.setting,
    geography: input.geography,
    benchmark: input.benchmark,
    inputs: input.inputs,
    weekly: input.weekly == null ? null : roundMoney(input.weekly),
    monthly,
    annual,
    oneTimeCosts,
    firstYearPlanningAmount,
    supportOffsetsMonthly,
    remainingPlanningAmount: remaining(monthly, supportOffsetsMonthly),
    remainingFirstYearPlanningAmount: Math.max(
      0,
      firstYearPlanningAmount - supportOffsetsMonthly * 12,
    ),
    householdCostsMonthly,
    warnings: input.warnings ?? [],
    methodologyNotes: input.methodologyNotes,
  };
}

export function calculateHomeCare(input: {
  scenarioName?: string;
  hoursPerDay: number;
  daysPerWeek: number;
  customHourlyRate?: number;
  addOns?: CustomLineItem[];
  offsets?: SupportOffsets;
  household?: HouseholdCosts;
  geography?: GeographyRequest;
}): CostScenarioResult {
  const hoursPerDay = requireHoursPerDay(input.hoursPerDay);
  const daysPerWeek = requireDaysPerWeek(input.daysPerWeek);
  const geography = resolveGeography(input.geography);
  const benchmark = useBenchmark("home_care", NATIONAL_HOME_CARE_HOURLY, input.customHourlyRate);
  if (benchmark.valueUsed == null) throw new RangeError("A home-care hourly rate is required.");
  const weeklyHours = hoursPerDay * daysPerWeek;
  const weekly = weeklyHours * benchmark.valueUsed;
  const monthlyCare = weekly * WEEKS_PER_MONTH;
  const addOnMonthly = (input.addOns ?? [])
    .filter((item) => item.cadence === "monthly")
    .reduce((sum, item) => sum + requireNonNegative(item.name, item.amount), 0);
  const oneTimeCosts = (input.addOns ?? [])
    .filter((item) => item.cadence === "one_time")
    .reduce((sum, item) => sum + requireNonNegative(item.name, item.amount), 0);
  const warnings: string[] = [];
  if (hoursPerDay >= 16 || weeklyHours >= 112) warnings.push(HIGH_HOME_CARE_WARNING);
  return finish({
    scenarioName: input.scenarioName ?? "Home care",
    setting: "home_care",
    geography,
    benchmark,
    inputs: {
      hoursPerDay,
      daysPerWeek,
      weeklyHours,
      hourlyRateUsed: benchmark.valueUsed,
    },
    weekly,
    monthly: monthlyCare + addOnMonthly,
    oneTimeCosts,
    offsets: input.offsets,
    household: input.household,
    warnings,
    methodologyNotes: [
      `Weekly cost = hours/day × days/week × hourly rate. Monthly cost = weekly × (${WEEKS_PER_YEAR} / 12) = weekly × ${WEEKS_PER_MONTH}.`,
      `${NATIONAL_HOME_CARE_HOURLY.source.methodologyNote}`,
    ],
  });
}

export function calculateAssistedLiving(input: {
  scenarioName?: string;
  customMonthlyRate?: number;
  careAddonMonthly?: number;
  communityFeeOneTime?: number;
  offsets?: SupportOffsets;
  household?: HouseholdCosts;
  geography?: GeographyRequest;
}): CostScenarioResult {
  const geography = resolveGeography(input.geography);
  const benchmark = useBenchmark(
    "assisted_living",
    NATIONAL_ASSISTED_LIVING_MONTHLY,
    input.customMonthlyRate,
  );
  if (benchmark.valueUsed == null)
    throw new RangeError("An assisted-living monthly rate is required.");
  const careAddonMonthly = requireNonNegative("careAddonMonthly", input.careAddonMonthly);
  return finish({
    scenarioName: input.scenarioName ?? "Assisted living",
    setting: "assisted_living",
    geography,
    benchmark,
    inputs: {
      monthlyBaseUsed: benchmark.valueUsed,
      careAddonMonthly,
    },
    weekly: null,
    monthly: benchmark.valueUsed + careAddonMonthly,
    oneTimeCosts: requireNonNegative("communityFeeOneTime", input.communityFeeOneTime),
    offsets: input.offsets,
    household: input.household,
    methodologyNotes: [
      "Monthly total = published or custom monthly base + optional care/service add-on. Annual total = monthly × 12. One-time community fees are kept separate.",
      NATIONAL_ASSISTED_LIVING_MONTHLY.source.methodologyNote,
    ],
  });
}

export function calculateMemoryCare(input: {
  scenarioName?: string;
  customMonthlyRate?: number;
  careAddonMonthly?: number;
  communityFeeOneTime?: number;
  offsets?: SupportOffsets;
  household?: HouseholdCosts;
  geography?: GeographyRequest;
}): CostScenarioResult {
  if (input.customMonthlyRate === undefined) {
    throw new RangeError(
      "Memory care requires a custom monthly amount because no distinct published national memory-care median is included in this version.",
    );
  }
  const geography = resolveGeography(input.geography);
  const benchmark = useBenchmark("memory_care", null, input.customMonthlyRate);
  const careAddonMonthly = requireNonNegative("careAddonMonthly", input.careAddonMonthly);
  return finish({
    scenarioName: input.scenarioName ?? "Memory care",
    setting: "memory_care",
    geography,
    benchmark,
    inputs: {
      monthlyBaseUsed: benchmark.valueUsed,
      careAddonMonthly,
    },
    weekly: null,
    monthly: (benchmark.valueUsed ?? 0) + careAddonMonthly,
    oneTimeCosts: requireNonNegative("communityFeeOneTime", input.communityFeeOneTime),
    offsets: input.offsets,
    household: input.household,
    methodologyNotes: [MEMORY_CARE_CONTEXT],
  });
}

export function calculateSkilledNursing(input: {
  scenarioName?: string;
  room: "semi_private" | "private";
  customDailyRate?: number;
  offsets?: SupportOffsets;
  household?: HouseholdCosts;
  geography?: GeographyRequest;
}): CostScenarioResult {
  const published =
    input.room === "private" ? NATIONAL_SNF_PRIVATE_DAILY : NATIONAL_SNF_SEMI_PRIVATE_DAILY;
  const geography = resolveGeography(input.geography);
  const benchmark = useBenchmark("skilled_nursing", published, input.customDailyRate);
  if (benchmark.valueUsed == null)
    throw new RangeError("A skilled-nursing daily rate is required.");
  const daily = benchmark.valueUsed;
  return finish({
    scenarioName: input.scenarioName ?? `Skilled nursing (${input.room.replace("_", " ")})`,
    setting: "skilled_nursing",
    geography,
    benchmark,
    inputs: {
      room: input.room,
      dailyRateUsed: daily,
    },
    weekly: daily * 7,
    monthly: daily * (DAYS_PER_YEAR / 12),
    offsets: input.offsets,
    household: input.household,
    methodologyNotes: [
      `Monthly equivalent = daily rate × (${DAYS_PER_YEAR} / 12). Annual equivalent = daily rate × ${DAYS_PER_YEAR}. These are private-pay planning medians, not SeniorTrustHub facility-specific rates.`,
      published.source.methodologyNote,
    ],
  });
}

export function calculateShortTermRehab(input: {
  scenarioName?: string;
  planningDays?: number;
  expectedOutOfPocket?: number;
  offsets?: SupportOffsets;
  geography?: GeographyRequest;
}): CostScenarioResult {
  const planningDays = requireNonNegative("planningDays", input.planningDays);
  if (planningDays > 365) throw new RangeError("planningDays must be 365 or fewer.");
  const expectedOutOfPocket = requireNonNegative("expectedOutOfPocket", input.expectedOutOfPocket);
  const geography = resolveGeography(input.geography);
  return finish({
    scenarioName: input.scenarioName ?? "Short-term skilled rehabilitation",
    setting: "short_term_rehab",
    geography,
    benchmark: {
      setting: "short_term_rehab",
      sourceOrganization: MEDICARE_SNF_2026.source.organization,
      sourceTitle: MEDICARE_SNF_2026.source.title,
      sourceUrl: MEDICARE_SNF_2026.source.url,
      publicationYear: MEDICARE_SNF_2026.source.publicationYear,
      unit: "USD planning context",
      statistic: "none",
      publishedValue: MEDICARE_SNF_2026.snfDays21to100DailyCoinsurance,
      valueUsed: expectedOutOfPocket,
      customOverride: input.expectedOutOfPocket !== undefined,
    },
    inputs: {
      planningDays,
      expectedOutOfPocket,
      medicareSnfDays21to100DailyCoinsurance: MEDICARE_SNF_2026.snfDays21to100DailyCoinsurance,
      medicarePartADeductible: MEDICARE_SNF_2026.partAInpatientDeductible,
    },
    weekly: null,
    monthly: expectedOutOfPocket,
    offsets: input.offsets,
    warnings: [
      MEDICARE_SNF_CONTEXT,
      "Short-term rehabilitation is not the same as long-term private-pay nursing-home care. This planner does not calculate what Medicare will pay an individual.",
    ],
    methodologyNotes: [
      `CMS published 2026 SNF coinsurance of $${MEDICARE_SNF_2026.snfDays21to100DailyCoinsurance} per day for days 21–100 of a qualifying stay, $0 for days 1–20 after the Part A deductible of $${MEDICARE_SNF_2026.partAInpatientDeductible} when it applies, and no Part A SNF coverage after day ${MEDICARE_SNF_2026.coveredDaysPerBenefitPeriod} in a benefit period.`,
      MEDICARE_SNF_2026.source.methodologyNote,
    ],
  });
}

export function calculateHomeHealth(input: {
  scenarioName?: string;
  expectedMonthlyOutOfPocket?: number;
  customHourlyRate?: number;
  hoursPerMonth?: number;
  offsets?: SupportOffsets;
  geography?: GeographyRequest;
}): CostScenarioResult {
  const hoursPerMonth = requireNonNegative("hoursPerMonth", input.hoursPerMonth);
  const geography = resolveGeography(input.geography);
  const privateDuty = useBenchmark(
    "home_health",
    NATIONAL_PRIVATE_DUTY_NURSE_HOURLY,
    input.customHourlyRate,
  );
  const fromHours =
    hoursPerMonth > 0 && privateDuty.valueUsed != null ? hoursPerMonth * privateDuty.valueUsed : 0;
  const expected = input.expectedMonthlyOutOfPocket;
  if (expected !== undefined) requireNonNegative("expectedMonthlyOutOfPocket", expected);
  const monthly = expected ?? fromHours;
  if (expected === undefined && hoursPerMonth === 0) {
    throw new RangeError(
      "Enter an expected monthly out-of-pocket amount or planned private-duty hours.",
    );
  }
  return finish({
    scenarioName: input.scenarioName ?? "Home health",
    setting: "home_health",
    geography,
    benchmark: {
      ...privateDuty,
      valueUsed: expected ?? privateDuty.valueUsed,
      customOverride: expected !== undefined || privateDuty.customOverride,
    },
    inputs: {
      hoursPerMonth,
      expectedMonthlyOutOfPocket: expected ?? null,
    },
    weekly: null,
    monthly,
    offsets: input.offsets,
    warnings: [HOME_HEALTH_CONTEXT],
    methodologyNotes: [
      "If the family enters an expected out-of-pocket amount, that amount is used. A private-duty hourly median may be used only as an optional planning approximation and is not Medicare home health.",
      NATIONAL_PRIVATE_DUTY_NURSE_HOURLY.source.methodologyNote,
    ],
  });
}

export function calculateAgingAtHome(input: {
  scenarioName?: string;
  items?: CustomLineItem[];
  includeAdultDayDaysPerWeek?: number;
  customAdultDayDailyRate?: number;
  offsets?: SupportOffsets;
  household?: HouseholdCosts;
  geography?: GeographyRequest;
}): CostScenarioResult {
  const geography = resolveGeography(input.geography);
  const items = input.items ?? [];
  const monthlyItems = items
    .filter((item) => item.cadence === "monthly")
    .reduce((sum, item) => sum + requireNonNegative(item.name, item.amount), 0);
  const oneTimeCosts = items
    .filter((item) => item.cadence === "one_time")
    .reduce((sum, item) => sum + requireNonNegative(item.name, item.amount), 0);
  let adultDayMonthly = 0;
  if (input.includeAdultDayDaysPerWeek !== undefined) {
    const days = requireDaysPerWeek(input.includeAdultDayDaysPerWeek);
    const daily = useBenchmark(
      "aging_at_home",
      NATIONAL_ADULT_DAY_DAILY,
      input.customAdultDayDailyRate,
    );
    adultDayMonthly = (daily.valueUsed ?? 0) * days * WEEKS_PER_MONTH;
  }
  return finish({
    scenarioName: input.scenarioName ?? "Aging at home",
    setting: "aging_at_home",
    geography,
    benchmark: useBenchmark(
      "aging_at_home",
      input.includeAdultDayDaysPerWeek === undefined ? null : NATIONAL_ADULT_DAY_DAILY,
      input.customAdultDayDailyRate,
    ),
    inputs: {
      itemCount: items.length,
      adultDayDaysPerWeek: input.includeAdultDayDaysPerWeek ?? 0,
    },
    weekly: null,
    monthly: monthlyItems + adultDayMonthly,
    oneTimeCosts,
    offsets: input.offsets,
    household: input.household,
    methodologyNotes: [
      "Aging-at-home extras such as meals, transportation, housekeeping, medical alert, and home modifications are user-entered unless a published adult-day median is explicitly included.",
      "Residential care does not automatically eliminate household expenses. Mortgage, utilities, taxes, groceries, and maintenance remain user-entered when compared.",
    ],
  });
}

export function calculateBreakEvenHomeCareHours(input: {
  assistedLivingMonthly?: number;
  homeCareHourlyRate?: number;
  geography?: GeographyRequest;
}): {
  hoursPerWeek: number;
  assistedLivingMonthly: number;
  homeCareHourlyRate: number;
  formula: string;
  geography: GeographyResolution;
  note: string;
} {
  const geography = resolveGeography(input.geography);
  const assistedLivingMonthly =
    input.assistedLivingMonthly ?? NATIONAL_ASSISTED_LIVING_MONTHLY.value;
  const homeCareHourlyRate = input.homeCareHourlyRate ?? NATIONAL_HOME_CARE_HOURLY.value;
  requireNonNegative("assistedLivingMonthly", assistedLivingMonthly);
  requireNonNegative("homeCareHourlyRate", homeCareHourlyRate);
  if (homeCareHourlyRate === 0) {
    throw new RangeError("homeCareHourlyRate must be greater than 0 to calculate a break-even.");
  }
  const hoursPerWeek = assistedLivingMonthly / (homeCareHourlyRate * WEEKS_PER_MONTH);
  return {
    hoursPerWeek: Math.round(hoursPerWeek * 10) / 10,
    assistedLivingMonthly,
    homeCareHourlyRate,
    formula: "hours/week = assisted-living monthly benchmark ÷ (home-care hourly rate × (52 / 12))",
    geography,
    note: "This is a planning comparison at the assumptions entered. It does not mean assisted living is the correct care setting.",
  };
}

export function compareScenarioCosts(results: readonly CostScenarioResult[]): Array<{
  scenarioName: string;
  setting: CareCostSetting;
  monthly: number;
  annual: number;
  remainingPlanningAmount: number;
}> {
  return results.map((result) => ({
    scenarioName: result.scenarioName,
    setting: result.setting,
    monthly: result.monthly,
    annual: result.annual,
    remainingPlanningAmount: result.remainingPlanningAmount,
  }));
}
