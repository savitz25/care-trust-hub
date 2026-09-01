import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

let route: typeof import("./route");

beforeAll(async () => {
  route = await import("./route");
});

describe("Senior specialist execution V2 HTTP contract", () => {
  it("returns the typed capability manifest when no query is supplied", async () => {
    const response = await route.GET(
      new Request("https://www.seniortrusthub.com/api/specialist-execution/v2"),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      contract: "trusthub-specialist-execution-v2",
      hub: "senior",
      canReturnRows: true,
    });
  });

  it("distinguishes unsupported Home Health county geography from malformed input", async () => {
    const response = await route.POST(
      new Request("https://www.seniortrusthub.com/api/specialist-execution/v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerClass: "home_health",
          geography: { type: "county", value: "Palm Beach" },
        }),
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      status: "unsupported_capability",
      errorCode: "unsupported_home_health_county_geography",
      providerClass: "home_health",
    });
  });

  it("rejects malformed JSON without exposing backend details", async () => {
    const response = await route.POST(
      new Request("https://www.seniortrusthub.com/api/specialist-execution/v2", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      status: "invalid_request",
      errorCode: "invalid_json",
    });
  });
});
