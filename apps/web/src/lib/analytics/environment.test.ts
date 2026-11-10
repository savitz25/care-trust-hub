import { afterEach, describe, expect, it } from "vitest";
import {
  analyticsEnvironment,
  bindAnalyticsEnvironment,
  posthogHost,
  shouldEnablePosthog,
} from "./environment";

describe("PostHog enablement", () => {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const debug = process.env.NEXT_PUBLIC_POSTHOG_DEBUG;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  afterEach(() => {
    if (key === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = key;
    if (debug === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_DEBUG;
    else process.env.NEXT_PUBLIC_POSTHOG_DEBUG = debug;
    if (host === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = host;
    bindAnalyticsEnvironment("development");
  });

  it("does nothing when the project key is missing", () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    bindAnalyticsEnvironment("production");
    expect(shouldEnablePosthog()).toBe(false);
    expect(posthogHost()).toBe("https://us.i.posthog.com");
  });

  it("does not send development events unless the debug flag is set", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    bindAnalyticsEnvironment("development");
    delete process.env.NEXT_PUBLIC_POSTHOG_DEBUG;
    expect(analyticsEnvironment()).toBe("development");
    expect(shouldEnablePosthog()).toBe(false);
    process.env.NEXT_PUBLIC_POSTHOG_DEBUG = "1";
    expect(shouldEnablePosthog()).toBe(true);
  });

  it("sends from preview and production when the key is present", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    bindAnalyticsEnvironment("preview");
    expect(shouldEnablePosthog()).toBe(true);
    bindAnalyticsEnvironment("production");
    expect(analyticsEnvironment()).toBe("production");
    expect(shouldEnablePosthog()).toBe(true);
  });
});
