import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { auditEnvironment } from "./environment-audit";

describe("auditEnvironment", () => {
  it("reports names and status without returning values", () => {
    const secret = "do-not-return-this";
    const result = auditEnvironment({ CARE_DATABASE_URL: secret });

    expect(result.find((entry) => entry.name === "CARE_DATABASE_URL")?.status).toBe("present");
    expect(result.find((entry) => entry.name === "GOOGLE_PLACES_API_KEY")?.status).toBe("missing");
    expect(JSON.stringify(result)).not.toContain(secret);
  });

  it("classifies browser-visible variables explicitly", () => {
    const result = auditEnvironment({});
    expect(result.find((entry) => entry.name === "NEXT_PUBLIC_SITE_URL")?.scope).toBe("public");
    expect(result.find((entry) => entry.name === "SUPABASE_SERVICE_ROLE_KEY")?.scope).toBe(
      "server-only",
    );
  });
});
