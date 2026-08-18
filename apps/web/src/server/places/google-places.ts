import "server-only";

const endpoint = "https://places.googleapis.com/v1/places:searchText";

type GooglePlacesEnvironment = { GOOGLE_PLACES_API_KEY?: string };

export type GooglePlaceSmokeResult = { placeId: string | null };

export async function smokeTestGooglePlaces(
  textQuery: string,
  options: {
    environment?: GooglePlacesEnvironment;
    fetchImplementation?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<GooglePlaceSmokeResult> {
  const apiKey = options.environment?.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey?.trim()) throw new Error("GOOGLE_PLACES_API_KEY is required for server requests");
  if (!textQuery.trim()) throw new Error("A non-empty text query is required");

  const response = await (options.fetchImplementation ?? fetch)(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id",
    },
    body: JSON.stringify({ textQuery, maxResultCount: 1 }),
    signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
  });

  if (!response.ok) throw new Error(`Google Places request failed with status ${response.status}`);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object")
    throw new Error("Google Places returned invalid JSON");
  const places = (payload as { places?: unknown }).places;
  if (places !== undefined && !Array.isArray(places)) {
    throw new Error("Google Places returned an invalid places collection");
  }
  const first = Array.isArray(places) ? places[0] : undefined;
  const placeId =
    first && typeof first === "object" && typeof (first as { id?: unknown }).id === "string"
      ? (first as { id: string }).id
      : null;
  return { placeId };
}
