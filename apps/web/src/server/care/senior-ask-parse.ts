import {
  detectUnrecognizedBarePlace,
  parseRecordedLocation,
  LOCATION_MEANING,
} from "./senior-location";
import { STATE_NAMES } from "@care/domain";
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
  // TH-DISCOVERY-RESET-001 (production certification fix): "senior care Florida" (no trailing
  // "providers") previously matched none of the checks above and fell through as `undefined` --
  // the same signal as "no care-related words at all" -- so it was misclassified further
  // downstream as a literal provider-name search instead of an ambiguous/generic care request
  // needing clarification. "senior care"/"senior home"/"care facility" alone are already
  // unambiguous generic-care signals, matching the same detection AskTrustHub's own care-task.ts
  // already uses for this identical phrase.
  if (
    /senior care providers|senior-care providers|all providers/i.test(q) ||
    /\bsenior\s+(?:homes?|care|facilit(?:y|ies))\b|\bcare\s+(?:home|facility|facilities|setting)\b/i.test(
      q,
    )
  )
    return "ambiguous";
  return undefined;
}

/**
 * TH-SEARCH-R1-019E: every word that `detectClass()` and `UNSUPPORTED_SENIOR_CLASSES` (below) react
 * to as CATEGORY vocabulary, plus the connector/quality words a bare category phrase carries along
 * ("in", "near", "options", "agency", "county") -- never a second, independently-maintained
 * classifier. Kept in sync BY HAND with `detectClass()` and `UNSUPPORTED_SENIOR_CLASSES`; drifting
 * from those only ever makes `isBareCategoryPhrase()` MORE conservative about calling something a
 * structured name, never less safe.
 *
 * A per-WORD set, not a phrase regex: a phrase regex has to enumerate every combination of category
 * word + trailing descriptor ("adult day care", "adult day care center", "adult day care services
 * center") and reliably misses one ("adult daycare center" leaves "center" stranded after matching
 * "adult daycare"). A per-word set has no such combinatorics -- it only needs the descriptor word
 * itself listed once, in any position, any number of times.
 */
const GENERIC_CARE_WORDS = new Set([
  // CMS trio + "ambiguous" vocabulary (detectClass())
  "nursing",
  "home",
  "homes",
  "facility",
  "facilities",
  "skilled",
  "snf",
  "health",
  "hha",
  "hospice",
  "provider",
  "providers",
  "senior",
  "seniors",
  "care",
  "all",
  // UNSUPPORTED_SENIOR_CLASSES vocabulary
  "memory",
  "retirement",
  "community",
  "communities",
  "village",
  "residence",
  "residences",
  "independent",
  "living",
  "continuing",
  "ccrc",
  "adult",
  "day",
  "daycare",
  "program",
  "programs",
  "caregiver",
  "caregivers",
  "caregiving",
  "companion",
  "elder",
  "eldercare",
  "board",
  "group",
  "family",
  "aide",
  "aides",
  "personal",
  "and",
  // generic descriptor/filler words that ride along with a category phrase but are never, on their
  // own, part of a facility's registered name in a bare category browse
  "center",
  "centers",
  "centre",
  "centres",
  "service",
  "services",
  "agency",
  "agencies",
  "option",
  "options",
  // connectors/prepositions (same list the prior residue-strip regex removed)
  "find",
  "show",
  "list",
  "search",
  "for",
  "in",
  "near",
  "within",
  "around",
  "county",
  "counties",
  "of",
  "the",
  "a",
  "an",
  "by",
  // quality/rating vocabulary (also covered by the early return below, kept here too for residue words
  // that appear alongside a quality clause rather than instead of one)
  "overall",
  "staffing",
  "inspection",
  "rating",
  "ratings",
  "star",
  "stars",
  "quality",
  "patient",
  "qpc",
  "hhcahps",
  "cahps",
  "cms",
]);

/**
 * Splits into lowercase alphanumeric words (punctuation and hyphens become word boundaries, so
 * "in-home" tokenizes the same as "in home"), for the word-set comparison above.
 */
function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * TH-SEARCH-R1-019E: the SAME "could this be a real name" shape check the pre-existing bare-name
 * identity path already applies (see the `!providerClass` branch below) -- reused, not duplicated,
 * so a name only ever needs to pass ONE definition of "name-shaped" in this file.
 */
function looksLikeProviderName(q: string): boolean {
  return (
    // Parentheses are part of real CMS-published names ("AMEDISYS HOME HEALTH CARE (AMHERST)"), the
    // same location-disambiguator convention CMS applies across all three classes -- not punctuation
    // introduced by a query's phrasing.
    /^[a-z0-9][a-z0-9&'.,() -]{2,119}$/i.test(q) &&
    !/\b(how|what|which|where|who|count|compare|show|need|want|is|has|did|distribution|trend|average|breakdown)\b/i.test(
      q,
    ) &&
    // "distribution/broken down/grouped BY <dimension>" is an analytical/statistical request shape,
    // never how a facility names itself -- narrow to this specific pattern so an ordinary facility
    // name that happens to contain the word "by" (e.g. "Sunset By The Bay Nursing Home") is unaffected.
    !/\b(?:distribut\w*|broken down|grouped)\s+by\b/i.test(q)
  );
}

/**
 * TH-SEARCH-R1-019E: true only when EVERY word in the query is either care-category vocabulary
 * `detectClass()`/`UNSUPPORTED_SENIOR_CLASSES` reacted to (`GENERIC_CARE_WORDS`, a connector word)
 * or part of the geography `parseRecordedLocation()` already recognized elsewhere in this same query
 * ("nursing homes in Florida", "hospice near Tampa", "senior care Florida", "home health agencies in
 * Texas"). A query that still carries ANY other word once that vocabulary and that recognized
 * geography are removed is a STRUCTURED PROVIDER NAME, never a category browse -- even though it
 * contains a word like "nursing"/"rehabilitation"/"care"/"home health"/"hospice". This never invents
 * or guesses a place: it only ever removes geography `parseRecordedLocation()` itself already
 * resolved.
 */
function isBareCategoryPhrase(
  q: string,
  geography: ReturnType<typeof parseRecordedLocation>["geography"],
): boolean {
  // A CMS quality/rating filter clause ("with 4 CMS overall stars", "5-star", "highest staffing
  // rating") is legitimate category-query content on its own, distinct from both the care-category
  // vocabulary and geography stripped below -- and not something a provider's own name contains. Its
  // presence alone is conclusive: never treated as name content requiring the override.
  //
  // TH-SEARCH-R1-019E-R2: a ranking/quality-INTENT phrase ("top rated nursing homes in Florida",
  // "highest rated nursing homes", "top nursing homes in Florida") is the SAME kind of query-modifying
  // content, and belongs in this SAME early-return, not in GENERIC_CARE_WORDS -- a bare superlative
  // ("top", "best", "premier", "five", "star") is also common inside a REAL registered provider brand
  // ("AMERICAN PREMIER HOME HEALTH CARE", "FIVE STAR HOME HEALTH CARE", "HOLLYWOOD PREMIER HEALTHCARE
  // CENTER" all exist in the current corpus), so those words are deliberately never added to
  // GENERIC_CARE_WORDS as free-floating adjectives -- that would make an entire real brand name
  // reduce to nothing but generic residue. Ranking intent is instead recognized only in the two
  // narrow, idiomatic shapes it actually takes as a QUESTION: a superlative directly modifying
  // "rated" ("top/best/highest/highly rated"), or a bare "top" directly modifying a CMS-trio/senior
  // category noun ("top nursing homes", "top hospice"). Neither shape occurs inside a provider's own
  // registered name.
  if (
    starNumber(q) !== undefined ||
    /\b(?:overall|staffing|inspection|health-inspection)\s*(?:rating|star)|quality of patient care|\bqpc\b|\bhhcahps\b|\bcahps\b/i.test(
      q,
    ) ||
    /\b(?:top|best|highest|highly|most\s+highly)[\s-]*rated\b/i.test(q) ||
    /\btop[\s-]+(?:rated\s+)?(?:nursing\s*homes?|hospice(?:s|\s+providers?)?|home\s*health(?:\s*agenc(?:y|ies))?|senior\s*(?:care|homes?))\b/i.test(
      q,
    )
  ) {
    return true;
  }
  const geoWords = new Set<string>();
  // parseRecordedLocation() does not always structure a trailing city next to an explicit state
  // ("board and care home Fresno California" resolves only the state, "CA", leaving "Fresno"
  // unaccounted for in `geography`). Reuse the SAME trailing-place heuristic the Springfield fix
  // above already trusts for this identical class of query, rather than inventing a second one, so a
  // real trailing place name is not mistaken for extra name content here either.
  const trailingPlace = detectUnrecognizedBarePlace(q);
  if (trailingPlace) for (const w of words(trailingPlace)) geoWords.add(w);
  if (geography) {
    const geoTexts: string[] = [];
    if (geography.value) geoTexts.push(geography.value);
    if ("state" in geography && geography.state) geoTexts.push(geography.state);
    const stateCode =
      geography.type === "state"
        ? geography.value
        : "state" in geography
          ? geography.state
          : undefined;
    if (stateCode && STATE_NAMES[stateCode]) geoTexts.push(STATE_NAMES[stateCode]!);
    for (const text of geoTexts) for (const w of words(text)) geoWords.add(w);
  }
  return words(q).every((w) => GENERIC_CARE_WORDS.has(w) || geoWords.has(w));
}

/**
 * TH-DISCOVERY-PARITY-001B: state-regulated senior-care settings outside the federal CMS Nursing
 * Home/Home Health/Hospice trio -- general patterns, not the specific audit phrasings that
 * motivated this fix. "assisted living" keeps its own dedicated, more detailed state-by-state
 * block above/below this list and is intentionally not repeated here. Bare "senior living" is
 * deliberately excluded: it is part of real national brand names (Brookdale Senior Living, Sunrise
 * Senior Living) and must stay eligible for the identity/provider-name search path, not be
 * intercepted as an unsupported class.
 */
const UNSUPPORTED_SENIOR_CLASSES: Array<{ label: string; match: (q: string) => boolean }> = [
  { label: "Memory care", match: (q) => /\bmemory care\b/i.test(q) },
  {
    label: "Retirement community",
    match: (q) => /\bretirement (?:communit(?:y|ies)|village|home|residence)s?\b/i.test(q),
  },
  { label: "Independent living", match: (q) => /\bindependent living\b/i.test(q) },
  {
    label: "Continuing care retirement community (CCRC)",
    match: (q) => /\bcontinuing care retirement communit(?:y|ies)\b/i.test(q),
  },
  {
    label: "Adult day care",
    match: (q) => /\badult\s*day\s*(?:care|services|program|center|centers|health)?\b/i.test(q),
  },
  {
    label: "In-home caregiving",
    match: (q) =>
      /\bin-?home\s*(?:care|caregiver(?:s|ing)?)\b/i.test(q) ||
      /\bcaregivers?\b/i.test(q) ||
      /\bcompanion care\b/i.test(q) ||
      /\b(?:home care|personal care) aides?\b/i.test(q),
  },
  { label: "Elder care services", match: (q) => /\belder\s?care\b/i.test(q) },
  {
    label: "Board and care / group home",
    match: (q) =>
      /\bboard and care\b/i.test(q) ||
      /\bgroup home\b/i.test(q) ||
      /\badult family home\b/i.test(q),
  },
  {
    label: "Home care agency",
    match: (q) => /\bhome care\b/i.test(q) && !/\bhome health\b/i.test(q),
  },
];

function unsupportedSeniorClassLabel(q: string): string | undefined {
  return UNSUPPORTED_SENIOR_CLASSES.find((c) => c.match(q))?.label;
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
  const location = parseRecordedLocation(q);
  const rawProviderClass = detectClass(q);
  // TH-DISCOVERY-FINAL-REPAIR-B: live-audit DANGEROUS finding -- "senior care Springfield" (no
  // preposition, no state token, no "County" keyword) parsed to NO geography at all above, so a
  // named place silently vanished and the executor ran an unfiltered NATIONAL query/preview with no
  // disclosure that "Springfield" was ever typed (see detectUnrecognizedBarePlace() in
  // senior-location.ts for the full mechanism). Only applied once a genuine CMS/senior-care class
  // signal (detectClass()) or a genuinely unsupported non-CMS class is already present in the query,
  // so a plain provider-name/brand search ("Brookdale Senior Living", which carries no such signal)
  // is never reinterpreted as a location query. This never assigns a state -- it only ensures the
  // place is disclosed and routed through the same "choose the state" clarification (and, for
  // unsupported classes, the honestly-labeled nationwide preview) as every other unresolved bare
  // city, instead of disappearing.
  //
  // Requiring `!location.locationRequirement` (flagged in review) matters: parseRecordedLocation()
  // already returns a locationRequirement of its own -- with no geography -- for genuinely different
  // reasons (an "Austin Texas and Tampa Florida" multi-place clause, a "near me"/radius claim...).
  // Those already correctly explain the problem and, for the multi-place case, name BOTH places; this
  // fallback must never overwrite that with a single mangled trailing fragment ("Tampa Florida" as
  // one city, silently dropping "Austin Texas" entirely). It only ever fires when
  // parseRecordedLocation() found NOTHING at all to say about location.
  const rawUnsupportedClassLabel = !rawProviderClass ? unsupportedSeniorClassLabel(q) : undefined;
  if (
    !location.geography &&
    !location.locationRequirement &&
    (rawProviderClass || rawUnsupportedClassLabel)
  ) {
    const bare = detectUnrecognizedBarePlace(q);
    if (bare) {
      location.geography = { type: "city", value: bare.toUpperCase(), meaning: LOCATION_MEANING };
      location.locationRequirement = {
        raw: bare,
        outcome: "NEEDS_CLARIFICATION",
        reason: `Choose the state for ${bare}. The provider corpus does not establish that this city name is unique nationally.`,
      };
    }
  }
  // TH-SEARCH-R1-019E: STRUCTURED PROVIDER NAME FIRST. detectClass() reacts to a care-category word
  // ANYWHERE in the text, so a real facility's own name -- "A Holly Patterson Extended Care
  // Facility" (contains "Care Facility"), "FFIII Houston SNF Tenant" (contains "SNF") -- was
  // classified exactly like a bare category browse and diverted into a class-clarification/cohort
  // path before the identity/name search below ever ran, discarding the actual supplied name. A
  // query only keeps that class signal when it is ALSO shaped like a real name (looksLikeProviderName)
  // AND the class/ambiguous vocabulary is not the query's ENTIRE content (isBareCategoryPhrase) --
  // "nursing homes in Florida" and "senior care Florida" still reduce to nothing else and keep their
  // existing cohort/clarification behavior unchanged; a name carrying extra content next to the
  // matched word never does. Computed AFTER the Springfield bare-place fallback above (which must
  // keep using the RAW class signal to decide whether to disclose an unresolved place) so a genuine
  // "senior care Springfield" still gets Springfield disclosed and folded into this same check --
  // once disclosed, isBareCategoryPhrase correctly sees nothing left over and this override leaves
  // the class alone. This never infers a provider CLASS from the name (the identity search below
  // still returns each row's own source-recorded class, never this word), and never strips or
  // reinterprets a place inside the name on its own -- it only decides whether detectClass()'s class
  // signal is allowed to override the name at all.
  const providerClass =
    rawProviderClass && looksLikeProviderName(q) && !isBareCategoryPhrase(q, location.geography)
      ? undefined
      : rawProviderClass;
  // The SAME structured-name-first override, applied to the SEPARATE non-CMS "unsupported class"
  // signal (UNSUPPORTED_SENIOR_CLASSES, e.g. "home care" without "health" following) -- a real,
  // published Home Health agency can carry "HOME CARE" in its own registered name ("A & T CERTIFIED
  // HOME CARE, LLC"), which is not a CMS-trio word detectClass() reacts to and so needed its own
  // check here, not a second copy of the one above.
  const unsupportedClassLabel =
    rawUnsupportedClassLabel &&
    looksLikeProviderName(q) &&
    !isBareCategoryPhrase(q, location.geography)
      ? undefined
      : rawUnsupportedClassLabel;
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
    if (/\billinois\b/i.test(q) || state?.value === "IL") {
      return fail(
        "Illinois Assisted Living and Shared Housing are IDPH license classes, not CMS nursing homes and not HFS Supportive Living. Current bulk rosters were not acquired. Use IDPH LLCS lookup. Search-only is not zero.",
        ["Open Illinois senior-care research."],
        "NOT_ACQUIRED",
      );
    }
    if (/\boregon\b/i.test(q) || state?.value === "OR") {
      return fail(
        "Oregon Assisted Living Facilities are an ODHS license class, not CMS nursing homes, not Residential Care, and not Adult Foster Homes. Open the Oregon research page.",
        ["Open Oregon senior-care research."],
        "PARTIAL",
      );
    }
    if (/\bpennsylvania\b|\bpittsburg|\bphiladelphia\b/i.test(q) || state?.value === "PA") {
      return fail(
        "Pennsylvania Assisted Living Residences are a DHS license class, not Personal Care Homes and not CMS nursing homes. Current ALR bulk roster was not acquired. Search-only is not zero. Open the Pennsylvania research page.",
        ["Open Pennsylvania senior-care research."],
        "NOT_ACQUIRED",
      );
    }
    if (
      /\bnorth carolina\b/i.test(q) ||
      state?.value === "NC" ||
      (/\b(charlotte|raleigh)\b/i.test(q) && !/\bflorida\b|\bcharlotte county\b/i.test(q))
    ) {
      return fail(
        "North Carolina Adult Care Homes and Family Care Homes are the state-regulated assisted-living classes. They are not Nursing Homes, not Home Health, and not CMS directories. ACH is not FCH. NC DHSR Star Rating is official state evidence, not a TrustHub score, and TrustHub does not rank facilities. Open the North Carolina research page.",
        ["Open North Carolina senior-care research."],
        "PARTIAL",
      );
    }
    if (
      /\bohio\b/i.test(q) ||
      state?.value === "OH" ||
      /\b(cleveland|columbus|cincinnati|toledo|akron|dayton)\b/i.test(q)
    ) {
      return fail(
        "Ohio Residential Care Facilities are the state-native assisted-living license class. They are not Nursing Homes and not CMS directories. Assisted living in consumer language maps to RCF research. The Long-Term Care Quality Navigator is official evidence, not a TrustHub score. Cleveland and Columbus are not separate SeniorTrustHub routes. Open the Ohio research page.",
        ["Open Ohio senior-care research."],
        "PARTIAL",
      );
    }
    if (/\bgeorgia\b/i.test(q) || state?.value === "GA" || /\batlanta\b/i.test(q)) {
      if (/inspection|complaint/i.test(q)) {
        return fail(
          "Georgia assisted-living inspections and complaints stay separate. An Assisted Living Community (Chapter 111-8-63) is not a Personal Care Home (Chapter 111-8-62) and not a CMS nursing home. HFRD inspection reports were not indexed. A complaint form is not a complaint dataset. Open the Georgia research page.",
          ["Open Georgia senior-care research."],
          /complaint/i.test(q) ? "REQUEST_ONLY" : "NOT_ACQUIRED",
        );
      }
      return fail(
        "Georgia assisted living in consumer language is not one license class. An Assisted Living Community (Chapter 111-8-63) serves 25 or more residents and is distinct from a Personal Care Home (Chapter 111-8-62). Neither is a CMS nursing home. No current state roster was acquired. The department's 2,910 figure is program context across four classes, not a TrustHub count. Atlanta is not a license system. Open the Georgia research page.",
        ["Open Georgia senior-care research."],
        "NOT_ACQUIRED",
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
  if ((/\billinois\b/i.test(q) || state?.value === "IL") && /supportive living|\bslp\b/i.test(q)) {
    return fail(
      "Illinois Supportive Living is an HFS Medicaid program class (169 operational sites as of 2026-02-06), not a nursing home, not assisted living, and not a CMS SNF. Medicaid participation is not a facility license.",
      ["Open Illinois senior-care research."],
      "PARTIAL",
    );
  }
  if (
    (/\billinois\b/i.test(q) || state?.value === "IL") &&
    /complaint/i.test(q) &&
    /nursing home|assisted living|hospice|home health/i.test(q)
  ) {
    return fail(
      "Illinois complaint research is IDPH hotline and LLCS search-only. Missing bulk complaint data is not zero complaints. A complaint is not a survey deficiency.",
      ["Open Illinois senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (
    (/\billinois\b/i.test(q) || state?.value === "IL") &&
    /how many|count/i.test(q) &&
    /licensed nursing home|idfpr|idph nursing/i.test(q)
  ) {
    return fail(
      "A current IDPH nursing-home license census was not acquired. Do not answer with the CMS Illinois overlay of 666 certified providers as that license count. Search-only is not zero.",
      [
        "How many CMS nursing homes are currently indexed in Illinois?",
        "Open Illinois senior-care research.",
      ],
      "NOT_ACQUIRED",
    );
  }
  if (
    /\b(chicago|cook county)\b/i.test(q) &&
    /nursing home|assisted living|senior/i.test(q) &&
    (/\billinois\b/i.test(q) || state?.value === "IL" || /\bchicago\b|\bcook county\b/i.test(q))
  ) {
    if (/\b(best|safe|safest|worst)\b/i.test(q) || /local route|near me/i.test(q)) {
      return fail(
        "SeniorTrustHub does not rank Illinois facilities and does not publish Chicago or Cook County intelligence routes from this statewide page.",
        ["Show nursing homes in Illinois."],
      );
    }
  }
  const oregon = /\boregon\b/i.test(q) || state?.value === "OR" || /\bodhs\b/i.test(q);
  const odhsId =
    q.match(/\bprovider(?:\s+id)?\s*[:#]?\s*([A-Z0-9]{5,12})\b/i)?.[1]?.toUpperCase() ||
    q.match(/\b(70[A-Z]\d{3}|50[A-Z]\d{3}|38[A-Z0-9]{3,4})\b/i)?.[1]?.toUpperCase();
  if (odhsId && (oregon || /\bprovider\s+id\b/i.test(q) || /\b70[A-Z]\d{3}\b/i.test(q))) {
    if (/license condition|regulatory action/i.test(q)) {
      return fail(
        `ODHS Provider ID ${odhsId} license-condition rows are on the Oregon research page and official ODHS lookup. Public regulatory-action data currently shows license conditions only. Absence of other action types is not a clean history. A Provider ID is not a CMS CCN.`,
        ["Open Oregon senior-care research."],
        "PARTIAL",
      );
    }
    return fail(
      `ODHS Provider ID ${odhsId} is a state identity, not a CMS CCN. Confirm the provider on official ODHS Licensed Long-Term Care Settings Search. This snapshot has 0 exact ODHS↔CMS CCN bridges.`,
      ["Open Oregon senior-care research."],
      "PARTIAL",
    );
  }
  if (oregon && /inspection/i.test(q)) {
    return fail(
      "ODHS inspections are Event ID observations. A complaint-related inspection is not a complaint filing. One Event ID is one inspection even when deficiencies are cited. Open the Oregon research page.",
      ["Open Oregon senior-care research."],
      "PARTIAL",
    );
  }
  if (oregon && /substantiated violation|violations?\b/i.test(q) && !/regulatory action/i.test(q)) {
    return fail(
      "ODHS listed violations are substantiated. Open investigations and appealed complaints are not listed. A substantiated violation is not a complaint. Open the Oregon research page.",
      ["Open Oregon senior-care research."],
      "PARTIAL",
    );
  }
  if (oregon && /regulatory action|license condition/i.test(q)) {
    return fail(
      "Public ODHS regulatory-action data currently displays license conditions dating back to 2010, not all formal actions. Absence of revocation-notice rows is not a clean history.",
      ["Open Oregon senior-care research."],
      "PARTIAL",
    );
  }
  if (
    oregon &&
    /how many|count/i.test(q) &&
    /nursing facilit/i.test(q) &&
    /odhs|licensed|snapshot/i.test(q)
  ) {
    return fail(
      "The ODHS snapshot has 128 open Nursing Facility identities. That is not the CMS Oregon Nursing Home CCN overlay, not Assisted Living, and not a combined facilities total.",
      [
        "Open Oregon senior-care research.",
        "How many CMS nursing homes are currently indexed in Oregon?",
      ],
      "PARTIAL",
    );
  }
  if (oregon && /cms-certified|cms certified/i.test(q)) {
    return fail(
      "CMS certification uses CCN identity. An ODHS Provider ID is not a CCN unless an exact source-native bridge exists (0 in this snapshot). Open Oregon research for the CMS overlay kept separate from ODHS classes.",
      ["Open Oregon senior-care research.", "Find CMS CCN 385018"],
      "PARTIAL",
    );
  }
  if (
    oregon &&
    /\blicensed\b|\blicense\b/i.test(q) &&
    !ccn &&
    !odhsId &&
    !/license condition|regulatory action/i.test(q)
  ) {
    return fail(
      "Oregon license status is class-specific. ODHS Nursing Facility, Assisted Living, Residential Care, and Adult Foster Home identities are not CMS CCNs. OHA Home Health and Hospice licenses are not CMS certifications. Name-only is not a license confirmation. Open the Oregon research page.",
      ["Open Oregon senior-care research."],
      "PARTIAL",
    );
  }
  if (oregon && /adult foster|residential care|\brcf\b|\bafh\b/i.test(q)) {
    return fail(
      "Oregon Adult Foster Homes and Residential Care Facilities are ODHS license classes, not CMS nursing homes. They are not added to Assisted Living or Nursing Facility counts.",
      ["Open Oregon senior-care research."],
      "PARTIAL",
    );
  }
  const pennsylvania =
    /\bpennsylvania\b/i.test(q) ||
    state?.value === "PA" ||
    /\bphiladelphia\b|\bpittsburgh\b|\ballegheny county\b/i.test(q);
  const paFacilityId = q.match(/\b(?:facility(?:\s+id)?|license)\s*[:#]?\s*(\d{5,8})\b/i)?.[1];
  if (pennsylvania && /personal care home|\bpch\b/i.test(q)) {
    return fail(
      "Pennsylvania Personal Care Homes are a DHS license class, not Assisted Living Residences and not CMS nursing homes. Current PCH facility roster is official search-only. The August 2026 monthly report of 995 homes is an inspection-lagged aggregate, not a live roster and not facility identities.",
      ["Open Pennsylvania senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (pennsylvania && /home care/i.test(q) && !/home health/i.test(q)) {
    return fail(
      "Pennsylvania Home Care agencies and registries are a DOH license class, not Home Health and not CMS Home Health. This snapshot has 4,656 Home Care rows kept separate from 659 Home Health rows. Open the Pennsylvania research page.",
      ["Open Pennsylvania senior-care research."],
      "PARTIAL",
    );
  }
  if (pennsylvania && /adult day/i.test(q)) {
    return fail(
      "Pennsylvania Adult Day Centers are a Department of Aging license class, not residential PCH/ALR/nursing-home facilities. Current bulk roster was not acquired. Search-only is not zero.",
      ["Open Pennsylvania senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (pennsylvania && /\blife\b|\bpace\b/i.test(q) && !/quality of life/i.test(q)) {
    return fail(
      "Pennsylvania LIFE/PACE is a program/provider network, not a residential facility license class. 24 providers and 58 centers in the August 2026 state table are not added to PCH, ALR, or nursing-home totals.",
      ["Open Pennsylvania senior-care research."],
      "PARTIAL",
    );
  }
  if (pennsylvania && /sanction/i.test(q)) {
    return fail(
      "Pennsylvania nursing-home sanctions are DOH order/penalty observations. A sanction is not an inspection, not a complaint, and not a conviction. Name-only attachment is unsafe. Open the Pennsylvania research page.",
      ["Open Pennsylvania senior-care research."],
      "PARTIAL",
    );
  }
  if (
    pennsylvania &&
    /inspection|survey/i.test(q) &&
    /nursing home|personal care|assisted living/i.test(q)
  ) {
    return fail(
      "Pennsylvania survey and inspection evidence is class-specific. A survey is not a sanction. A deficiency is not a complaint. A plan of correction is not an admission. Statewide survey tables remain search-only except the acquired sanctions PDF extract.",
      ["Open Pennsylvania senior-care research."],
      "PARTIAL",
    );
  }
  if (paFacilityId && (pennsylvania || /\bfacility id\b/i.test(q))) {
    return fail(
      `Pennsylvania facility ID ${paFacilityId} is a state identity. Confirm it on official DOH/DHS lookup. A state Facility ID is not a CMS CCN unless the source publishes a 39xxxxx Medicare ID.`,
      ["Open Pennsylvania senior-care research."],
      "PARTIAL",
    );
  }
  if (
    /\b(philadelphia|pittsburgh|allegheny county)\b/i.test(q) &&
    /nursing home|assisted living|personal care|senior/i.test(q)
  ) {
    return fail(
      "SeniorTrustHub does not publish Philadelphia, Pittsburgh, or Allegheny intelligence routes. Statewide Pennsylvania research remains /pennsylvania. Ranking is unsupported.",
      ["Show nursing homes in Pennsylvania.", "Open Pennsylvania senior-care research."],
    );
  }
  const northCarolina =
    /\bnorth carolina\b/i.test(q) ||
    state?.value === "NC" ||
    (/\b(charlotte|raleigh|mecklenburg|wake county)\b/i.test(q) &&
      /nursing home|assisted living|adult care|family care|home care|home health|hospice|senior|pace|ccrc|adult day/i.test(
        q,
      ) &&
      !/\bflorida\b|\bcharlotte county\b/i.test(q));
  const ncLicense = q.match(
    /\b((?:HAL|FCL|ORL)-\d{3}-\d+|NH\d{4}|HC\d{4}|HOS\d{4}|NP\d{4})\b/i,
  )?.[1];
  const ncFid = q.match(/\bfid\s*[:#=]?\s*(\d{4,8})\b/i)?.[1];
  if (northCarolina && /adult care home|\bach\b/i.test(q) && !/family care/i.test(q)) {
    return fail(
      "North Carolina Adult Care Homes are a DHSR ACLS license class (HAL), not Family Care Homes and not Nursing Homes. This snapshot has 568 Adult Care Home licenses from the 2026-07-30 listing. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /family care home|\bfch\b/i.test(q)) {
    return fail(
      "North Carolina Family Care Homes are a DHSR ACLS license class (FCL, 2–6 beds), not Adult Care Homes and not Nursing Homes. This snapshot has 515 Family Care Home licenses from the 2026-07-30 listing. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (
    northCarolina &&
    /star rating|star-rated|4 star|four star/i.test(q) &&
    /adult care|family care|assisted living/i.test(q)
  ) {
    return fail(
      "NC DHSR publishes official Star Ratings for Adult Care Homes and Family Care Homes. The listing as-of date is 2026-07-30. A Star Rating is official state evidence, not a TrustHub score, and TrustHub does not rank or select a winner. Inspect facility evidence on the DHSR search and the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /penalt/i.test(q) && /adult care|family care|assisted living/i.test(q)) {
    return fail(
      "North Carolina Adult Care penalties are DHSR ACLS administrative penalties for the previous 36 months. A penalty is not a complaint, not an inspection, and not a conviction. Amount is not a quality score. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /inspection/i.test(q) && /adult care|family care|assisted living/i.test(q)) {
    return fail(
      "North Carolina Adult Care inspections are DHSR ACLS survey observations. An inspection is not a complaint. A statement of deficiencies is not a penalty. Statewide inspection-event tables remain search-only except acquired penalty and Star Rating evidence. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /home care/i.test(q) && !/home health/i.test(q)) {
    return fail(
      "North Carolina Home Care is a DHSR class. The Home Care All download is mixed and includes Home Health licenses, so 3,336 mixed-file rows are not a Home Care agency count. Home Health (192) and Hospice (212) stay on separate listings. Nursing Pool is not Home Care. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /home health/i.test(q)) {
    return fail(
      "North Carolina Home Health is a DHSR listing class (192 rows as of 2026-08-20), not Home Care and not Hospice. A DHSR Home Health license is not a CMS Home Health CCN unless an exact source-published bridge exists (0 in this snapshot). Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /\bhospice\b/i.test(q)) {
    return fail(
      "North Carolina Hospice is a DHSR listing class (212 HOS licenses as of 2026-08-20), not Home Health and not Home Care. State hospice license is not a CMS Hospice CCN unless an exact source-published bridge exists (0 in this snapshot). Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /nursing home/i.test(q) && /deficienc|inspection|survey|sod/i.test(q)) {
    return fail(
      "North Carolina nursing-home Statements of Deficiencies are posted from March 1, 2011. This snapshot acquired a facility SOD index, not a complete SOD document universe. A deficiency is not a complaint. State license is not a CMS CCN. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /adult day/i.test(q)) {
    return fail(
      "North Carolina Adult Day Care and Adult Day Health are Division of Aging certified programs, not residential Adult Care, Family Care, or Nursing Homes. The 2026-04-21 directory has 93 centers. Combined ADC/ADH programs are not double-counted. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /\bpace\b/i.test(q) && !/quality of pace/i.test(q)) {
    return fail(
      "North Carolina PACE is a CMS/NC Medicaid program. This snapshot has 11 organizations and 14 locations. A PACE organization is not a PACE location and not a DHSR facility license. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /ccrc|continuing care retirement/i.test(q)) {
    return fail(
      "North Carolina CCRCs are licensed by NCDOI, not as a DHSR facility class. A CCRC campus is not the sum of DHSR Adult Care or Nursing Home components. Continuing Care at Home is a separate licensed program. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if ((ncLicense || ncFid) && (northCarolina || /\b(hal|fcl|orl|fid)\b/i.test(q))) {
    const ident = ncLicense ? ncLicense.toUpperCase() : `FID ${ncFid}`;
    return fail(
      `North Carolina identity ${ident} is a state DHSR license or FID. Confirm it on official DHSR lookup. A state license/FID is not a CMS CCN. Name-only matching is unsafe.`,
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (
    northCarolina &&
    /senior care/i.test(q) &&
    !/nursing home|assisted living|adult care|family care|home care|home health|hospice|adult day|pace|ccrc/i.test(
      q,
    )
  ) {
    return fail(
      "North Carolina senior care is class-specific. Adult Care Home is not Family Care Home is not Nursing Home. Home Care is not Home Health is not Hospice. Adult Day, PACE, and CCRC are separate. There is no combined NC senior-provider total. Open the North Carolina research page.",
      ["Open North Carolina senior-care research."],
      "PARTIAL",
    );
  }
  if (northCarolina && /\b(best|safest|top-rated|worst)\b/i.test(q)) {
    return fail(
      "SeniorTrustHub does not rank North Carolina facilities and does not convert NC DHSR Star Ratings into a TrustHub score. NC DHSR publishes official Star Ratings as evidence a consumer may consider. TrustHub does not select a winner. Statewide research remains /north-carolina.",
      ["Open North Carolina senior-care research.", "Show nursing homes in North Carolina."],
    );
  }
  if (
    /\b(charlotte|raleigh|mecklenburg|wake county)\b/i.test(q) &&
    /nursing home|assisted living|adult care|family care|senior/i.test(q) &&
    !/\bflorida\b|\bcharlotte county\b/i.test(q)
  ) {
    return fail(
      "SeniorTrustHub does not publish Charlotte, Raleigh, Mecklenburg, or Wake intelligence routes. Statewide North Carolina research remains /north-carolina. Ranking is unsupported.",
      ["Show nursing homes in North Carolina.", "Open North Carolina senior-care research."],
    );
  }
  const ohio =
    /\bohio\b/i.test(q) ||
    state?.value === "OH" ||
    (/\b(cleveland|columbus|cincinnati|toledo|akron|dayton)\b/i.test(q) &&
      /nursing home|assisted living|residential care|home health|hospice|senior|pace|adult day|navigator|rcf/i.test(
        q,
      ));
  const ohLicense = q.match(/\b(OHL\d{4,6}|OH\d{5})\b/i)?.[1];
  if (ohio && /residential care|\brcf\b/i.test(q)) {
    return fail(
      "Ohio Residential Care Facilities are the state-native assisted-living license class (OHL#####). They are not Nursing Homes and not a Medicaid waiver universe. Assisted living in consumer language maps to RCF research. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "PARTIAL",
    );
  }
  if (ohio && /navigator|quality measure|consumer satisfaction|satisfaction survey/i.test(q)) {
    return fail(
      "Ohio's Long-Term Care Quality Navigator publishes official quality and satisfaction comparison data. It is not a TrustHub score and is not AggregateRating. Facility-level Navigator grains remain search-only on this freeze. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (
    ohio &&
    /nursing home/i.test(q) &&
    /deficienc|inspection|survey|violation|complaint/i.test(q)
  ) {
    return fail(
      "Ohio nursing-home inspections, deficiencies, and complaints stay separate. An inspection is not a complaint. A deficiency is not a ranking. Bulk ODH inspection and complaint tables were not acquired; missing is not zero. Open the Ohio research page and official ODH lookup.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (
    ohio &&
    /assisted living|residential care|\brcf\b/i.test(q) &&
    /violation|inspection|complaint/i.test(q)
  ) {
    return fail(
      "Ohio RCF inspections, violations, and complaints stay separate. An inspection is not a complaint. Missing bulk is not zero. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (ohio && /home health/i.test(q)) {
    return fail(
      "Ohio Home Health is a state license class, not CMS Home Health. Skilled is not nonmedical. Agency is not a nonagency provider. Statewide bulk agency/nonagency extracts remain search-only through the ODH Facility Listing. Search-only is not zero. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (ohio && /\bhospice\b/i.test(q)) {
    return fail(
      "Ohio Hospice is a state program license, not Home Health and not a CMS Hospice CCN unless an exact source-published bridge exists (0 in this snapshot). License is not location. Bulk hospice roster remains search-only. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (ohio && /\bpace\b/i.test(q) && !/quality of pace/i.test(q)) {
    return fail(
      "Ohio PACE is a CMS/Medicaid program, not an ODH facility license and not a Residential Care Facility. Organization is not location. Roster remains search-only. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (/\bohio\b/i.test(q) && /adult day/i.test(q)) {
    return fail(
      "Ohio Adult Day is a program class, not a Nursing Home and not a Residential Care Facility. Statewide bulk remains search-only. Missing is not zero. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (ohio && /assisted living waiver|medicaid waiver/i.test(q)) {
    return fail(
      "Ohio Assisted Living Waiver participation is not an RCF license and is not a Nursing Home license. Waiver enrollment is not the Residential Care Facility universe. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (
    ohLicense &&
    (ohio || /\b(odh|licen[sc]e|facility id)\b/i.test(q) || /\bOHL?\d{4,6}\b/.test(q))
  ) {
    const kind = /^OHL/i.test(ohLicense)
      ? "Residential Care Facility license"
      : "nursing-home license";
    return fail(
      `Ohio identity ${ohLicense.toUpperCase()} is an ODH ${kind}. Confirm it on official ODH lookup. Exact state ID outranks geography. An ODH license is not a CMS CCN. Name-only matching is unsafe.`,
      ["Open Ohio senior-care research."],
      "PARTIAL",
    );
  }
  if (
    ohio &&
    /senior care/i.test(q) &&
    !/nursing home|assisted living|residential care|home health|hospice|adult day|pace|rcf|navigator/i.test(
      q,
    )
  ) {
    return fail(
      "Ohio senior care is class-specific. Nursing Home is not Residential Care Facility. Home Health is not Hospice. PACE is not a facility license. There is no combined Ohio senior-provider total. Open the Ohio research page.",
      ["Open Ohio senior-care research."],
      "PARTIAL",
    );
  }
  if (ohio && /\b(best|safest|top-rated|worst)\b/i.test(q)) {
    return fail(
      "SeniorTrustHub does not rank Ohio facilities and does not convert Navigator quality or satisfaction data into a TrustHub score. Ohio publishes regulatory, compliance, and quality information. CMS publishes federal measures. The state Navigator provides comparison data. TrustHub does not select a winner. Statewide research remains /ohio.",
      ["Open Ohio senior-care research.", "Show nursing homes in Ohio."],
    );
  }
  if (
    /\b(cleveland|columbus|cincinnati|toledo|akron|dayton)\b/i.test(q) &&
    /nursing home|assisted living|residential care|senior/i.test(q)
  ) {
    return fail(
      "SeniorTrustHub does not publish Cleveland, Columbus, Cincinnati, Toledo, Akron, or Dayton intelligence routes. Statewide Ohio research remains /ohio. Ranking is unsupported.",
      ["Show nursing homes in Ohio.", "Open Ohio senior-care research."],
    );
  }
  const georgia =
    /\bgeorgia\b/i.test(q) ||
    state?.value === "GA" ||
    (/\batlanta\b/i.test(q) &&
      /nursing|personal care|senior|hospice|home health|inspection|licen|adult day|community living/i.test(
        q,
      ));
  if (georgia && /personal care home/i.test(q)) {
    return fail(
      "Georgia Personal Care Homes are Chapter 111-8-62. They are not Assisted Living Communities and not CMS nursing homes. The current roster was not acquired. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (georgia && /community living/i.test(q)) {
    return fail(
      "Georgia Community Living Arrangements are Chapter 290-9-37 and are financially supported by DBHDD. They are not Personal Care Homes and not CMS nursing homes. The roster was not acquired. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (georgia && /adult day/i.test(q)) {
    return fail(
      "Georgia Adult Day Centers are Chapter 111-8-1. Adult day care is not adult day health, and neither is a Personal Care Home or a nursing home. The roster was not acquired. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (georgia && /private home care/i.test(q)) {
    return fail(
      "A Georgia Private Home Care Provider is a Chapter 111-8-65 license. It is not CMS Home Health. The roster was not acquired. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (georgia && /complaint/i.test(q)) {
    return fail(
      "Georgia provider-level complaint records were not acquired. The HFRD complaint form is an intake path, not a dataset. An inspection is not a complaint. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "REQUEST_ONLY",
    );
  }
  if (georgia && /inspection report|survey report/i.test(q)) {
    return fail(
      "HFRD inspection reports are searched on the official WebLink. TrustHub did not index or parse those reports. A retrieval date is not an inspection date. An inspection is not a complaint. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (georgia && /state licen[sc]e/i.test(q) && /home health|hospice|nursing home/i.test(q)) {
    return fail(
      "A Georgia state license is not a CMS CCN. State license rosters for nursing homes, Home Health, and Hospice were not acquired. CMS certification for that class remains a separate directory. Open the Georgia research page.",
      ["Open Georgia senior-care research.", "Show nursing homes in Georgia."],
      "NOT_ACQUIRED",
    );
  }
  if (georgia && /licen[sc]e number|by license|licensed in georgia/i.test(q)) {
    return fail(
      "Georgia license verification was not acquired as a roster. A license number is not a CMS CCN. Confirm licensure on the official HFRD finder. Name-only matching is not used. Open the Georgia research page.",
      ["Open Georgia senior-care research."],
      "NOT_ACQUIRED",
    );
  }
  if (
    /\batlanta\b/i.test(q) &&
    /nursing|personal care|senior|hospice|home health|assisted/i.test(q)
  ) {
    return fail(
      "Atlanta is a geography, not a Georgia license system. SeniorTrustHub does not publish an Atlanta intelligence route. Statewide Georgia research remains /georgia.",
      ["Show nursing homes in Georgia.", "Open Georgia senior-care research."],
      "UNSUPPORTED",
    );
  }
  if (
    georgia &&
    /senior care|georgia facilities|all georgia/i.test(q) &&
    !/nursing home|home health|hospice/i.test(q)
  ) {
    return fail(
      "Georgia senior care is class-specific. Personal Care Home is not Assisted Living Community is not Community Living Arrangement is not Adult Day. There is no combined Georgia senior-facility total. The department's 2,910 program statement and 357 long-term-care statement are not TrustHub counts. Open the Georgia research page.",
      ["Open Georgia senior-care research.", "Show nursing homes in Georgia."],
      "UNSUPPORTED",
    );
  }
  if (georgia && /\b(best|safest|top-rated|worst)\b/i.test(q)) {
    return fail(
      "SeniorTrustHub does not rank Georgia facilities. CMS publishes federal measures on certified providers. Georgia publishes state licensure through DCH HFRD. TrustHub does not select a winner. Statewide research remains /georgia.",
      ["Open Georgia senior-care research.", "Show nursing homes in Georgia."],
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

  // TH-DISCOVERY-PARITY-001B: a state-regulated class outside the CMS Nursing Home/Home
  // Health/Hospice trio (retirement community, independent living, adult day care, in-home
  // caregiving, elder care, board and care...) must never silently fall through to a
  // company-name/identity search just because detectClass() found no CMS keyword -- that produced
  // the "in-home caregiver Austin" / "elder care services" / "retirement community Boulder
  // Colorado" / "adult day care Palm Beach FL" production failures, all of which returned a bare
  // "No matching published provider record" with zero explanation. Only applies when no concrete
  // or ambiguous CMS class was already detected, and runs after every state-specific override
  // above so a Pennsylvania/Oregon/Illinois/New York/Virginia-specific message still wins for its
  // own state. Reuses the same "provider_class" clarification (and its existing, already-tested
  // real per-class preview rendering) that genuine Nursing/Home Health/Hospice ambiguity already
  // uses below, rather than "assisted living"/"memory care"'s separate, DB-free "state_care"
  // recovery-link contract, so a supported geography shows real broader CMS options instead of a
  // dead end.
  if (!providerClass) {
    const unsupportedLabel = unsupportedClassLabel;
    if (unsupportedLabel) {
      const place =
        geography?.type === "county"
          ? `${geography.value} County${geography.state ? `, ${geography.state}` : ""}`
          : geography?.type === "state"
            ? (STATE_NAMES[geography.value] ?? geography.value)
            : geography?.value
              ? [geography.value, geography.state].filter(Boolean).join(", ")
              : undefined;
      return validateSeniorResearchQuery({
        mode: "fail_closed",
        page: 1,
        providerClass: undefined,
        geography,
        locationRequirement: location.locationRequirement,
        clarification: "provider_class",
        terminalState: "UNSUPPORTED",
        coverageState: "UNSUPPORTED",
        failReason: `${unsupportedLabel} is state-regulated and is not part of the federal CMS Nursing Home, Home Health, or Hospice directory${place ? ` in ${place}` : ""}. SeniorTrustHub does not currently publish a dedicated ${unsupportedLabel.toLowerCase()} research source here. Choose a CMS-covered setting below to see current providers${place ? ` in ${place}` : ""}.`,
        alternatives: [],
      });
    }
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
  // "Memory care" is handled generally (any state) by the unsupportedSeniorClassLabel() check
  // above; the fields below are genuinely Florida AHCA extract-specific and stay scoped to Florida.
  if (/watch list|generator compliance|ccrc|fixed need pool/i.test(q)) {
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

  if (providerClass === "ambiguous" && !/\bhow many\b|\bcount\b|\bcompare\b/i.test(q)) {
    // TH-DISCOVERY-RESET-001B: this used to be a bare fail_closed with three literal re-query
    // suggestions (and those suggestions always said "in Florida", regardless of the actually
    // requested geography). It now sets the same "provider_class" clarification the dedicated
    // no-signal-at-all branch already uses (see interpretSeniorAskQuery below), so the existing
    // clarification UI's three class-choice buttons AND its real per-class provider previews
    // (senior-ask-execute.ts's classPreviews) render immediately -- no second click just to see
    // providers, and the requested geography is preserved rather than replaced with a fixed state.
    // A count/comparison request ("how many...", "compare...") has no listing to preview and keeps
    // its original bare fail_closed shape further below.
    const place =
      geography?.type === "county"
        ? `${geography.value} County${geography.state ? `, ${geography.state}` : ""}`
        : geography?.type === "state"
          ? (STATE_NAMES[geography.value] ?? geography.value)
          : geography?.value
            ? [geography.value, geography.state].filter(Boolean).join(", ")
            : undefined;
    return validateSeniorResearchQuery({
      mode: "fail_closed",
      page: 1,
      failReason:
        "“Senior care” is ambiguous. Nursing homes, Home Health and Hospice are separate CMS classes with different identifiers and evidence. Choose one class below — Ask will not silently query all three.",
      alternatives: place
        ? [
            `Show nursing homes in ${place}.`,
            `Show home health agencies in ${place}.`,
            `Show hospice providers in ${place}.`,
          ]
        : ["Show nursing homes in Florida."],
      clarification: "provider_class",
      terminalState: "NEEDS_CLARIFICATION",
      geography,
      locationRequirement: location.locationRequirement,
      coverageState: "UNSUPPORTED",
    });
  }
  if (providerClass === "ambiguous") {
    // A count/comparison request across an ambiguous class has no single listing to preview --
    // keep the original bare fail_closed shape (no clarification, no DB-backed previews).
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
      // Same parenthesis allowance as looksLikeProviderName() above, for the identical reason (a
      // real CMS-published name location disambiguator) -- kept as its own check, not merged into
      // that one, per the existing "two independent shape checks" design in this file.
      /^[a-z0-9][a-z0-9&'.,() -]{2,119}$/i.test(plausibleName) &&
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

function facilityQuestion(raw: string): SeniorResearchQuery | null {
  if (
    raw.trim().length > 180 ||
    /[<>;]|\b(?:best|safest|worst|assisted living|memory care)\b/i.test(raw)
  )
    return null;
  const q = raw
    .trim()
    .replace(/^(?:please\s+)?(?:(?:can|could|would) you (?:please )?tell me\s+|tell me\s+)?/i, "")
    .replace(/[?!.]+$/, "");
  let task: SeniorResearchQuery["facilityEvidence"], name: string | undefined;
  let m: RegExpMatchArray | null;
  if (
    (m =
      q.match(/^who (?:owns|operates|manages)\s+(.+)$/i) ??
      q.match(/^who is (?:the )?owner of\s+(.+)$/i))
  ) {
    task = "ownership";
    name = m[1];
  } else if (
    (m = q.match(
      /^(?:did|has)\s+(.+?)\s+(?:change[d]? owners|change[d]? ownership|have a change of ownership)$/i,
    ))
  ) {
    task = "chow";
    name = m[1];
  } else if (
    (m = q.match(
      /^(?:has|was)\s+(.+?)\s+(?:been )?(?:fined|penalized|had (?:any )?(?:fines|penalties))$/i,
    ))
  ) {
    task = "penalty";
    name = m[1];
  } else if (
    (m = q.match(
      /^(?:show |what are (?:the )?)?(ownership|chow|penalties|fines|inspections|deficiencies)\s+(?:for|of|at)\s+(.+)$/i,
    ))
  ) {
    task = /ownership/i.test(m[1]!)
      ? "ownership"
      : /chow/i.test(m[1]!)
        ? "chow"
        : /penalt|fine/i.test(m[1]!)
          ? "penalty"
          : /inspection/i.test(m[1]!)
            ? "inspection"
            : "deficiency";
    name = m[2];
  }
  const ccn = labeledCcn(q);
  if (!task && ccn)
    task = /\b(?:chow|change owners|change of ownership)\b/i.test(q)
      ? "chow"
      : /\b(?:owns|ownership|owner)\b/i.test(q)
        ? "ownership"
        : /\b(?:fined|fine|penalt)/i.test(q)
          ? "penalty"
          : /\binspection/i.test(q)
            ? "inspection"
            : /\bdeficien/i.test(q)
              ? "deficiency"
              : undefined;
  if (
    !task &&
    /\b(?:this|that|my|the)\s+(?:nursing home|facility|provider|home health agency|hospice|care home)\b/i.test(
      q,
    )
  ) {
    task = /\b(?:chow|change[ds]? (?:of )?owners?|change[ds]? (?:of )?ownership)\b/i.test(q)
      ? "chow"
      : /\b(?:owns?|ownership|owner)\b/i.test(q)
        ? "ownership"
        : /\b(?:fines?|fined|penalt|penalties|penalized)\b/i.test(q)
          ? "penalty"
          : /\binspection/i.test(q)
            ? "inspection"
            : /\bdeficien/i.test(q)
              ? "deficiency"
              : undefined;
  }
  if (!task) return null;
  if ((q.match(/\bccn\b/gi)?.length ?? 0) > 1 || detectClass(q) === "ambiguous")
    return validateSeniorResearchQuery({
      mode: "fail_closed",
      facilityEvidence: task,
      page: 1,
      terminalState: "NEEDS_CLARIFICATION",
      failReason:
        "Choose one provider identity and class for this evidence question. No provider evidence was attached.",
      alternatives: [],
    });
  const locationText = q.replace(/"[^"]*"/g, "");
  const location = /\b(?:in|near|within)\b/i.test(locationText)
    ? parseRecordedLocation(locationText)
    : {};
  const quotedName = name?.match(/^"([^"]+)"(?:\s+in\s+.+)?$/i)?.[1];
  name =
    quotedName ??
    name
      ?.split(/\s+(?:located )?in\s+/i)[0]
      ?.trim()
      .replace(/^"|"$/g, "");
  if (
    name &&
    /^(?:(?:this|that|the|my|a|an)\s+)?(?:nursing home|facility|provider|home health agency|hospice|nursing facility)$/i.test(
      name,
    )
  )
    name = undefined;
  const cls = detectClass(q);
  return validateSeniorResearchQuery({
    mode: ccn ? "identifier" : name ? "evidence" : "fail_closed",
    facilityEvidence: task,
    identifier: ccn ? { type: "ccn", value: ccn } : undefined,
    identityQuery: ccn ? undefined : name,
    providerClass: cls === "ambiguous" ? undefined : cls,
    ...location,
    status: "current",
    page: 1,
    coverageState: "PARTIAL",
    ...(!ccn && !name
      ? {
          clarification: "provider_identity" as const,
          terminalState: "NEEDS_CLARIFICATION" as const,
          failReason:
            "Which facility do you mean? Enter its provider name or labeled CMS CCN. No ownership or evidence was attached to an unspecified provider.",
          alternatives: [],
        }
      : {}),
  });
}

export function interpretSeniorAskQuery(raw: string, page = 1): SeniorResearchQuery {
  let plan = facilityQuestion(raw) ?? interpretSeniorAskQueryCore(raw, page);
  if (/assisted living|memory care/i.test(raw) && plan.mode === "fail_closed")
    plan = {
      ...plan,
      clarification: "state_care",
      alternatives: [],
      terminalState: "UNSUPPORTED",
      failReason: /memory care/i.test(raw)
        ? "Memory care is not a CMS provider class. The current Ask filter does not establish memory-care services; use the relevant state research and confirm the setting with its regulator."
        : plan.failReason,
    };
  if (
    !plan.facilityEvidence &&
    !plan.clarification &&
    !plan.identifier &&
    !detectClass(raw) &&
    /^(?:show |find )?(?:senior (?:care|homes?)|care)(?: in|$)/i.test(raw)
  )
    plan = {
      ...plan,
      mode: "fail_closed",
      identityQuery: undefined,
      clarification: "provider_class",
      terminalState: "NEEDS_CLARIFICATION",
      failReason:
        "Choose the care setting. Nursing homes, Home Health and Hospice are separate CMS classes; assisted living uses state-specific research.",
      alternatives: [],
    };
  const location = plan.facilityEvidence
    ? { geography: plan.geography, locationRequirement: plan.locationRequirement }
    : parseRecordedLocation(raw);
  const requestedClass = detectClass(raw);
  if (
    requestedClass &&
    requestedClass !== "ambiguous" &&
    plan.providerClass &&
    plan.providerClass !== requestedClass
  ) {
    return {
      ...plan,
      ...location,
      providerClass: requestedClass,
      mode: "fail_closed",
      terminalState: "UNSUPPORTED",
      failReason:
        "The requested evidence belongs to a different provider class. The original class and recorded location were retained; no nursing-home list was substituted.",
      alternatives: [],
    };
  }
  const explicitName =
    raw.match(/^(?:find|research|provider named)\s+"([^"]+)"/i)?.[1] ??
    raw.match(/^(?:find|research|provider named)\s+(.+?)(?:\s+in\s+|$)/i)?.[1];
  if (
    !plan.facilityEvidence &&
    plan.mode !== "fail_closed" &&
    explicitName &&
    raw.trim().length <= 180 &&
    !/\bCCN\b/i.test(explicitName) &&
    !/^(?:nursing homes?|nursing facilit(?:y|ies)|home health agencies?|hospice providers?|assisted living(?: facilities)?|adult foster homes?|residential care(?: facilities)?)$/i.test(
      explicitName,
    ) &&
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
  if (plan.mode === "fail_closed") {
    if (location.locationRequirement?.outcome === "APPLIED") {
      return {
        ...plan,
        geography: location.geography,
        locationRequirement: location.locationRequirement,
      };
    }
    return plan;
  }
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
