import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CareChainIntelligence } from "@/server/care/types";

const { getChainIntelligence, isChainIntelligenceEnabled } = vi.hoisted(() => ({
  getChainIntelligence: vi.fn(),
  isChainIntelligenceEnabled: vi.fn(),
}));

vi.mock("@/server/care/chain-repository", () => ({ getChainIntelligence }));
vi.mock("@/server/care/feature-flags", () => ({ isChainIntelligenceEnabled }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import { GET } from "./route";

const chain = {
  cmsChainId: "175",
  current: {
    releaseMonth: "2026-09-01",
    chainName: "Cypress Healthcare Group",
    facilityCount: 4,
    stateCount: 2,
    metrics: {},
  },
  history: [],
  facilities: [],
  source: {
    datasetIdentifier: "cms-chain-performance",
    versionIdentifier: "2026-09",
    officialUrl: "https://data.cms.gov/",
    sourceModifiedAt: null,
    retrievedAt: "2026-10-01T00:00:00.000Z",
  },
  membershipSource: {
    datasetIdentifier: "cms-chain-membership",
    sourceModifiedAt: null,
    retrievedAt: "2026-10-01T00:00:00.000Z",
  },
} satisfies CareChainIntelligence;

function call(chainId: string) {
  return GET(new Request(`https://www.seniortrusthub.com/chain/${chainId}`), {
    params: Promise.resolve({ chainId }),
  });
}

describe("slugless chain URLs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isChainIntelligenceEnabled.mockReturnValue(true);
  });

  it("returns 404 when chain intelligence is off and does not query", async () => {
    isChainIntelligenceEnabled.mockReturnValue(false);
    await expect(call("175")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getChainIntelligence).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed chain id and does not query", async () => {
    await expect(call("bad-id")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(call("123x")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(getChainIntelligence).not.toHaveBeenCalled();
  });

  it("301s an existing chain, including chain 175, to the current slug", async () => {
    getChainIntelligence.mockResolvedValue(chain);
    const response = await call("175");
    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://www.seniortrusthub.com/chain/175/cypress-healthcare-group",
    );
    expect(getChainIntelligence).toHaveBeenCalledWith("175");
  });

  it("returns 410 when a numeric chain id has no current record", async () => {
    getChainIntelligence.mockResolvedValue(null);
    const response = await call("999999");
    expect(response.status).toBe(410);
    expect(response.headers.get("location")).toBeNull();
  });

  it("propagates a database error instead of reporting the chain gone", async () => {
    getChainIntelligence.mockRejectedValue(new Error("timeout"));
    await expect(call("175")).rejects.toThrow("timeout");
  });
});
