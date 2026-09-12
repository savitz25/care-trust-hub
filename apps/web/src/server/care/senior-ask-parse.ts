import { parseRecordedLocation } from "./senior-location";
import {
  type SeniorAskMode,
  type SeniorProviderClass,
  type SeniorResearchQuery,
  validateSeniorResearchQuery,
} from "./senior-ask-contract";

const COUNTIES: Record<string, { value: string; meaning: string }> = {
  broward: {
    value: "BROWARD",
    meaning:
      "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
  "palm beach": {
    value: "PALM BEACH",
    meaning:
      "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
  "miami-dade": {
    value: "MIAMI-DADE",
    meaning:
      "Provider location/address county as stored on the CMS directory record — not service territory.",
  },
  "miami dade": {
    value: "MIAMI-DADE",
    meaning:
      "Provider location/address county as stored on the CMS directory record — not service territory.",
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

function starNumber(q: string): number | undefined {
  const m =
    q.match(/\b([1-5](?:\.5)?)\s*(?:-|–)?\s*star/i) ||
    q.match(/\b([1-5])\s+cms(?:\s+overall)?\s+stars?/i) ||
    q.match(/at least\s+([1-5](?:\.5)?)/i);
  if (!m) return undefined;
  return Number(m[1]);
}

function ratingFilters(
  q: string,
  providerClass: SeniorProviderClass | undefined,
  stars: number | undefined,
): NonNullable<SeniorResearchQuery["qualityFilters"]> {
  const qualityFilters: SeniorResearchQuery["qualityFilters"] = {};
  if (stars && /overall|cms (overall )?star/i.test(q) && providerClass === "nursing_home") {
    qualityFilters.overallStars = /at least/i.test(q)
      ? [stars, stars + 1, stars + 2, stars + 3, stars + 4].filter((n) => n <= 5)
      : [stars];
  } else if (stars && /staffing/i.test(q) && providerClass === "nursing_home") {
    qualityFilters.staffingStars = /at least/i.test(q)
      ? [stars, 5].filter((n) => n >= stars && n <= 5)
      : [stars];
  } else if (stars && /inspection|health-inspection/i.test(q) && providerClass === "nursing_home") {
    qualityFilters.inspectionStars = [stars];
  } else if (
    stars &&
    providerClass === "home_health" &&
    /quality of patient care|qpc|star/i.test(q)
  ) {
    qualityFilters.qpcStars = [stars];
  } else if (stars && providerClass === "nursing_home" && /star/i.test(q)) {
    qualityFilters.overallStars = [stars];
  }

  return qualityFilters;
}

function labeledCcn(q: string): string | undefined {
  const m =
    q.match(/\b(?:cms\s*)?ccn\s*[:#]?\s*([A-Z0-9]{6})\b/i) ||
    q.match(/\bfind\s+(?:provider|ccn)\s+([A-Z0-9]{6})\b/i);
  return m?.[1]?.toUpperCase();
}

function interpretSeniorAskQueryCore(raw: string, page = 1): SeniorResearchQuery {
  const q = raw.trim();
  const providerClass = detectClass(q);
  const location = parseRecordedLocation(q);
  const geography = location.geography;
  const county = geography?.type === "county" ? geography : undefined;
  const state =
    geography?.type === "state"
      ? geography
      : geography?.state
        ? { value: geography.state }
        : undefined;
  const ccn = labeledCcn(q);
  const stars = starNumber(q);

  const fail = (
    failReason: string,
    alternatives: string[],
    coverageState: SeniorResearchQuery["coverageState"] = "UNSUPPORTED",
  ): SeniorResearchQuery =>
    validateSeniorResearchQuery({
      mode: "fail_closed",
      page: 1,
      failReason,
      alternatives,
      providerClass: providerClass === "ambiguous" ? undefined : providerClass,
      geography,
      locationRequirement: location.locationRequirement,
      coverageState,
    });

  if (!q) {
    return fail("Enter a research question.", ["Show nursing homes in Florida."]);
  }
  if (
    raw.trim().length > 180 ||
    /<\/?(?:script|iframe|object|style)\b|(?:'|%27)\s*(?:or|and)\s+\d+\s*=\s*\d+|--\s*$|;\s*(?:drop|select|insert|delete)\b/i.test(
      raw,
    )
  ) {
    return fail("The research question is malformed or exceeds the 180-character limit.", [
      "Show nursing homes in Florida.",
    ]);
  }
  if (
    /\b(?:serving|serves|service area|coverage area)\b|\bnear my (?:address|zip)|\bserving my (?:zip|address)/i.test(
      q,
    )
  ) {
    return fail(
      "Provider and office locations do not establish a verified service territory. Research recorded locations, then confirm service availability directly.",
      ["Show nursing homes in Florida."],
    );
  }
  if (/assisted living/i.test(q)) {
    if (/\bvirginia\b/i.test(q) || state?.value === "VA") {
      return fail(
        "Virginia assisted living is a DSS license class, not a CMS nursing-home directory. A complaint-related inspection is not a substantiated complaint. Open the Virginia research page.",
        ["Open Virginia assisted-living research."],
        "PARTIAL",
      );
    }
    if (/\bnew york\b|\bnyc\b/i.test(q) || state?.value === "NY") {
      return fail(
        "New York Adult Care / assisted living is a NYSDOH class, not a CMS nursing-home directory. Adult Home is not Enriched Housing. ALP is not ALR. Open the New York research page.",
        ["Open New York adult-care research."],
        "PARTIAL",
      );
    }
    return fail(
      "Assisted living is state-regulated and does not share the federal CMS nursing-home, Home Health, or Hospice directory contract. Use the available state-specific assisted-living research.",
      [
        "Open Arizona assisted-living research.",
        "Open Virginia assisted-living research.",
        "Open New York adult-care research.",
      ],
      "PARTIAL",
    );
  }
  if (
    (/\bnew york\b|\bnyc\b/i.test(q) || state?.value === "NY") &&
    /licensed home care|lhcsa/i.test(q)
  ) {
    return fail(
      "A New York licensed home care services agency (LHCSA) is not a CMS Home Health Agency. Use the New York research page and official NYSDOH verification.",
      ["Open New York home-care research."],
      "PARTIAL",
    );
  }
  if (
    (/\bnew york\b|\bnyc\b/i.test(q) || state?.value === "NY") &&
    /complaint/i.test(q) &&
    /nursing home/i.test(q)
  ) {
    return fail(
      "New York nursing-home complaint evidence requires an exact facility identity. A complaint-survey observation is not a substantiated complaint.",
      ["Open New York nursing-home research."],
      "PARTIAL",
    );
  }
  if (
    /\bvirginia\b/i.test(q) &&
    /complaint|inspection/i.test(q) &&
    /assisted living|alf|dss/i.test(q)
  ) {
    return fail(
      "A DSS complaint-related inspection is not a substantiated complaint, not a violation count, and not a quality score.",
      ["Open Virginia assisted-living research."],
      "PARTIAL",
    );
  }

  if (/best owner|largest senior-care company/i.test(q)) {
    return fail(
      "SeniorTrustHub does not rank owners or publish a “best owner.” Ownership-network size is a connected-provider count, not quality.",
      ["Which ownership organizations are connected to the most nursing homes?"],
    );
  }
  if (
    /\b(best|safe|safest|worst|most dangerous|most abusive|should i choose)\b/i.test(q) &&
    /nursing|home health|hospice|senior/i.test(q)
  ) {
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
  if (/5-?\s*star hospice|hospice.*overall.*star|overall.*star.*hospice/i.test(q)) {
    return fail(
      "Hospice does not have an overall CMS star rating comparable to nursing homes. That question is not supported.",
      ["Show hospice providers in Florida.", "Show hospice CAHPS evidence."],
    );
  }
  if (/lowest (?:indexed )?deficienc/i.test(q)) {
    return fail(
      "The current research experience can show indexed deficiency evidence, but it does not rank providers by a low count or treat fewer indexed rows as better care.",
      ["Show Florida nursing homes with indexed deficiencies."],
    );
  }
  if (
    (/payment denial|fire citation/i.test(q) && /nursing/i.test(q)) ||
    (/\binspections?\b/i.test(q) && !/stars?/i.test(q) && /nursing/i.test(q))
  ) {
    return fail(
      "This evidence family is source-backed on provider reports, but the current Ask executor does not expose a defensible standalone filter for it. Open a matching nursing-home report to inspect the evidence.",
      ["Show nursing homes in Florida."],
      "PARTIAL",
    );
  }
  if (/watch list|generator compliance|ccrc|fixed need pool|memory care/i.test(q)) {
    return fail(
      "That Florida field is not available as a live Ask query on the current production extract. No new ingest is started from Ask.",
      ["Show nursing homes in Florida.", "Open Florida intelligence"],
    );
  }
  if (
    /33,?819|all senior providers total/i.test(q) ||
    (/combined|all senior|senior providers total/i.test(q) && /how many|count/i.test(q))
  ) {
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
      providerClass: providerClass === "ambiguous" ? undefined : providerClass,
      geography,
      locationRequirement: location.locationRequirement,
      status: "current",
      page: 1,
      coverageState: "KNOWN",
    });
  }
  if (/^\d{6}$/.test(q) || /^[A-Z0-9]{6}$/i.test(q)) {
    return fail(
      "Bare six-character strings can be a nursing-home CCN, a Home Health CCN, or another identifier. Label the CCN (for example “CMS CCN 105502”) so Ask does not guess the class.",
      ["Find CMS CCN 105502"],
    );
  }
  if (
    /\bwho owns this facility\b|\bdid this facility change owners\b|\bhas this nursing home been fined\b|\bwhat is (?:a )?deficienc/i.test(
      q,
    )
  ) {
    return fail(
      "Add an exact provider name or labeled CMS CCN, or open a provider report. Ask will not attach ownership or evidence to an unspecified facility.",
      ["Find CMS CCN 105502"],
    );
  }

  if (
    /what does .*star|staffing star mean|overall star mean|what is chow|change of ownership mean/i.test(
      q,
    )
  ) {
    return validateSeniorResearchQuery({
      mode: "definition",
      metric: /chow|ownership change/i.test(q)
        ? "chow"
        : /staffing/i.test(q)
          ? "staffing_star"
          : "overall_star",
      page: 1,
    });
  }

  if (providerClass === "ambiguous") {
    return fail(
      "“Senior care providers” is ambiguous. Nursing homes, home health, and hospice are different CMS classes with different identifiers and evidence. Choose one class — Ask will not silently query all three.",
      [
        "Show nursing homes in Florida.",
        "Show home health agencies in Florida.",
        "Show hospice providers in Florida.",
      ],
    );
  }

  if (
    /chow|ownership change/i.test(q) &&
    (providerClass === "home_health" || providerClass === "hospice")
  ) {
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
    if (/deficien|penalt|civil monetary|chow|ownership|cahps|staffing hours/i.test(q))
      return fail(
        "This evidence-specific count is not supported. The requested evidence was not removed from the count.",
        [],
      );
    return validateSeniorResearchQuery({
      qualityFilters: ratingFilters(q, providerClass, stars),
      mode: "count",
      providerClass,
      geography,
      locationRequirement: location.locationRequirement,
      status: "current",
      page: 1,
    });
  }

  if (/distributed by|distribution of|share of .*stars/i.test(q)) {
    if (providerClass !== "nursing_home") {
      return fail(
        "Star-bucket distributions in Ask currently use nursing-home CMS overall stars only.",
        ["How are Florida nursing homes distributed by CMS overall star rating?"],
      );
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
      return fail(
        "County comparison in Ask is currently supported for nursing-home provider-location counts only.",
        ["Compare nursing-home counts in Broward and Palm Beach."],
      );
    }
    return validateSeniorResearchQuery({
      mode: "comparison",
      providerClass: "nursing_home",
      geography: COUNTIES.broward && {
        type: "county",
        value: "BROWARD",
        meaning: COUNTIES.broward.meaning,
      },
      compareGeography: {
        type: "county",
        value: "PALM BEACH",
        meaning: COUNTIES["palm beach"].meaning,
      },
      metric: /staffing/i.test(q) ? "staffing_star_distribution" : "count",
      status: "current",
      page: 1,
    });
  }

  if (
    /who owns|owned by|ownership organizations|ownership-network|connected to the most/i.test(q)
  ) {
    if (providerClass === "home_health" || providerClass === "hospice") {
      return fail(
        "Ownership-network size ranking in Ask uses the published nursing-home ownership graph. Similar organization names are not merged.",
        ["Which ownership organizations are connected to the most nursing homes?"],
      );
    }
    return validateSeniorResearchQuery({
      mode: "evidence",
      providerClass: "nursing_home",
      metric: /connected to the most|network/i.test(q) ? "ownership_network_size" : "ownership",
      organizationName: q.match(/owned by\s+(.+)$/i)?.[1]?.trim(),
      geography,
      locationRequirement: location.locationRequirement,
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

  if (
    /most indexed deficiencies|deficiency count|deficienc/i.test(q) &&
    providerClass !== "home_health" &&
    providerClass !== "hospice"
  ) {
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
    const plausibleName = q.replace(/^find\s+|^research\s+/i, "").trim();
    if (
      /^[a-z0-9][a-z0-9&'., -]{2,119}$/i.test(plausibleName) &&
      !/\b(how|what|which|where|who|count|compare|show|need|want|is|has|did)\b/i.test(plausibleName)
    ) {
      return validateSeniorResearchQuery({
        mode: "entity",
        identityQuery: plausibleName,
        status: "current",
        page,
        coverageState: "PARTIAL",
      });
    }
    return fail(
      "Ask could not determine a provider class. Nursing homes, home health, and hospice stay separate.",
      [
        "Show nursing homes in Florida.",
        "Show home health agencies in Florida.",
        "Show hospice providers in Florida.",
      ],
      "UNKNOWN",
    );
  }

  if (
    (providerClass === "home_health" || providerClass === "hospice") &&
    /deficien|penalt|civil monetary|staffing (?:hours|hprd|stars?)|health inspection|fire citation|payment denial/i.test(
      q,
    )
  ) {
    return fail(
      "That evidence filter belongs to the nursing-home evidence contract. Home Health and Hospice use different CMS measures, and Ask will not silently apply a nursing-home filter to another provider class.",
      providerClass === "home_health"
        ? ["Show home health agencies with HHCAHPS evidence."]
        : ["Show hospice providers with CAHPS evidence."],
    );
  }

  if (
    (providerClass === "nursing_home" && /\b(?:hhcahps|hospice cahps)\b/i.test(q)) ||
    (providerClass === "home_health" && /hospice cahps/i.test(q)) ||
    (providerClass === "hospice" && /\bhhcahps\b/i.test(q))
  ) {
    return fail(
      "CMS experience measures are provider-class specific. Ask will not apply Home Health or Hospice CAHPS evidence to a different provider class.",
      [
        "Show home health agencies with HHCAHPS evidence.",
        "Show hospice providers with CAHPS evidence.",
      ],
    );
  }

  const qualityFilters = ratingFilters(q, providerClass, stars);

  let sort: SeniorResearchQuery["sort"] = "name";
  const mode: SeniorAskMode = "entity";
  if (/highest (?:cms )?overall(?: stars?| rating)?/i.test(q)) sort = "overall_desc";
  if (/highest staffing rating/i.test(q)) sort = "staffing_desc";
  if (providerClass === "home_health" && /highest.*quality of patient care/i.test(q))
    sort = "qpc_desc";

  return validateSeniorResearchQuery({
    mode,
    providerClass,
    geography,
    locationRequirement: location.locationRequirement,
    status: "current",
    qualityFilters: Object.keys(qualityFilters).length ? qualityFilters : undefined,
    sort,
    page,
    coverageState: "KNOWN",
  });
}

export function interpretSeniorAskQuery(raw: string, page = 1): SeniorResearchQuery {
  let plan = interpretSeniorAskQueryCore(raw, page);
  const location = parseRecordedLocation(raw);
  const explicitName =
    raw.match(/^(?:find|research|provider named)\s+"([^"]+)"/i)?.[1] ??
    raw.match(/^(?:find|research|provider named)\s+(.+?)(?:\s+in\s+|$)/i)?.[1];
  if (
    explicitName &&
    raw.trim().length <= 180 &&
    !/\bCCN\b/i.test(explicitName) &&
    !/^(?:nursing homes?|home health agencies?|hospice providers?)$/i.test(explicitName) &&
    /^[\p{L}\p{N}&'., -]{3,120}$/u.test(explicitName)
  )
    plan = validateSeniorResearchQuery({
      mode: "entity",
      identityQuery: explicitName,
      ...location,
      status: "current",
      page,
      coverageState: "PARTIAL",
    });
  if (plan.mode === "comparison" || plan.mode === "definition") return plan;
  if (plan.mode === "fail_closed" && !location.locationRequirement) return plan;
  const result = { ...plan, ...location };
  if (location.locationRequirement && location.locationRequirement.outcome !== "APPLIED") {
    return {
      ...result,
      modeBeforeClarification: plan.mode,
      mode: "fail_closed",
      terminalState:
        location.locationRequirement.outcome === "UNSUPPORTED"
          ? "UNSUPPORTED"
          : "NEEDS_CLARIFICATION",
      failReason: location.locationRequirement.reason,
      alternatives: [],
    };
  }
  return result;
}

export function seniorAskQueryToSearchParams(
  query: SeniorResearchQuery,
  raw: string,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set("q", raw);
  if (query.page > 1) p.set("page", String(query.page));
  return p;
}
