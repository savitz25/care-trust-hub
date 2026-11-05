import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPublishedAssistedLivingProvider, isAssistedLivingIntelligenceEnabled } = vi.hoisted(
  () => ({
    getPublishedAssistedLivingProvider: vi.fn(),
    isAssistedLivingIntelligenceEnabled: vi.fn(),
  }),
);

vi.mock("@/server/care/assisted-living-publication", () => ({
  getPublishedAssistedLivingProvider,
}));
vi.mock("@/server/care/feature-flags", () => ({ isAssistedLivingIntelligenceEnabled }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { GET } from "./route";

const providerId = "d1659a77-2841-47ba-a13d-a85144bfeb70";

function call(id: string, state = "ca") {
  return GET(new Request(`https://www.seniortrusthub.com/assisted-living/${state}/${id}`), {
    params: Promise.resolve({ providerId: id }),
  });
}

describe("slugless assisted-living URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAssistedLivingIntelligenceEnabled.mockReturnValue(true);
  });

  it("returns 404 when assisted-living intelligence is off and does not query", async () => {
    isAssistedLivingIntelligenceEnabled.mockReturnValue(false);
    await expect(call(providerId)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getPublishedAssistedLivingProvider).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-uuid and does not query", async () => {
    await expect(call("not-a-uuid")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getPublishedAssistedLivingProvider).not.toHaveBeenCalled();
  });

  it("301s an existing provider to the current slug, including a wrong state segment", async () => {
    getPublishedAssistedLivingProvider.mockResolvedValue({
      id: providerId,
      stateCode: "CA",
      officialName: "1 Duarte Care",
    });
    const response = await call(providerId, "tx");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      `https://www.seniortrusthub.com/assisted-living/ca/${providerId}/1-duarte-care`,
    );
    expect(getPublishedAssistedLivingProvider).toHaveBeenCalledWith(providerId);
  });

  it("returns 410 when a valid provider id is not published", async () => {
    getPublishedAssistedLivingProvider.mockResolvedValue(null);
    const response = await call("00000000-0000-4000-8000-000000000000");
    expect(response.status).toBe(410);
    expect(response.headers.get("location")).toBeNull();
  });

  it("propagates a database error instead of reporting the provider gone", async () => {
    getPublishedAssistedLivingProvider.mockRejectedValue(new Error("timeout"));
    await expect(call(providerId)).rejects.toThrow("timeout");
  });
});
