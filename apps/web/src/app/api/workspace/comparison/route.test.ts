import { beforeEach, describe, expect, it, vi } from "vitest";

const isFamilyComparisonWorkspaceEnabled = vi.fn();
const loadFamilyWorkspaceComparison = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/server/care/feature-flags", () => ({ isFamilyComparisonWorkspaceEnabled }));
vi.mock("@/server/care/family-workspace-repository", () => ({
  loadFamilyWorkspaceComparison,
}));

describe("workspace comparison API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    isFamilyComparisonWorkspaceEnabled.mockReturnValue(true);
    loadFamilyWorkspaceComparison.mockResolvedValue({
      version: "family-workspace-comparison-v1",
      facilities: [],
      differences: [],
    });
  });

  it("returns 404 when the flag is off", async () => {
    isFamilyComparisonWorkspaceEnabled.mockReturnValue(false);
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workspace/comparison", {
        method: "POST",
        body: JSON.stringify({ ccns: ["015009"] }),
      }),
    );
    expect(response.status).toBe(404);
    expect(loadFamilyWorkspaceComparison).not.toHaveBeenCalled();
  });

  it("accepts a POST body and does not put CCNs in the URL", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/workspace/comparison", {
        method: "POST",
        body: JSON.stringify({ ccns: ["015009", "015010"] }),
      }),
    );
    expect(response.status).toBe(200);
    expect(loadFamilyWorkspaceComparison).toHaveBeenCalledWith(["015009", "015010"], []);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
