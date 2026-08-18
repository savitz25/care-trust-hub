import "server-only";

const searchEndpoint = "https://places.googleapis.com/v1/places:searchText";
const SEARCH_FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
].join(",");
const DETAILS_FIELD_MASK = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "nationalPhoneNumber",
  "websiteUri",
  "businessStatus",
].join(",");

type GooglePlacesEnvironment = { GOOGLE_PLACES_API_KEY?: string };

export type GooglePlaceCandidate = {
  placeId: string;
  name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone?: string | null;
  website?: string | null;
  businessStatus?: string | null;
};

export type GooglePlaceSmokeResult = { placeId: string | null };
export type GooglePlacesOperation = "search" | "details";

export interface GooglePlacesCache {
  get(operation: GooglePlacesOperation, cacheKey: string): Promise<unknown | null>;
  set(
    operation: GooglePlacesOperation,
    cacheKey: string,
    value: unknown,
    expiresAt: Date,
  ): Promise<void>;
}

export class GooglePlacesBudget {
  private used = 0;

  constructor(
    readonly maximumRequests: number,
    readonly dryRun = true,
  ) {
    if (!Number.isInteger(maximumRequests) || maximumRequests < 0)
      throw new RangeError("Google Places request budget must be a non-negative integer");
  }

  get usedRequests(): number {
    return this.used;
  }

  reserve(): void {
    if (this.dryRun) throw new GooglePlacesError("DRY_RUN", "Dry run cannot call Google Places");
    if (this.used >= this.maximumRequests)
      throw new GooglePlacesError("BUDGET_EXCEEDED", "Google Places request budget exhausted");
    this.used += 1;
  }
}

export type GooglePlacesErrorCode =
  | "MISSING_CREDENTIAL"
  | "DRY_RUN"
  | "BUDGET_EXCEEDED"
  | "TIMEOUT"
  | "AUTHORIZATION"
  | "RATE_LIMIT"
  | "UPSTREAM"
  | "INVALID_RESPONSE";

export class GooglePlacesError extends Error {
  constructor(
    readonly code: GooglePlacesErrorCode,
    message: string,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "GooglePlacesError";
  }
}

export type GooglePlacesClientOptions = {
  environment?: GooglePlacesEnvironment;
  fetchImplementation?: typeof fetch;
  timeoutMs?: number;
  maximumCandidates?: number;
  budget?: GooglePlacesBudget;
  cache?: GooglePlacesCache;
  cacheTtlMs?: number;
  retryLimit?: number;
};

function cacheFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `v1-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function parseCandidate(value: unknown): GooglePlaceCandidate | null {
  if (!value || typeof value !== "object" || typeof (value as { id?: unknown }).id !== "string")
    return null;
  const place = value as Record<string, unknown>;
  const displayName = place.displayName as { text?: unknown } | undefined;
  const location = place.location as { latitude?: unknown; longitude?: unknown } | undefined;
  return {
    placeId: place.id as string,
    name: typeof displayName?.text === "string" ? displayName.text : null,
    address: typeof place.formattedAddress === "string" ? place.formattedAddress : null,
    latitude: typeof location?.latitude === "number" ? location.latitude : null,
    longitude: typeof location?.longitude === "number" ? location.longitude : null,
    phone: typeof place.nationalPhoneNumber === "string" ? place.nationalPhoneNumber : null,
    website: typeof place.websiteUri === "string" ? place.websiteUri : null,
    businessStatus: typeof place.businessStatus === "string" ? place.businessStatus : null,
  };
}

async function requestJson(
  url: string,
  fieldMask: string,
  init: RequestInit,
  options: GooglePlacesClientOptions,
): Promise<unknown> {
  const apiKey = options.environment?.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey?.trim())
    throw new GooglePlacesError("MISSING_CREDENTIAL", "Google Places server credential is missing");
  options.budget?.reserve();
  const retries = Math.max(0, Math.min(options.retryLimit ?? 1, 2));
  for (let attempt = 0; ; attempt += 1) {
    try {
      const response = await (options.fetchImplementation ?? fetch)(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": fieldMask,
        },
        signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
      });
      if (!response.ok) {
        const code =
          response.status === 401 || response.status === 403
            ? "AUTHORIZATION"
            : response.status === 429
              ? "RATE_LIMIT"
              : "UPSTREAM";
        const retryable = response.status === 429 || response.status >= 500;
        if (retryable && attempt < retries) continue;
        throw new GooglePlacesError(
          code,
          `Google Places request failed with status ${response.status}`,
          retryable,
        );
      }
      return await response.json();
    } catch (error) {
      if (error instanceof GooglePlacesError) throw error;
      if (error instanceof Error && error.name === "TimeoutError") {
        if (attempt < retries) continue;
        throw new GooglePlacesError("TIMEOUT", "Google Places request timed out", true);
      }
      throw new GooglePlacesError("UPSTREAM", "Google Places request failed", true);
    }
  }
}

export async function discoverGooglePlaceCandidates(
  textQuery: string,
  options: GooglePlacesClientOptions = {},
): Promise<GooglePlaceCandidate[]> {
  const query = textQuery.trim();
  if (!query) throw new RangeError("A non-empty text query is required");
  const maximumCandidates = Math.max(1, Math.min(options.maximumCandidates ?? 5, 10));
  const cacheKey = cacheFingerprint(
    `${query.toLowerCase()}|${maximumCandidates}|${SEARCH_FIELD_MASK}`,
  );
  const cached = await options.cache?.get("search", cacheKey);
  if (cached) return cached as GooglePlaceCandidate[];
  const payload = await requestJson(
    searchEndpoint,
    SEARCH_FIELD_MASK,
    {
      method: "POST",
      body: JSON.stringify({ textQuery: query, maxResultCount: maximumCandidates }),
    },
    options,
  );
  const places = (payload as { places?: unknown } | null)?.places;
  if (places !== undefined && !Array.isArray(places))
    throw new GooglePlacesError("INVALID_RESPONSE", "Google Places returned invalid candidates");
  const candidates = (Array.isArray(places) ? places : [])
    .map(parseCandidate)
    .filter((candidate): candidate is GooglePlaceCandidate => candidate !== null);
  await options.cache?.set(
    "search",
    cacheKey,
    candidates,
    new Date(Date.now() + (options.cacheTtlMs ?? 30 * 24 * 60 * 60 * 1000)),
  );
  return candidates;
}

export async function getGooglePlaceDetails(
  placeId: string,
  options: GooglePlacesClientOptions = {},
): Promise<GooglePlaceCandidate> {
  if (!/^[A-Za-z0-9_-]{8,255}$/.test(placeId)) throw new RangeError("Invalid Google Place ID");
  const cacheKey = cacheFingerprint(`${placeId}|${DETAILS_FIELD_MASK}`);
  const cached = await options.cache?.get("details", cacheKey);
  if (cached) return cached as GooglePlaceCandidate;
  const payload = await requestJson(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    DETAILS_FIELD_MASK,
    { method: "GET" },
    options,
  );
  const candidate = parseCandidate(payload);
  if (!candidate)
    throw new GooglePlacesError("INVALID_RESPONSE", "Google Places returned invalid details");
  await options.cache?.set(
    "details",
    cacheKey,
    candidate,
    new Date(Date.now() + (options.cacheTtlMs ?? 90 * 24 * 60 * 60 * 1000)),
  );
  return candidate;
}

export async function smokeTestGooglePlaces(
  textQuery: string,
  options: GooglePlacesClientOptions = {},
): Promise<GooglePlaceSmokeResult> {
  const candidates = await discoverGooglePlaceCandidates(textQuery, {
    ...options,
    maximumCandidates: 1,
  });
  return { placeId: candidates[0]?.placeId ?? null };
}

export const googlePlacesFieldMasks = {
  search: SEARCH_FIELD_MASK,
  details: DETAILS_FIELD_MASK,
} as const;
