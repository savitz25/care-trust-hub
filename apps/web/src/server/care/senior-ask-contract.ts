export const SENIOR_ASK_CONTRACT = "senior-ask-v1" as const;
export const ASK_PAGE_SIZE = 20;
export const ASK_INPUT_LIMIT = 180;

export type SeniorProviderClass = "nursing_home" | "home_health" | "hospice";

export type SeniorAskMode =
  | "entity"
  | "identifier"
  | "count"
  | "aggregate"
  | "comparison"
  | "evidence"
  | "definition"
  | "fail_closed";

export type SeniorAskSort = "name" | "ccn" | "city" | "overall_desc" | "staffing_desc" | "qpc_desc";

export type SeniorResearchQuery = {
  mode: SeniorAskMode;
  providerClass?: SeniorProviderClass;
  geography?: {
    type: "state" | "county" | "city" | "zip";
    value: string;
    state?: string;
    meaning: string;
  };
  locationRequirement?: {
    raw: string;
    outcome:
      | "APPLIED"
      | "NEEDS_CLARIFICATION"
      | "UNSUPPORTED"
      | "CONFLICT"
      | "USER_APPROVED_RELAXATION";
    reason?: string;
  };
  inputOverrides?: Record<string, string>;
  terminalState?: "INVALID_INPUT" | "NEEDS_CLARIFICATION" | "UNSUPPORTED" | "SOURCE_UNAVAILABLE";
  modeBeforeClarification?: SeniorAskMode;
  status?: "current";
  qualityFilters?: {
    overallStars?: number[];
    staffingStars?: number[];
    inspectionStars?: number[];
    qualityMeasureStars?: number[];
    qpcStars?: number[];
  };
  identifier?: { type: "ccn"; value: string };
  identityQuery?: string;
  coverageState?: "KNOWN" | "UNKNOWN" | "PARTIAL" | "NOT_ACQUIRED" | "REQUEST_ONLY" | "UNSUPPORTED";
  sort?: SeniorAskSort;
  metric?: string;
  compareGeography?: { type: "county"; value: string; meaning: string };
  organizationName?: string;
  failReason?: string;
  alternatives?: string[];
  page: number;
};

export type SeniorAskChip = { label: string; value: string; removeHref?: string };

export const CLASS_LABEL: Record<SeniorProviderClass, string> = {
  nursing_home: "Nursing Homes",
  home_health: "Home Health Agencies",
  hospice: "Hospice Providers",
};

export function validateSeniorResearchQuery(query: SeniorResearchQuery): SeniorResearchQuery {
  query = { ...query, geography: query.geography ? { ...query.geography } : undefined };
  const invalid = (failReason: string): SeniorResearchQuery => ({
    ...query,
    mode: "fail_closed",
    terminalState: "INVALID_INPUT",
    failReason,
    page: 1,
  });
  if (
    ![
      "entity",
      "identifier",
      "count",
      "aggregate",
      "comparison",
      "evidence",
      "definition",
      "fail_closed",
    ].includes(query.mode)
  )
    return invalid("Unsupported research operation.");
  if (
    query.providerClass &&
    !["nursing_home", "home_health", "hospice"].includes(query.providerClass)
  )
    return invalid("Unsupported provider class.");
  if (
    query.geography &&
    (!["state", "city", "county", "zip"].includes(query.geography.type) ||
      typeof query.geography.value !== "string" ||
      !query.geography.value.trim() ||
      query.geography.value.length > 80)
  )
    return invalid("Invalid recorded location.");
  if (query.qualityFilters)
    for (const [field, values] of Object.entries(query.qualityFilters)) {
      if (values === undefined) continue;
      if (!["overallStars", "staffingStars", "inspectionStars", "qpcStars"].includes(field))
        return invalid("Unsupported rating filter.");
      if (
        !Array.isArray(values) ||
        !values.length ||
        values.some(
          (v) =>
            typeof v !== "number" ||
            !Number.isFinite(v) ||
            v < 1 ||
            v > 5 ||
            (field === "qpcStars" ? !Number.isInteger(v * 2) : !Number.isInteger(v)),
        )
      )
        return invalid("Invalid source rating filter.");
      if (field === "qpcStars" && values.length !== 1)
        return invalid("Choose one Quality of Patient Care rating; no rating was discarded.");
      if (
        field === "qpcStars"
          ? query.providerClass !== "home_health"
          : query.providerClass !== "nursing_home"
      )
        return invalid("The rating filter does not apply to this provider class.");
    }
  if (!Number.isInteger(query.page) || query.page < 1 || query.page > 500)
    return {
      ...query,
      mode: "fail_closed",
      page: 1,
      terminalState: "INVALID_INPUT",
      failReason: "Page must be an integer from 1 through 500.",
    };
  if (query.identifier) {
    const ccn = query.identifier.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(ccn)) {
      return {
        mode: "fail_closed",
        page: 1,
        failReason: "CCN must be six alphanumeric characters.",
        alternatives: ["Find CMS CCN 105502"],
      };
    }
    query.identifier.value = ccn;
  }
  if (query.geography?.type === "state" && !/^[A-Z]{2}$/.test(query.geography.value)) {
    return {
      mode: "fail_closed",
      page: 1,
      failReason: "State geography must be a two-letter code.",
    };
  }
  if (query.identityQuery && query.identityQuery.trim().length > 120)
    return {
      ...query,
      mode: "fail_closed",
      terminalState: "INVALID_INPUT",
      failReason: "Provider name exceeds the supported input limit.",
    };
  if (query.identityQuery) query.identityQuery = query.identityQuery.trim();
  return query;
}
