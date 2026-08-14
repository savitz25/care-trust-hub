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

  const coordinateValues = [text(params, "lat"), text(params, "lon"), text(params, "radius")];
  const hasCoordinate = coordinateValues.some(Boolean);
  const hasAllCoordinates = coordinateValues.every(Boolean);
  let latitude: number | undefined;
  let longitude: number | undefined;
  let radiusMiles: number | undefined;
  if (hasCoordinate && !hasAllCoordinates) {
    errors.push("Latitude, longitude, and radius are required together.");
  } else if (hasAllCoordinates) {
    latitude = Number(coordinateValues[0]);
    longitude = Number(coordinateValues[1]);
    radiusMiles = Number(coordinateValues[2]);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
      errors.push("Latitude is invalid.");
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
      errors.push("Longitude is invalid.");
    if (!Number.isFinite(radiusMiles) || radiusMiles <= 0 || radiusMiles > 250)
      errors.push("Radius must be between 0 and 250 miles.");
  }

  const sortValue = text(params, "sort");
  const allowedSorts = ["name", "cms-overall-desc", "distance"] as const;
  const sort = allowedSorts.find((candidate) => candidate === sortValue) ?? undefined;
  if (sortValue && !sort) errors.push("The selected sort is not supported.");
  if (sort === "distance" && !hasAllCoordinates)
    errors.push("Distance sorting requires coordinates and a radius.");

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
      latitude,
      longitude,
      radiusMiles,
      sort,
      limit: 25,
    },
  };
}
