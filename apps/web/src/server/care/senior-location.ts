import { STATE_NAMES } from "@care/domain";
import type { SeniorResearchQuery } from "./senior-ask-contract";

export const LOCATION_MEANING =
  "Recorded provider/office location, not service territory or service area, distance or availability.";
export const validState = (value: string) => Object.hasOwn(STATE_NAMES, value);
const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toUpperCase();
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
    // Existing state-first forms, e.g. "Florida nursing homes", remain supported.
    const hits = Object.entries(STATE_NAMES).filter(([, name]) =>
      new RegExp(`\\b${escape(name)}\\b`, "i").test(q),
    );
    if (hits.length === 1 && !/^(?:find|research|provider named)\b/i.test(q)) span = hits[0][1];
    else if (hits.length > 1) span = hits.map(([, name]) => name).join(" and ");
    else {
      const county = /\b(Broward|Palm Beach|Miami-Dade)\s*(?:County)?\b/i.exec(q);
      if (county) span = `${county[1]} County`;
    }
  }
  if (!span && !radius) return {};
  const requirement = { raw: span ?? radius![0], outcome: "NEEDS_CLARIFICATION" as const };
  if (radius || (clause && /^(?:around|near)\b/i.test(clause[0])))
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
  const establishedCounty = ["BROWARD", "PALM BEACH", "MIAMI-DADE"].includes(value);
  if (county && establishedCounty && state && state !== "FL")
    return {
      locationRequirement: {
        ...requirement,
        outcome: "CONFLICT",
        reason:
          "That county/state combination conflicts with the existing Florida county contract. Correct the location; it was not broadened.",
      },
    };
  if (county && !establishedCounty)
    return {
      locationRequirement: {
        ...requirement,
        outcome: "UNSUPPORTED",
        reason:
          "This county is not supported by the current county research contract. Choose a recorded city and state or explicitly search the state.",
      },
    };
  const jurisdiction = state ?? (county && establishedCounty ? "FL" : undefined);
  if (!jurisdiction)
    return {
      geography: { type: "city", value, meaning: LOCATION_MEANING },
      locationRequirement: {
        ...requirement,
        reason: `Choose the state for ${place}. The provider corpus does not establish that this city name is unique nationally.`,
      },
    };
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
