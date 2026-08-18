import { describe, expect, it, vi } from "vitest";
import { smokeTestGooglePlaces } from "./google-places";

vi.mock("server-only", () => ({}));

describe("smokeTestGooglePlaces", () => {
  it("uses a bounded, minimal server request and parses a place ID", async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ places: [{ id: "test-place-id" }] }), { status: 200 }),
      );
    const result = await smokeTestGooglePlaces("test facility", {
      environment: { GOOGLE_PLACES_API_KEY: "test-secret" },
      fetchImplementation: request,
    });

    expect(result).toEqual({ placeId: "test-place-id" });
    expect(request).toHaveBeenCalledOnce();
    const [, init] = request.mock.calls[0];
    expect(init?.headers).toMatchObject({ "X-Goog-FieldMask": "places.id" });
    expect(init?.body).toBe(JSON.stringify({ textQuery: "test facility", maxResultCount: 1 }));
  });

  it("does not include provider errors or credentials in failures", async () => {
    await expect(
      smokeTestGooglePlaces("test facility", {
        environment: { GOOGLE_PLACES_API_KEY: "test-secret" },
        fetchImplementation: vi
          .fn<typeof fetch>()
          .mockResolvedValue(new Response("detail", { status: 403 })),
      }),
    ).rejects.toThrow("Google Places request failed with status 403");
  });
});
