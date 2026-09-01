import { describe, expect, it } from "vitest";
import { canonicalUrl, isPublicLaunchEnabled, publicRobots } from "./deployment";

describe("public launch isolation", () => {
  it("requires both Vercel Production and the explicit launch gate", () => {
    expect(
      isPublicLaunchEnabled({ VERCEL_ENV: "preview", CARE_ENABLE_PUBLIC_LAUNCH: "true" }),
    ).toBe(false);
    expect(isPublicLaunchEnabled({ VERCEL_ENV: "production" })).toBe(false);
    expect(
      isPublicLaunchEnabled({ VERCEL_ENV: "production", CARE_ENABLE_PUBLIC_LAUNCH: "true" }),
    ).toBe(true);
  });

  it("never emits Production canonicals or index directives before launch", () => {
    expect(
      canonicalUrl("/about", { VERCEL_ENV: "preview", CARE_ENABLE_PUBLIC_LAUNCH: "true" }),
    ).toBeUndefined();
    expect(
      publicRobots(true, { VERCEL_ENV: "preview", CARE_ENABLE_PUBLIC_LAUNCH: "true" }),
    ).toEqual({ index: false, follow: false });
  });

  it("uses the approved www canonical after launch", () => {
    const environment = { VERCEL_ENV: "production", CARE_ENABLE_PUBLIC_LAUNCH: "true" };
    expect(canonicalUrl("/about", environment)).toBe("https://www.seniortrusthub.com/about");
    expect(canonicalUrl("/home-health", environment)).toBe(
      "https://www.seniortrusthub.com/home-health",
    );
    expect(canonicalUrl("/hospice", environment)).toBe("https://www.seniortrusthub.com/hospice");
    expect(publicRobots(true, environment)).toEqual({ index: true, follow: true });
  });
});
