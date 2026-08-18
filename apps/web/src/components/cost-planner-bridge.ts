import type { CareSetting } from "@care/domain";

export const COST_PLANNER_PATH = "/tools/senior-care-cost-planner";
export const COST_PLANNER_SELECTION_KEY = "sth-cost-planner-v1-settings";

export const PLANNER_SCENARIOS = [
  "home_care",
  "assisted_living",
  "memory_care",
  "skilled_nursing",
  "short_term_rehab",
] as const;

export type PlannerScenarioId = (typeof PLANNER_SCENARIOS)[number];

const NAVIGATOR_TO_PLANNER: Record<CareSetting, PlannerScenarioId | null> = {
  aging_in_place: "home_care",
  home_care: "home_care",
  home_health: "home_care",
  assisted_living: "assisted_living",
  memory_care: "memory_care",
  skilled_nursing: "skilled_nursing",
  short_term_rehab: "short_term_rehab",
};

export function isPlannerScenarioId(value: string): value is PlannerScenarioId {
  return (PLANNER_SCENARIOS as readonly string[]).includes(value);
}

export function mapNavigatorSettingsToPlanner(
  settings: readonly CareSetting[],
): PlannerScenarioId[] {
  return [
    ...new Set(
      settings
        .map((setting) => NAVIGATOR_TO_PLANNER[setting])
        .filter((value): value is PlannerScenarioId => Boolean(value)),
    ),
  ];
}

export function storePlannerScenarios(ids: readonly PlannerScenarioId[]): void {
  sessionStorage.setItem(COST_PLANNER_SELECTION_KEY, JSON.stringify(ids));
}

export function readPlannerScenarios(): PlannerScenarioId[] {
  try {
    const raw = sessionStorage.getItem(COST_PLANNER_SELECTION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is PlannerScenarioId => isPlannerScenarioId(String(value)));
  } catch {
    return [];
  }
}
