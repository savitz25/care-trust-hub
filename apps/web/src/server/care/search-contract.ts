import type { ConsumerProviderSearch } from "./types";

export interface ParsedConsumerSearch {
  criteria: ConsumerProviderSearch;
  errors: string[];
  submitted: boolean;
}

function text(params: URLSearchParams, key: string): string | undefined {
  const value = params.get(key)?.trim();
  return value || undefined;
}

function rating(params: URLSearchParams, key: string, errors: string[]): number | undefined {
  const value = text(params, key);
  if (!value) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    errors.push(`${key} rating must be between 1 and 5.`);
    return undefined;
  }
  return parsed;
}

function optionalBoolean(params: URLSearchParams, key: string): boolean | undefined {
  const value = text(params, key);
  if (value === "yes") return true;
  if (value === "no") return false;
  return undefined;
}

export function parseConsumerSearch(params: URLSearchParams): ParsedConsumerSearch {
  const errors: string[] = [];
  const state = text(params, "state")?.toUpperCase();
  const zip = text(params, "zip");
  if (state && !/^[A-Z]{2}$/.test(state)) errors.push("State must be a two-letter code.");
  if (zip && !/^\d{5}$/.test(zip)) errors.push("ZIP must contain five digits.");

  const radiusValue = text(params, "radius") ?? "25";
  const allowedRadii = [10, 25, 50, 100];
  const radiusMiles = Number(radiusValue);
  if (!allowedRadii.includes(radiusMiles))
    errors.push("Choose a 10, 25, 50, or 100 mile distance.");
  const pageValue = Number(text(params, "page") ?? "1");
  const page = Number.isInteger(pageValue) && pageValue > 0 ? pageValue : 1;

  const sortValue = text(params, "sort");
  const allowedSorts = ["name", "cms-overall-desc", "distance"] as const;
  const sort = allowedSorts.find((candidate) => candidate === sortValue) ?? undefined;
  if (sortValue && !sort) errors.push("The selected sort is not supported.");
  if (sort === "distance" && !zip) errors.push("Distance sorting requires a ZIP code.");

  return {
    submitted: params.get("search") === "1",
    errors,
    criteria: {
      query: text(params, "q"),
      state,
      city: text(params, "city"),
      zip,
      overallRating: rating(params, "overall", errors),
      staffingRating: rating(params, "staffing", errors),
      healthInspectionRating: rating(params, "inspection", errors),
      ownership: text(params, "ownership"),
      medicare: optionalBoolean(params, "medicare"),
      medicaid: optionalBoolean(params, "medicaid"),
      radiusMiles: zip ? radiusMiles : undefined,
      sort,
      limit: 21,
      offset: (page - 1) * 20,
    },
  };
}
