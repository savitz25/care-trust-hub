import { interpretSeniorAskQuery } from "./senior-ask-parse";
import {
  ASK_INPUT_LIMIT,
  validateSeniorResearchQuery,
  type SeniorResearchQuery,
} from "./senior-ask-contract";
import { LOCATION_MEANING, validState } from "./senior-location";

export type SeniorRequestParams = Record<string, string | string[] | undefined>;
export const SENIOR_FILTER_KEYS = ["class", "state", "evidence", "stars", "broaden"] as const;
const metrics: Record<string, string> = {
  deficiencies: "deficiency_count",
  penalties: "penalty",
  staffing: "staffing_hprd",
  chow: "chow",
  hhcahps: "hh_hhcahps",
  hospice_cahps: "hospice_cahps",
};

export function seniorRequestParams(params: URLSearchParams): SeniorRequestParams {
  return Object.fromEntries(
    [...new Set(params.keys())].map((key) => [
      key,
      params.getAll(key).length > 1 ? params.getAll(key) : params.get(key)!,
    ]),
  );
}

export function planSeniorRequest(input: SeniorRequestParams): {
  raw: string;
  query: SeniorResearchQuery;
} {
  const raw = typeof input.q === "string" ? input.q.trim() : "";
  const invalid = (reason: string) => ({
    raw,
    query: {
      mode: "fail_closed" as const,
      page: 1,
      terminalState: "INVALID_INPUT" as const,
      failReason: reason,
    },
  });
  if (Object.values(input).some((v) => v !== undefined && typeof v !== "string"))
    return invalid("Each research parameter must be supplied once.");
  if (!raw || raw.length > ASK_INPUT_LIMIT || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(raw))
    return invalid("Enter a research question of at most 180 characters.");
  if (Object.keys(input).some((k) => !["q", "page", ...SENIOR_FILTER_KEYS].includes(k)))
    return invalid("The request contains an unsupported parameter.");
  const pageText = input.page || "1";
  if (!/^\d+$/.test(String(pageText)) || Number(pageText) < 1 || Number(pageText) > 500)
    return invalid("Page must be an integer from 1 through 500.");
  let query = interpretSeniorAskQuery(raw, Number(pageText));
  const overrides = Object.fromEntries(
    SENIOR_FILTER_KEYS.filter((k) => input[k]).map((k) => [k, input[k] as string]),
  );
  query = { ...query, inputOverrides: overrides };
  const conflict = (reason: string) => ({
    raw,
    query: {
      ...query,
      mode: "fail_closed" as const,
      terminalState: "NEEDS_CLARIFICATION" as const,
      failReason: reason,
      alternatives: [],
    },
  });
  if (overrides.class) {
    if (!["nursing_home", "home_health", "hospice"].includes(overrides.class))
      return invalid("Choose a supported CMS provider class.");
    if (query.providerClass && query.providerClass !== overrides.class)
      return conflict(
        "The selected provider class conflicts with the question. Edit the question or the class filter; no class was substituted.",
      );
    query.providerClass = overrides.class as SeniorResearchQuery["providerClass"];
  }
  if (overrides.state) {
    if (!validState(overrides.state)) return invalid("Choose a valid recorded state.");
    const geo = query.geography;
    if (geo?.state && geo.state !== overrides.state)
      return conflict(
        "The selected state conflicts with the explicit city/county and state. Correct the location; it has not been broadened.",
      );
    if (geo && geo.type !== "state") {
      query.geography = { ...geo, state: overrides.state };
      if (
        query.locationRequirement?.outcome === "NEEDS_CLARIFICATION" &&
        query.modeBeforeClarification &&
        query.modeBeforeClarification !== "fail_closed"
      ) {
        query = {
          ...query,
          mode: query.modeBeforeClarification,
          terminalState: undefined,
          failReason: undefined,
          alternatives: undefined,
          locationRequirement: {
            ...query.locationRequirement,
            outcome: "APPLIED",
            reason: "State explicitly selected.",
          },
        };
      }
    } else query.geography = { type: "state", value: overrides.state, meaning: LOCATION_MEANING };
  }
  if (overrides.broaden) {
    if (overrides.broaden !== "state" || !query.geography?.state)
      return invalid("A broader state search requires an explicit city/state scope.");
    query = {
      ...query,
      geography: { type: "state", value: query.geography.state, meaning: LOCATION_MEANING },
      locationRequirement: {
        raw: query.locationRequirement?.raw ?? raw,
        outcome: "USER_APPROVED_RELAXATION",
        reason: "You selected a search across the recorded state instead of the city.",
      },
    };
  }
  if (overrides.evidence) {
    const metric = metrics[overrides.evidence];
    if (!metric) return invalid("Choose a supported evidence filter.");
    const expected =
      metric === "hh_hhcahps"
        ? "home_health"
        : metric === "hospice_cahps"
          ? "hospice"
          : "nursing_home";
    if (query.providerClass !== expected)
      return conflict(
        "This evidence filter belongs to another CMS provider class. Change the filter; the class and location were retained.",
      );
    query.metric = metric;
    if (query.mode === "count" && query.providerClass === "nursing_home")
      return conflict(
        "The requested evidence-specific count is not supported. The evidence filter was retained; no unfiltered count was substituted.",
      );
  }
  if (overrides.stars) {
    const fields = {
      "5_overall": "overallStars",
      "5_staffing": "staffingStars",
      "5_inspection": "inspectionStars",
    } as const;
    if (!Object.hasOwn(fields, overrides.stars))
      return invalid("Choose a supported CMS rating filter.");
    if (query.providerClass !== "nursing_home")
      return conflict("These overall/staffing/inspection ratings apply only to nursing homes.");
    query.qualityFilters = {
      ...query.qualityFilters,
      [fields[overrides.stars as keyof typeof fields]]: [5],
    };
  }
  return { raw, query: validateSeniorResearchQuery(query) };
}

export function seniorRequestHref(
  raw: string,
  overrides: Record<string, string> = {},
  extra: Record<string, string> = {},
): string {
  return `/ask?${new URLSearchParams({ q: raw, ...overrides, ...extra })}`;
}
