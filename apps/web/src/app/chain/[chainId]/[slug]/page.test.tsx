import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  permanentRedirect: (href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  },
}));

import ChainPage, { generateMetadata } from "./page";

const chain = {
  cmsChainId: "123456",
  current: {
    releaseMonth: "2026-09-01",
    chainName: "Example Care Group",
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

describe("chain route metadata and 404 behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isChainIntelligenceEnabled.mockReturnValue(true);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("CARE_ENABLE_PUBLIC_LAUNCH", "true");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("keeps valid chain research metadata, its self-canonical, and H1", async () => {
    getChainIntelligence.mockResolvedValue(chain);
    const metadata = await generateMetadata({ params: Promise.resolve({ chainId: "123456" }) });
    const page = await ChainPage({
      params: Promise.resolve({ chainId: "123456", slug: "example-care-group" }),
    });

    expect(metadata.title).toBe("Example Care Group Nursing Home Chain Research");
    expect(metadata.alternates?.canonical).toBe(
      "https://www.seniortrusthub.com/chain/123456/example-care-group",
    );
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(page.type).toBe("main");
  });

  it.each(["bad-id", "123x"])(
    "returns clean noindex metadata and a real 404 for malformed ID %s without a database read",
    async (chainId) => {
      const metadata = await generateMetadata({ params: Promise.resolve({ chainId }) });

      expect(metadata.title).toBe("Chain not found");
      expect(metadata.alternates?.canonical).toBeNull();
      expect(metadata.robots).toEqual({ index: false, follow: false });
      expect(metadata.openGraph).toMatchObject({ title: "Chain not found", images: [] });
      expect(metadata.twitter).toMatchObject({ title: "Chain not found", images: [] });
      await expect(
        ChainPage({ params: Promise.resolve({ chainId, slug: "nope" }) }),
      ).rejects.toThrow("NEXT_NOT_FOUND");
      expect(getChainIntelligence).not.toHaveBeenCalled();
    },
  );

  it("returns clean noindex metadata and a real 404 for a confirmed missing chain", async () => {
    getChainIntelligence.mockResolvedValue(null);
    const metadata = await generateMetadata({ params: Promise.resolve({ chainId: "999999" }) });

    expect(metadata.title).toBe("Chain not found");
    expect(metadata.alternates?.canonical).toBeNull();
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({ title: "Chain not found", images: [] });
    expect(metadata.twitter).toMatchObject({ title: "Chain not found", images: [] });
    await expect(
      ChainPage({ params: Promise.resolve({ chainId: "999999", slug: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("propagates database errors instead of rendering a false 404", async () => {
    const timeout = new Error("database statement timeout");
    getChainIntelligence.mockRejectedValue(timeout);

    await expect(
      generateMetadata({ params: Promise.resolve({ chainId: "123456" }) }),
    ).rejects.toBe(timeout);
    await expect(
      ChainPage({ params: Promise.resolve({ chainId: "123456", slug: "example-care-group" }) }),
    ).rejects.toBe(timeout);
  });

  it("uses noindex fallback metadata when chain research is disabled", async () => {
    isChainIntelligenceEnabled.mockReturnValue(false);

    const metadata = await generateMetadata({ params: Promise.resolve({ chainId: "123456" }) });

    expect(metadata.alternates?.canonical).toBeNull();
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.openGraph).toMatchObject({ title: "Chain not found", images: [] });
    expect(getChainIntelligence).not.toHaveBeenCalled();
    await expect(
      ChainPage({ params: Promise.resolve({ chainId: "123456", slug: "nope" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
