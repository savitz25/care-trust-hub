import { describe, expect, it, vi } from "vitest";
import {
  discoverGooglePlaceCandidates,
  getGooglePlaceDetails,
  GooglePlacesBudget,
  googlePlacesFieldMasks,
  smokeTestGooglePlaces,
  type GooglePlacesCache,
} from "./google-places";

vi.mock("server-only", () => ({}));

const environment = { GOOGLE_PLACES_API_KEY: "test-secret" };

describe("Google Places server adapter", () => {
  it("uses bounded candidate discovery and a deliberate field mask", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ places: [{ id: "test-place-id" }] }), { status: 200 }),
      );
    const result = await smokeTestGooglePlaces("test facility", {
      environment,
      fetchImplementation: request,
    });
    expect(result).toEqual({ placeId: "test-place-id" });
    const [, init] = request.mock.calls[0];
    expect(init?.headers).toMatchObject({ "X-Goog-FieldMask": googlePlacesFieldMasks.search });
    expect(init?.body).toBe(JSON.stringify({ textQuery: "test facility", maxResultCount: 1 }));
    expect(googlePlacesFieldMasks.search).not.toContain("websiteUri");
  });

  it("hard-stops dry runs and exhausted budgets before fetch", async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      discoverGooglePlaceCandidates("test", {
        environment,
        fetchImplementation: request,
        budget: new GooglePlacesBudget(1),
      }),
    ).rejects.toMatchObject({ code: "DRY_RUN" });
    const budget = new GooglePlacesBudget(1, false);
    request.mockResolvedValue(new Response(JSON.stringify({ places: [] }), { status: 200 }));
    await discoverGooglePlaceCandidates("first", {
      environment,
      fetchImplementation: request,
      budget,
    });
    await expect(
      discoverGooglePlaceCandidates("second", {
        environment,
        fetchImplementation: request,
        budget,
      }),
    ).rejects.toMatchObject({ code: "BUDGET_EXCEEDED" });
    expect(request).toHaveBeenCalledOnce();
  });

  it("reuses cache entries without spending a request", async () => {
    const values = new Map<string, unknown>();
    const cache: GooglePlacesCache = {
      get: vi.fn(async (_operation, key) => values.get(key) ?? null),
      set: vi.fn(async (_operation, key, value) => void values.set(key, value)),
    };
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ places: [{ id: "cached-place" }] }), { status: 200 }),
      );
    const budget = new GooglePlacesBudget(1, false);
    await discoverGooglePlaceCandidates("same query", {
      environment,
      fetchImplementation: request,
      cache,
      budget,
    });
    await discoverGooglePlaceCandidates("same query", {
      environment,
      fetchImplementation: request,
      cache,
      budget,
    });
    expect(request).toHaveBeenCalledOnce();
    expect(budget.usedRequests).toBe(1);
  });

  it("classifies retryable API errors without exposing response bodies or keys", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("secret detail", { status: 429 }));
    await expect(
      discoverGooglePlaceCandidates("test", {
        environment,
        fetchImplementation: request,
        retryLimit: 0,
      }),
    ).rejects.toMatchObject({ code: "RATE_LIMIT", retryable: true });
  });

  it("parses bounded details separately from discovery", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test-place-id",
          displayName: { text: "Synthetic Test Facility" },
          websiteUri: "https://example.invalid",
        }),
        { status: 200 },
      ),
    );
    const details = await getGooglePlaceDetails("test-place-id", {
      environment,
      fetchImplementation: request,
    });
    expect(details.website).toBe("https://example.invalid");
    expect(request.mock.calls[0][1]?.headers).toMatchObject({
      "X-Goog-FieldMask": googlePlacesFieldMasks.details,
    });
  });
});
