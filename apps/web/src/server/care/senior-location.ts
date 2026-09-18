import { STATE_NAMES } from "@care/domain";
import type { SeniorResearchQuery } from "./senior-ask-contract";

export const LOCATION_MEANING =
  "Recorded provider/office location, not service territory or service area, distance or availability.";
/**
 * TH-DISCOVERY-RESET-001: verified against the real live CMS-backed corpus (via production
 * queries with an explicit state) to have zero real current provider record under any other
 * state's same city name, so silently assuming FL never hides or misattributes a genuine
 * different-state identity. This is deliberately a much shorter list than AskTrustHub's
 * florida-municipality-crosswalk.ts -- "Miami" (real Miami, OK nursing home), "Jacksonville"
 * (real Jacksonville, NC nursing home), and "Clearwater" (real Clearwater, KS nursing home) are
 * genuinely ambiguous in the actual corpus and must keep requiring an explicit state; "Tampa"
 * looked risky (a real "Tampa, KS" exists) but the live corpus has zero current provider there.
 */
const ESTABLISHED_FL_CITIES = new Set([
  "TAMPA",
  "BOCA RATON",
  "ORLANDO",
  "ST PETERSBURG",
  "ST. PETERSBURG",
  "SAINT PETERSBURG",
  "FORT LAUDERDALE",
  "WEST PALM BEACH",
  "HIALEAH",
]);
export const validState = (value: string) => Object.hasOwn(STATE_NAMES, value);
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * TH-DISCOVERY-PARITY-001B: counties whose state the existing Florida county contract already
 * establishes without an explicit state token. Every OTHER county is now supported too, but its
 * state is resolved from the real indexed corpus at execution time (see resolveCountyGeography in
 * senior-ask-execute.ts) rather than being rejected outright or silently assumed.
 */
export const ESTABLISHED_FL_COUNTIES = ["BROWARD", "PALM BEACH", "MIAMI-DADE"];

/**
 * TH-DISCOVERY-PARITY-001B: care-setting, intent and filler words that must never be absorbed into
 * a recorded place name when a query states its location WITHOUT a preposition ("senior care homes
 * Newark NJ"). Deliberately excludes ordinary place components (Village, Beach, Springs, Park,
 * Gardens, Heights, Fort, Saint...) so real multi-word municipalities such as "Greenwood Village"
 * or "Palm Beach Gardens" still parse as one place.
 */
const PLACE_STOPWORDS = new Set(
  `senior seniors care cares caregiver caregivers caretaker caregiving nursing nurse home homes
   housing health healthcare hospice facility facilities agency agencies provider providers
   assisted living memory retirement independent adult day daycare elder elderly respite
   community communities residence residences apartment apartments placement rehab rehabilitation
   skilled snf hha alf ccrc board group service services setting settings option options
   show find list research see get need want looking look best safest worst top cheap affordable
   near nearby around within in at on for of the a an my me we us and or with without
   medicare medicaid cms certified licensed rated star stars help please`
    .split(/\s+/)
    .filter(Boolean),
);

/**
 * TH-DISCOVERY-PARITY-001B: a location stated without any preposition. The prior parser only ever
 * extracted a location from an explicit "in/near/around <place>" clause, a full state NAME anywhere
 * in the string, or one of three hardcoded Florida counties. Everything else -- "senior care homes
 * Newark NJ", "nursing home Sacramento County", "hospice TX" -- yielded NO geography at all, and the
 * executor then ran an UNFILTERED NATIONAL query, which is the direct cause of the cross-state
 * preview leakage and the single wrong-state county result this ticket blocks. A trailing span is
 * only accepted when it carries a real disambiguating signal: a state token (two-letter code matched
 * case-sensitively so prose "in"/"or" is never read as Indiana/Oregon, or a full state name) or the
 * word "county". Bare trailing words are never guessed at as places.
 */
function trailingPlaceSpan(q: string): string | undefined {
  if (/^\s*(?:find|research|provider named)\b/i.test(q)) return undefined;
  const bare = (value: string) => value.replace(/^[(",]+|[).,;:"']+$/g, "");
  const tokens = q
    .replace(/[?!]+\s*$/, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length < 2) return undefined;
  let end = tokens.length;
  let stateToken: string | undefined;
  // A bare two-letter candidate is only ever read as a state code when it was actually typed in
  // upper case; otherwise ordinary lowercase prose ("in", "or", "on"...) would be misread as a
  // state postal code. Multi-word/full-name candidates stay case-insensitive, matching resolveState
  // elsewhere in this module.
  for (let take = Math.min(2, end); take >= 1; take -= 1) {
    const candidate = tokens
      .slice(end - take, end)
      .map(bare)
      .join(" ");
    if (candidate.length === 2 && !/^[A-Z]{2}$/.test(candidate)) continue;
    const resolved = resolveState(candidate);
    if (resolved) {
      stateToken = resolved;
      end -= take;
      break;
    }
  }
  const countyKeyword = end > 0 && /^count(?:y|ies)$/i.test(bare(tokens[end - 1]!));
  if (countyKeyword) end -= 1;
  if (!stateToken && !countyKeyword) return undefined;
  const place: string[] = [];
  for (let i = end - 1; i >= 0 && place.length < 3; i -= 1) {
    const token = bare(tokens[i]!);
    if (!/^[\p{L}][\p{L}'.-]*$/u.test(token)) break;
    if (PLACE_STOPWORDS.has(token.toLowerCase())) break;
    place.unshift(token);
  }
  if (!place.length) return countyKeyword ? undefined : stateToken;
  return [place.join(" "), countyKeyword ? "County" : undefined, stateToken]
    .filter(Boolean)
    .join(" ");
}

/** State codes are recognized as tokens in a location span, not ordinary words in prose. */
export function resolveState(value: string): string | undefined {
  const text = normalize(value);
  return validState(text)
    ? text
    : Object.keys(STATE_NAMES).find((code) => normalize(STATE_NAMES[code]) === text);
}

export function parseRecordedLocation(
  raw: string,
): Pick<SeniorResearchQuery, "geography" | "locationRequirement"> {
  const q = raw.replace(/"[^"]*"/g, "");
  const radius =
    /\b(?:near me|near my|within\s+\d+|\d+\s*(?:mile|km)|radius|nearby|serving|service area)\b/i.exec(
      q,
    );
  const clause =
    /\b(?:in|located in|offices in|around|near)\s+(.+?)(?=\s+(?:with|having|rated|that|whose|sorted|ordered)\b|[?!]|$)/i.exec(
      q,
    );
  let span = clause?.[1]?.trim().replace(/[.]+$/, "");
  if (!span) {
    // Existing state-first forms, e.g. "Florida nursing homes", remain supported. A state NAME
    // immediately followed by "County"/"Counties" (e.g. "Washington County", "New York County") is
    // excluded here -- several state names are also real, distinct county names in other states,
    // and "County" right after the word is an unambiguous signal the user means the county, not the
    // state itself. Letting the bare state-name match win there silently discarded the county and
    // any state that followed it (see the general county resolver below).
    const hits = Object.entries(STATE_NAMES).filter(([, name]) =>
      new RegExp(`\\b${escape(name)}\\b(?!\\s+Count(?:y|ies)\\b)`, "i").test(q),
    );
    if (hits.length === 1 && !/^(?:find|research|provider named)\b/i.test(q)) span = hits[0][1];
    else if (hits.length > 1) span = hits.map(([, name]) => name).join(" and ");
    else {
      // TH-DISCOVERY-PARITY-001B: the general no-preposition resolver below must run BEFORE the
      // narrow legacy Florida-county-name regex here. The legacy regex captures only "Broward" /
      // "Palm Beach" / "Miami-Dade" and silently discards anything after it -- given "Broward
      // County TX" it used to drop "TX" entirely and default straight to FL, which is exactly the
      // silent wrong-state behavior this ticket blocks. The general resolver correctly keeps a
      // trailing conflicting state (surfacing the real CONFLICT below) or a trailing "County"
      // keyword for any county name, not just Florida's three. The legacy regex remains only as a
      // last resort for a truly bare county name with no "County" word and no state at all (e.g.
      // "nursing homes Broward"), which the general resolver deliberately never guesses at.
      span = trailingPlaceSpan(q);
      if (!span) {
        const county = /\b(Broward|Palm Beach|Miami-Dade)\s*(?:County)?\b/i.exec(q);
        if (county) span = `${county[1]} County`;
      }
    }
  }
  if (!span && !radius) return {};
  const requirement = { raw: span ?? radius![0], outcome: "NEEDS_CLARIFICATION" as const };
  // TH-DISCOVERY-RESET-001: "near <place>" and "around <place>" are ordinary ways to phrase a
  // location-bound provider search ("hospice near Tampa" means the same thing as "hospice in
  // Tampa" to a consumer) and resolve to the exact same recorded-location grain, with the exact
  // same "not service territory/availability" disclaimer -- they must not be treated as an
  // unsupported radius/proximity claim just because of the preposition. Only genuine
  // radius/proximity phrasing (near me, within N miles, a bare radius, nearby, serving/service
  // area) asks for something this source truly cannot establish and stays UNSUPPORTED.
  if (radius)
    return {
      locationRequirement: {
        ...requirement,
        outcome: "UNSUPPORTED",
        reason:
          "Recorded addresses do not establish radius, proximity or service territory. Choose a city and state to research recorded locations.",
      },
    };
  if (
    /\b(?:and|versus|vs)\b|\/|;|\d/i.test(span!) ||
    (/\bor\b/i.test(span!) && !/[ ,]OR$/.test(span!))
  )
    return {
      locationRequirement: {
        ...requirement,
        reason: "Choose one recorded city/state or use the supported county comparison.",
      },
    };
  const stateOnly = resolveState(span!);
  if (stateOnly)
    return {
      geography: { type: "state", value: stateOnly, meaning: LOCATION_MEANING },
      locationRequirement: { raw: span!, outcome: "APPLIED" },
    };
  const matches = Object.entries(STATE_NAMES).flatMap(([code, name]) =>
    [code, name]
      .filter((label) => new RegExp(`(?:^|[ ,])${escape(label)}$`, "i").test(span!))
      .map((label) => ({ code, label })),
  );
  const state = matches[0]?.code;
  const place = (state ? span!.slice(0, span!.length - matches[0].label.length) : span!)
    .replace(/[,\s]+$/, "")
    .trim();
  if (!place || !/^[\p{L}][\p{L} .'-]{0,79}$/u.test(place))
    return {
      locationRequirement: {
        ...requirement,
        reason: "Enter one city and its state, for example City, ST.",
      },
    };
  if (
    state &&
    Object.entries(STATE_NAMES).some(
      ([code, name]) =>
        new RegExp(`.+[ ,]${escape(name)}$`, "i").test(place) ||
        new RegExp(`.+[ ,]${code}$`).test(place),
    )
  )
    return {
      locationRequirement: {
        ...requirement,
        outcome: "CONFLICT",
        reason:
          "More than one state was supplied. Choose one city and state; no location was discarded.",
      },
    };
  const county = /\s+county$/i.test(place);
  const value = normalize(place.replace(/\s+county$/i, ""));
  const establishedCounty = ESTABLISHED_FL_COUNTIES.includes(value);
  if (county && establishedCounty && state && state !== "FL")
    return {
      locationRequirement: {
        ...requirement,
        outcome: "CONFLICT",
        reason:
          "That county/state combination conflicts with the existing Florida county contract. Correct the location; it was not broadened.",
      },
    };
  // TH-DISCOVERY-RESET-001: mirrors the established-county precedent immediately above -- a small,
  // checked-in set of Florida cities whose state is not genuinely ambiguous (same cities
  // AskTrustHub's shared florida-municipality-crosswalk.ts already resolves) should not dead-end
  // asking the consumer to type "FL" when real recorded provider evidence is one query away.
  const establishedCity = !county && ESTABLISHED_FL_CITIES.has(value);
  const jurisdiction =
    state ??
    (county && establishedCounty ? "FL" : undefined) ??
    (establishedCity ? "FL" : undefined);
  if (!jurisdiction) {
    if (county) {
      // TH-DISCOVERY-PARITY-001B: every other county is now supported too -- an explicit state was
      // not given, so the real state is resolved from the indexed corpus at execute time (see
      // resolveCountyGeography in senior-ask-execute.ts) instead of being rejected outright or
      // silently defaulted to Florida. Most county names are unique nationally; the rare ones that
      // are not get a NEEDS_CLARIFICATION asking for the state explicitly, never a guess.
      return {
        geography: { type: "county", value, meaning: LOCATION_MEANING },
        locationRequirement: { raw: span!, outcome: "APPLIED" },
      };
    }
    return {
      geography: { type: "city", value, meaning: LOCATION_MEANING },
      locationRequirement: {
        ...requirement,
        reason: `Choose the state for ${place}. The provider corpus does not establish that this city name is unique nationally.`,
      },
    };
  }
  return {
    geography: {
      type: county ? "county" : "city",
      value,
      state: jurisdiction,
      meaning: LOCATION_MEANING,
    },
    locationRequirement: { raw: span!, outcome: "APPLIED" },
  };
}
