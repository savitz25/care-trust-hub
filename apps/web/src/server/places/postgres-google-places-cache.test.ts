import { describe, expect, it, vi } from "vitest";
import { PostgresGooglePlacesCache } from "./postgres-google-places-cache";

vi.mock("server-only", () => ({}));

describe("PostgresGooglePlacesCache", () => {
  it("reads only unexpired cache rows and persists key-safe fingerprints", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ response_payload: [{ placeId: "cached" }] }] })
      .mockResolvedValueOnce({ rows: [] });
    const cache = new PostgresGooglePlacesCache({ query });
    await expect(cache.get("search", "opaque-cache-key")).resolves.toEqual([{ placeId: "cached" }]);
    await cache.set(
      "details",
      "opaque-cache-key",
      { placeId: "cached" },
      new Date(Date.now() + 1_000),
    );
    expect(query).toHaveBeenCalledTimes(2);
    const writeValues = query.mock.calls[1][1];
    expect(writeValues[2]).toMatch(/^[0-9a-f]{64}$/);
    expect(writeValues[3]).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(query.mock.calls)).not.toContain("GOOGLE_PLACES_API_KEY");
  });
});
