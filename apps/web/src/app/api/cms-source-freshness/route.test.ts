import { beforeEach, describe, expect, it, vi } from "vitest";

const loadCmsSourceFreshness = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/server/care/cms-source-freshness", () => ({ loadCmsSourceFreshness }));

describe("cms source freshness API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns per-source rows and no global last-updated value", async () => {
    loadCmsSourceFreshness.mockResolvedValue([
      { datasetKey: "nursing-home-provider-information", freshnessBand: "CURRENT" },
    ]);
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.globalLastUpdated).toBeNull();
    expect(body.sources).toHaveLength(1);
    expect(body.version).toBe("cms-source-freshness-v1");
  });

  it("returns 503 when the freshness view is not queryable", async () => {
    loadCmsSourceFreshness.mockRejectedValue(new Error("relation does not exist"));
    const { GET } = await import("./route");
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.sources).toEqual([]);
    expect(body.globalLastUpdated).toBeNull();
  });
});
