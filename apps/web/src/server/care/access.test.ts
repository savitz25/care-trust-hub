import { describe, expect, it } from "vitest";
import { isDevelopmentDataEnabled } from "./access";

describe("development data protection", () => {
  it("requires explicit opt-in outside production", () => {
    expect(
      isDevelopmentDataEnabled({ NODE_ENV: "development", CARE_ENABLE_DEVELOPMENT_DATA: "true" }),
    ).toBe(true);
    expect(isDevelopmentDataEnabled({ NODE_ENV: "development" })).toBe(false);
  });

  it("cannot be enabled in production", () => {
    expect(
      isDevelopmentDataEnabled({ NODE_ENV: "production", CARE_ENABLE_DEVELOPMENT_DATA: "true" }),
    ).toBe(false);
  });
});
