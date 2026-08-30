import {
  type SeniorAskMode,
  type SeniorProviderClass,
  type SeniorResearchQuery,
  validateSeniorResearchQuery,
} from "./senior-ask-contract";

const STATE_NAMES: Record<string, string> = {
  florida: "FL",
  fl: "FL",
  texas: "TX",
  california: "CA",
  "new york": "NY",
};

const COUNTIES: Record<string, { value: string; meaning: string }> = {
  broward: {
    value: "BROWARD",
    meaning: "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
  "palm beach": {
    value: "PALM BEACH",
    meaning: "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
  "miami-dade": {
    value: "MIAMI-DADE",
    meaning: "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
  "miami dade": {
    value: "MIAMI-DADE",
    meaning: "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
};

function detectClass(q: string): SeniorProviderClass | "ambiguous" | undefined {
  const nh = /nursing\s*home|nursing\s*facilit|skilled\s*nursing|\bsnf\b/i.test(q);
  const hh = /home\s*health|\bhha\b/i.test(q);
  const hosp = /\bhospice\b/i.test(q);
  const n = Number(nh) + Number(hh) + Number(hosp);
  if (n > 1) return "ambiguous";
  if (nh) return "nursing_home";
  if (hh) return "home_health";
  if (hosp) return "hospice";
  if (/senior care providers|senior-care providers|all providers/i.test(q)) return "ambiguous";
  return undefined;
}

function detectState(q: string): { type: "state"; value: string; meaning: string } | undefined {
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (new RegExp(`\\b${name}\\b`, "i").test(q)) {
      return {
        type: "state",
        value: code,
        meaning: "CMS directory state on the provider record (address/location state), not a verified service area.",
      };
    }
  }
  return undefined;
}

function detectCounty(q: string) {
  for (const [name, meta] of Object.entries(COUNTIES)) {
    if (new RegExp(name, "i").test(q)) {
      return { type: "county" as const, value: meta.value, meaning: meta.meaning };
    }
  }
  return undefined;
}

function starNumber(q: string): number | undefined {
  const m =
    q.match(/\b([1-5])\s*(?:-|–)?\s*star/i) ||
    q.match(/\b([1-5])\s+cms(?:\s+overall)?\s+stars?/i) ||
    q.match(/at least\s+([1-5])/i);
  if (!m) return undefined;
  return Number(m[1]);
}

function labeledCcn(q: string): string | undefined {
  const m =
    q.match(/\b(?:cms\s*)?ccn\s*[:#]?\s*([A-Z0-9]{6})\b/i) ||
    q.match(/\bfind\s+(?:provider|ccn)\s+([A-Z0-9]{6})\b/i);
  return m?.[1]?.toUpperCase();
}

export function interpretSeniorAskQuery(raw: string, page = 1): SeniorResearchQuery {
  const q = raw.trim();
  const providerClass = detectClass(q);
  const county = detectCounty(q);
  const state = county ? { type: "state" as const, value: "FL", meaning: "Florida — inferred from named Florida county." } : detectState(q);
  const geography = county ?? state;
  const ccn = labeledCcn(q);
  const stars = starNumber(q);

  const fail = (failReason: string, alternatives: string[]): SeniorResearchQuery =>
    validateSeniorResearchQuery({ mode: "fail_closed", page: 1, failReason, alternatives, providerClass: providerClass === "ambiguous" ? undefined : providerClass, geography });

  if (!q) {
    return fail("Enter a research question.", ["Show nursing homes in Florida."]);
  }

  if (/best owner|largest senior-care company/i.test(q)) {
    return fail(
      "SeniorTrustHub does not rank owners or publish a “best owner.” Ownership-network size is a connected-provider count, not quality.",
      ["Which ownership organizations are connected to the most nursing homes?"],
    );
  }
  if (/\b(best|safest|worst|most dangerous|most abusive)\b/i.test(q) && /nursing|home health|hospice|senior/i.test(q)) {
    return fail(
      "SeniorTrustHub does not publish a “best,” “safest,” or “worst” nursing home ranking and does not create a safety score. CMS ratings, staffing, inspections, deficiencies, penalties, and ownership are source-reported evidence you can compare.",
      [
        "Show Florida nursing homes with 5 CMS overall stars.",
        "Show Florida nursing homes with 5 CMS staffing stars.",
        "Show Florida nursing homes with the most indexed deficiencies.",
        "Show nursing homes in Palm Beach County.",
      ],
    );
  }
  if (/clean record|no deficiencies|no penalties|good standing/i.test(q)) {
    return fail(
      "Missing evidence is not a clean record, zero deficiencies, or good standing. Ask can show indexed inspection, deficiency, and penalty observations when they exist.",
      ["Show Florida nursing homes with indexed civil monetary penalties."],
    );
  }
  if (/5-?\s*star hospice|hospice.*overall star|overall star.*hospice/i.test(q)) {
    return fail(
      "Hospice does not have an overall CMS star rating comparable to nursing homes. That question is not supported.",
      ["Show hospice providers in Florida.", "Show hospice CAHPS evidence."],
    );
  }
  if (/watch list|generator compliance|ccrc|fixed need pool|memory care services license/i.test(q)) {
    return fail(
      "That Florida field is not available as a live Ask query on the current production extract. No new ingest is started from Ask.",
      ["Show nursing homes in Florida.", "Open Florida intelligence"],
    );
  }
  if (/combined|all senior|senior providers total|33,?819/i.test(q) && /how many|count/i.test(q)) {
    return fail(
      "Nursing homes, home health, and hospice are separate classes. SeniorTrustHub does not publish a combined “senior providers” count.",
      [
        "How many nursing homes are currently indexed in Florida?",
        "How many home health agencies are currently indexed nationally?",
        "How many hospice providers are currently indexed in Florida?",
      ],
    );
  }

  if (ccn) {
    return validateSeniorResearchQuery({
      mode: "identifier",
      identifier: { type: "ccn", value: ccn },
      status: "current",
      page: 1,
    });
  }
  if (/^\d{6}$/.test(q) || /^[A-Z0-9]{6}$/i.test(q)) {
    return fail(
      "Bare six-character strings can be a nursing-home CCN, a Home Health CCN, or another identifier. Label the CCN (for example “CMS CCN 105502”) so Ask does not guess the class.",
      ["Find CMS CCN 105502"],
    );
  }

  if (/what does .*star|staffing star mean|overall star mean|what is chow|change of ownership mean/i.test(q)) {
    return validateSeniorResearchQuery({
      mode: "definition",
      metric: /chow|ownership change/i.test(q) ? "chow" : /staffing/i.test(q) ? "staffing_star" : "overall_star",
      page: 1,
    });
  }

  if (providerClass === "ambiguous") {
    return fail(
      "“Senior care providers” is ambiguous. Nursing homes, home health, and hospice are different CMS classes with different identifiers and evidence. Choose one class — Ask will not silently query all three.",
      ["Show nursing homes in Florida.", "Show home health agencies in Florida.", "Show hospice providers in Florida."],
    );
  }

  if (/chow|ownership change/i.test(q) && (providerClass === "home_health" || providerClass === "hospice")) {
    return fail(
      "Current indexed CHOW evidence is available for nursing homes; comparable Home Health/Hospice CHOW data is not currently available in this research system.",
      ["Show nursing homes with recent ownership-change evidence."],
    );
  }

  if (providerClass === "home_health" && county) {
    return fail(
      "Home Health current-directory rows store office city/state/ZIP. Office county is not a verified query field on the Home Health snapshot used here, and ZIP coverage is not treated as “serves this county.”",
      ["Show home health agencies in Florida."],
    );
  }

  if (/how many|count of|currently indexed/i.test(q)) {
    if (!providerClass) {
      return fail("Counts require a provider class.", [
        "How many nursing homes are currently indexed in Florida?",
        "How many home health agencies are currently indexed nationally?",
      ]);
    }
    return validateSeniorResearchQuery({
      mode: "count",
      providerClass,
      geography,
      status: "current",
      page: 1,
    });
  }

  if (/distributed by|distribution of|share of .*stars/i.test(q)) {
    if (providerClass !== "nursing_home") {
      return fail("Star-bucket distributions in Ask currently use nursing-home CMS overall stars only.", [
        "How are Florida nursing homes distributed by CMS overall star rating?",
      ]);
    }
    return validateSeniorResearchQuery({
      mode: "aggregate",
      providerClass: "nursing_home",
      geography,
      metric: "overall_star_distribution",
      status: "current",
      page: 1,
    });
  }

  if (/compare/i.test(q) && /broward/i.test(q) && /palm beach/i.test(q)) {
    if (providerClass && providerClass !== "nursing_home") {
      return fail("County comparison in Ask is currently supported for nursing-home provider-location counts only.", [
        "Compare nursing-home counts in Broward and Palm Beach.",
      ]);
    }
    return validateSeniorResearchQuery({
      mode: "comparison",
      providerClass: "nursing_home",
      geography: COUNTIES.broward && {
        type: "county",
        value: "BROWARD",
        meaning: COUNTIES.broward.meaning,
      },
      compareGeography: { type: "county", value: "PALM BEACH", meaning: COUNTIES["palm beach"].meaning },
      metric: /staffing/i.test(q) ? "staffing_star_distribution" : "count",
      status: "current",
      page: 1,
    });
  }

  if (/who owns|owned by|ownership organizations|ownership-network|connected to the most/i.test(q)) {
    if (providerClass === "home_health" || providerClass === "hospice") {
      return fail("Ownership-network size ranking in Ask uses the published nursing-home ownership graph. Similar organization names are not merged.", [
        "Which ownership organizations are connected to the most nursing homes?",
      ]);
    }
    return validateSeniorResearchQuery({
      mode: "evidence",
      providerClass: "nursing_home",
      metric: /connected to the most|network/i.test(q) ? "ownership_network_size" : "ownership",
      organizationName: q.match(/owned by\s+(.+)$/i)?.[1]?.trim(),
      geography,
      status: "current",
      page,
    });
  }

  if (/chow|ownership.change/i.test(q)) {
    return validateSeniorResearchQuery({
      mode: "entity",
      providerClass: "nursing_home",
      geography,
      metric: "chow",
      status: "current",
      sort: "name",
      page,
    });
  }

  if (/most indexed deficiencies|deficiency count|deficienc/i.test(q) && providerClass !== "home_health" && providerClass !== "hospice") {
    return validateSeniorResearchQuery({
      mode: "entity",
      providerClass: "nursing_home",
      geography,
      metric: "deficiency_count",
      status: "current",
      sort: "name",
      page,
    });
  }

  if (/penalt|civil monetary/i.test(q)) {
    return validateSeniorResearchQuery({
      mode: "entity",
      providerClass: "nursing_home",
      geography,
      metric: "penalty",
      status: "current",
      sort: "name",
      page,
    });
  }

  if (/staffing hours|hprd|hours per resident/i.test(q)) {
    return validateSeniorResearchQuery({
      mode: "entity",
      providerClass: "nursing_home",
      geography,
      metric: "staffing_hprd",
      status: "current",
      sort: "name",
      page,
    });
  }

  if (/cahps/i.test(q) && providerClass === "hospice") {
    return validateSeniorResearchQuery({
      mode: "entity",
      providerClass: "hospice",
      geography,
      metric: "hospice_cahps",
      status: "current",
      sort: "name",
      page,
    });
  }
  if (/hhcahps/i.test(q) && providerClass === "home_health") {
    return validateSeniorResearchQuery({
      mode: "entity",
      providerClass: "home_health",
      geography,
      metric: "hh_hhcahps",
      status: "current",
      sort: "name",
      page,
    });
  }

  if (!providerClass) {
    return fail("Ask could not determine a provider class. Nursing homes, home health, and hospice stay separate.", [
      "Show nursing homes in Florida.",
      "Show home health agencies in Florida.",
      "Show hospice providers in Florida.",
    ]);
  }

  const qualityFilters: SeniorResearchQuery["qualityFilters"] = {};
  if (stars && /overall|cms (overall )?star/i.test(q) && providerClass === "nursing_home") {
    qualityFilters.overallStars = /at least/i.test(q) ? [stars, stars + 1, stars + 2, stars + 3, stars + 4].filter((n) => n <= 5) : [stars];
  } else if (stars && /staffing/i.test(q) && providerClass === "nursing_home") {
    qualityFilters.staffingStars = /at least/i.test(q) ? [stars, 5].filter((n) => n >= stars && n <= 5) : [stars];
  } else if (stars && /inspection|health-inspection/i.test(q) && providerClass === "nursing_home") {
    qualityFilters.inspectionStars = [stars];
  } else if (stars && providerClass === "home_health" && /quality of patient care|qpc|star/i.test(q)) {
    qualityFilters.qpcStars = [stars];
  } else if (stars && providerClass === "nursing_home" && /star/i.test(q)) {
    qualityFilters.overallStars = [stars];
  }

  let sort: SeniorResearchQuery["sort"] = "name";
  let mode: SeniorAskMode = "entity";
  if (/highest overall|highest cms rating/i.test(q)) sort = "overall_desc";
  if (/highest staffing rating/i.test(q)) sort = "staffing_desc";
  if (providerClass === "home_health" && /highest.*quality of patient care/i.test(q)) sort = "qpc_desc";

  return validateSeniorResearchQuery({
    mode,
    providerClass,
    geography,
    status: "current",
    qualityFilters: Object.keys(qualityFilters).length ? qualityFilters : undefined,
    sort,
    page,
  });
}

export function seniorAskQueryToSearchParams(query: SeniorResearchQuery, raw: string): URLSearchParams {
  const p = new URLSearchParams();
  p.set("q", raw);
  if (query.page > 1) p.set("page", String(query.page));
  return p;
}
