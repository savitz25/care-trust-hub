import { beforeEach, describe, expect, it, vi } from "vitest";

const getProviderByCcnForPage = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("./cached-repository", () => ({ getProviderByCcnForPage }));

describe("public facility route CCN resolution", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each(["55305", "55305/x", "1234567", "01-193", ""])(
    "rejects malformed CCN %j before querying",
    async (ccn) => {
      const { getFacilityRouteProvider } = await import("./facility-route");
      await expect(getFacilityRouteProvider(ccn)).resolves.toBeNull();
      expect(getProviderByCcnForPage).not.toHaveBeenCalled();
    },
  );

  it.each(["012345", "55305A", "01a193"])(
    "preserves supported six-character identifier %s",
    async (ccn) => {
      getProviderByCcnForPage.mockResolvedValue({ ccn: ccn.toUpperCase() });
      const { getFacilityRouteProvider } = await import("./facility-route");
      await expect(getFacilityRouteProvider(ccn)).resolves.toEqual({
        ccn: ccn.toUpperCase(),
      });
      expect(getProviderByCcnForPage).toHaveBeenCalledWith(ccn.toUpperCase());
    },
  );

  it("returns null for a valid but absent provider", async () => {
    getProviderByCcnForPage.mockResolvedValue(null);
    const { getFacilityRouteProvider } = await import("./facility-route");
    await expect(getFacilityRouteProvider("55305A")).resolves.toBeNull();
    expect(getProviderByCcnForPage).toHaveBeenCalledWith("55305A");
  });

  it.each([
    new Error("database connection refused"),
    new Error("query timed out"),
    new TypeError("unexpected mapping failure"),
  ])("propagates database and unexpected errors", async (error) => {
    getProviderByCcnForPage.mockRejectedValue(error);
    const { getFacilityRouteProvider } = await import("./facility-route");
    await expect(getFacilityRouteProvider("55305A")).rejects.toBe(error);
  });
});
