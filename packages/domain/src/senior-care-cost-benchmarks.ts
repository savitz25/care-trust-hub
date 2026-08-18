export const COST_PLANNER_VERSION = "senior-care-cost-planner-v1";
export const WEEKS_PER_YEAR = 52;
export const WEEKS_PER_MONTH = WEEKS_PER_YEAR / 12;
export const DAYS_PER_YEAR = 365;
export const RETRIEVED_AT = "2026-08-18";

export const CARE_COST_SETTINGS = [
  "aging_at_home",
  "home_care",
  "home_health",
  "assisted_living",
  "memory_care",
  "skilled_nursing",
  "short_term_rehab",
] as const;

export type CareCostSetting = (typeof CARE_COST_SETTINGS)[number];

export interface CostSource {
  organization: string;
  title: string;
  url: string;
  publicationYear: number;
  retrievedAt: string;
  methodologyNote: string;
}

export interface CostBenchmark {
  setting: CareCostSetting;
  geography: "national";
  geographyLabel: string;
  unit: string;
  statistic: "median";
  value: number;
  source: CostSource;
}

export const CARESCOUT_2025: CostSource = {
  organization: "CareScout (Genworth Financial, Inc.)",
  title: "2025 Cost of Care Survey",
  url: "https://investor.genworth.com/news-events/press-releases/detail/1054/carescout-releases-2025-cost-of-care-survey-results",
  publicationYear: 2025,
  retrievedAt: RETRIEVED_AT,
  methodologyNote:
    "National median provider-reported rates collected July–November 2025. Not a 2026 price and not a facility-specific quote.",
};

export const CMS_MEDICARE_2026: CostSource = {
  organization: "Centers for Medicare & Medicaid Services",
  title: "2026 Medicare Parts A & B Premiums and Deductibles",
  url: "https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles",
  publicationYear: 2026,
  retrievedAt: RETRIEVED_AT,
  methodologyNote:
    "Official calendar-year 2026 Medicare Part A skilled-nursing cost-sharing amounts. These are program rules, not an individual coverage determination.",
};

export const MEDICARE_GOV_SNF_2026: CostSource = {
  organization: "Medicare.gov",
  title: "Skilled nursing facility care",
  url: "https://www.medicare.gov/coverage/skilled-nursing-facility-care",
  publicationYear: 2026,
  retrievedAt: RETRIEVED_AT,
  methodologyNote:
    "Official beneficiary cost-sharing description for Medicare-covered SNF stays in 2026. Eligibility is not determined by this planner.",
};

export const NATIONAL_HOME_CARE_HOURLY: CostBenchmark = {
  setting: "home_care",
  geography: "national",
  geographyLabel: "National benchmark",
  unit: "USD per hour",
  statistic: "median",
  value: 35,
  source: CARESCOUT_2025,
};

export const NATIONAL_PRIVATE_DUTY_NURSE_HOURLY: CostBenchmark = {
  setting: "home_health",
  geography: "national",
  geographyLabel: "National benchmark",
  unit: "USD per hour",
  statistic: "median",
  value: 90,
  source: {
    ...CARESCOUT_2025,
    methodologyNote:
      "CareScout 2025 median for private-duty nursing in the home. This is not Medicare home-health reimbursement and is not an eligibility determination.",
  },
};

export const NATIONAL_ADULT_DAY_DAILY: CostBenchmark = {
  setting: "aging_at_home",
  geography: "national",
  geographyLabel: "National benchmark",
  unit: "USD per day",
  statistic: "median",
  value: 95,
  source: CARESCOUT_2025,
};

export const NATIONAL_ASSISTED_LIVING_MONTHLY: CostBenchmark = {
  setting: "assisted_living",
  geography: "national",
  geographyLabel: "National benchmark",
  unit: "USD per month",
  statistic: "median",
  value: 6200,
  source: CARESCOUT_2025,
};

export const NATIONAL_SNF_SEMI_PRIVATE_DAILY: CostBenchmark = {
  setting: "skilled_nursing",
  geography: "national",
  geographyLabel: "National benchmark",
  unit: "USD per day",
  statistic: "median",
  value: 315,
  source: CARESCOUT_2025,
};

export const NATIONAL_SNF_PRIVATE_DAILY: CostBenchmark = {
  setting: "skilled_nursing",
  geography: "national",
  geographyLabel: "National benchmark",
  unit: "USD per day",
  statistic: "median",
  value: 355,
  source: CARESCOUT_2025,
};

export const MEDICARE_SNF_2026 = {
  partAInpatientDeductible: 1736,
  snfDays1to20BeneficiaryPays: 0,
  snfDays21to100DailyCoinsurance: 217,
  coveredDaysPerBenefitPeriod: 100,
  source: CMS_MEDICARE_2026,
  coverageSource: MEDICARE_GOV_SNF_2026,
} as const;

export const HIGH_HOME_CARE_WARNING =
  "A 24-hour or near-24-hour home-care plan is only a user-defined planning approximation. Actual agency billing is not simply one worker times 24 hours. Shift structure, overtime, live-in pricing, and state labor rules vary.";

export const HOME_HEALTH_CONTEXT =
  "Home health is intermittent licensed nursing or therapy, not the same as non-medical home care. Payer rules vary. This planner does not determine Medicare home-health eligibility or coverage.";

export const MEDICARE_SNF_CONTEXT =
  "Medicare may cover qualifying short-term skilled nursing facility care when program requirements are met. This planner does not determine whether any person is eligible or what that person will pay.";

export const MEMORY_CARE_CONTEXT =
  "The 2025 CareScout Cost of Care Survey does not publish a distinct national memory-care median. This planner will not invent a memory-care premium. Use a local quote or other custom monthly amount.";
