import { describe, expect, it } from "vitest";
import { resolveSiteOrigin } from "./metadata";

describe("site metadata origin", () => {
  it("uses an explicit absolute HTTPS site URL", () => {
    expect(resolveSiteOrigin({ NEXT_PUBLIC_SITE_URL: "https://care.example.org" }).href).toBe(
      "https://care.example.org/",
    );
  });

  it("normalizes a scheme-free Vercel hostname to HTTPS", () => {
    expect(resolveSiteOrigin({ VERCEL_URL: "care-preview.vercel.app" }).href).toBe(
      "https://care-preview.vercel.app/",
    );
  });

  it("uses the localhost fallback when no configured origin exists", () => {
    expect(resolveSiteOrigin({}).href).toBe("http://localhost:3000/");
  });

  it("ignores a malformed explicit URL and uses the next valid origin", () => {
    expect(
      resolveSiteOrigin({
        NEXT_PUBLIC_SITE_URL: "not an absolute URL",
        VERCEL_PROJECT_PRODUCTION_URL: "care-production.vercel.app",
      }).href,
    ).toBe("https://care-production.vercel.app/");
  });
});
