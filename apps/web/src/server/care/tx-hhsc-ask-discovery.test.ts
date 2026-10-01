import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/server/care/senior-ask-execute", () => ({
  executeSeniorRequest: vi.fn(async () => ({
    contract: "test",
    query: { mode: "entity", page: 1 },
    interpretation: [],
    entities: [],
    resultType: "provider",
    pagination: { page: 1 },
  })),
}));

const old = {
  VERCEL_ENV: process.env.VERCEL_ENV,
  VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
  VERCEL_GIT_REPO_OWNER: process.env.VERCEL_GIT_REPO_OWNER,
  VERCEL_GIT_REPO_SLUG: process.env.VERCEL_GIT_REPO_SLUG,
};

afterEach(() => {
  for (const [key, value] of Object.entries(old)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Texas location Ask discovery", () => {
  it("discloses every matching location for the distinctive Educare name prefix", async () => {
    Object.assign(process.env, {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "th-tx-senior-ask-discovery-r2",
      VERCEL_GIT_REPO_OWNER: "savitz25",
      VERCEL_GIT_REPO_SLUG: "care-trust-hub",
    });
    const { GET } = await import("@/app/api/ask/route");
    const response = await GET(
      new Request("https://test.invalid/api/ask?q=Educare%20Community%20Living"),
    );
    const payload = await response.json();
    expect(payload.terminalState).toBe("NEEDS_CLARIFICATION");
    expect(payload.resultType).toBe("ambiguous_provider_name");
    expect(payload.count.n).toBe(131);
    expect(payload.results).toHaveLength(20);
    expect(payload.pagination.hasMore).toBe(true);
    expect(payload.ambiguity).toContain("Showing the first 20");
    expect(
      payload.results.every(
        (row: { identity: string; organizationLinkage: string }) =>
          row.identity.startsWith("TX|HHSC|") && row.organizationLinkage === "Not established",
      ),
    ).toBe(true);
  }, 15000);

  it("returns a bare published name at regulated-location grain and preserves CMS class selection", async () => {
    Object.assign(process.env, {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "th-tx-senior-ask-discovery-p1",
      VERCEL_GIT_REPO_OWNER: "savitz25",
      VERCEL_GIT_REPO_SLUG: "care-trust-hub",
    });
    const { GET } = await import("@/app/api/ask/route");
    const response = await GET(
      new Request("https://test.invalid/api/ask?q=KIRBYVILLE%20GROUP%20HOME"),
    );
    const payload = await response.json();
    expect(payload.terminalState).toBe("COMPLETE");
    expect(payload.resultType).toBe("regulated_location");
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0]).toMatchObject({
      identity: "TX|HHSC|TX_ICF_IID|003906",
      providerClass: "TX_ICF_IID",
      organizationLinkage: "Not established",
    });
    expect(payload.results[0].href).toContain("/texas/regulated-locations/");
    const punctuationResponse = await GET(
      new Request("https://test.invalid/api/ask?q=kirbyville%2C%20group-home"),
    );
    const punctuation = await punctuationResponse.json();
    expect(punctuation.resultType).toBe("regulated_location");
    expect(punctuation.results[0].identity).toBe("TX|HHSC|TX_ICF_IID|003906");
    const cmsResponse = await GET(
      new Request("https://test.invalid/api/ask?q=KIRBYVILLE%20GROUP%20HOME&class=nursing_home"),
    );
    expect((await cmsResponse.json()).resultType).not.toBe("regulated_location");
    const downHomeResponse = await GET(
      new Request("https://test.invalid/api/ask?q=Down%20Home%20Ranch"),
    );
    const downHome = await downHomeResponse.json();
    expect(downHome.resultType).toBe("regulated_location");
    expect(downHome.results[0].identity).toBe("TX|HHSC|TX_DAHS|110993");
  }, 15000);

  it("discloses multiple Texas locations with one name", async () => {
    Object.assign(process.env, {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "th-tx-senior-ask-discovery-p1",
      VERCEL_GIT_REPO_OWNER: "savitz25",
      VERCEL_GIT_REPO_SLUG: "care-trust-hub",
    });
    const { GET } = await import("@/app/api/ask/route");
    const response = await GET(
      new Request(
        "https://test.invalid/api/ask?q=EDUCARE%20COMMUNITY%20LIVING%20LIMITED%20PARTNERSHIP",
      ),
    );
    const payload = await response.json();
    expect(payload.terminalState).toBe("NEEDS_CLARIFICATION");
    expect(payload.count.n).toBeGreaterThan(1);
    expect(payload.ambiguity).toContain("Multiple Texas HHSC locations");
  });

  it("discloses an exact same-name CMS provider in another state without merging identities", async () => {
    Object.assign(process.env, {
      VERCEL_ENV: "preview",
      VERCEL_GIT_COMMIT_REF: "th-tx-senior-ask-discovery-p1",
      VERCEL_GIT_REPO_OWNER: "savitz25",
      VERCEL_GIT_REPO_SLUG: "care-trust-hub",
    });
    const { executeSeniorRequest } = await import("@/server/care/senior-ask-execute");
    vi.mocked(executeSeniorRequest).mockResolvedValueOnce({
      entities: [
        {
          providerName: "Kirbyville Group Home",
          providerClass: "nursing_home",
          recordedLocation: { city: "Test", state: "LA" },
          href: "/facility/cms/123456/test",
        },
      ],
    } as Awaited<ReturnType<typeof executeSeniorRequest>>);
    const { GET } = await import("@/app/api/ask/route");
    const response = await GET(
      new Request("https://test.invalid/api/ask?q=KIRBYVILLE%20GROUP%20HOME"),
    );
    const payload = await response.json();
    expect(payload.terminalState).toBe("NEEDS_CLARIFICATION");
    expect(payload.resultType).toBe("ambiguous_provider_name");
    expect(payload.otherMatches[0].recordedLocation.state).toBe("LA");
    expect(payload.results[0].identity).toBe("TX|HHSC|TX_ICF_IID|003906");
  }, 15000);
});
