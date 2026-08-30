export const SENIOR_ASK_CONTRACT = "senior-ask-v1" as const;
export const ASK_PAGE_SIZE = 20;

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
    meaning: string;
  };
  status?: "current";
  qualityFilters?: {
    overallStars?: number[];
    staffingStars?: number[];
    inspectionStars?: number[];
    qualityMeasureStars?: number[];
    qpcStars?: number[];
  };
  identifier?: { type: "ccn"; value: string };
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
  if (query.page < 1 || query.page > 500) query.page = 1;
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
  return query;
}
