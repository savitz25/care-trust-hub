import { afterEach, describe, expect, it } from "vitest";
import {
  analyticsEnvironment,
  bindAnalyticsEnvironment,
  isAutomatedClient,
  posthogHost,
  shouldEnablePosthog,
} from "./environment";

const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0";

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
    expect(shouldEnablePosthog({ webdriver: false, userAgent: CHROME })).toBe(true);
    bindAnalyticsEnvironment("production");
    expect(analyticsEnvironment()).toBe("production");
    expect(shouldEnablePosthog({ webdriver: false, userAgent: CHROME })).toBe(true);
  });

  it("does not initialize or capture for webdriver or bot user agents", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    process.env.NEXT_PUBLIC_POSTHOG_DEBUG = "1";
    bindAnalyticsEnvironment("production");
    const automated = [
      { webdriver: true, userAgent: CHROME },
      { webdriver: false, userAgent: "Mozilla/5.0 HeadlessChrome/120.0" },
      { webdriver: false, userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      { webdriver: false, userAgent: "Mozilla/5.0 Playwright" },
      { webdriver: false, userAgent: "curl/8.7.1" },
    ];
    for (const client of automated) {
      expect(isAutomatedClient(client)).toBe(true);
      expect(shouldEnablePosthog(client)).toBe(false);
    }
    expect(isAutomatedClient({ webdriver: false, userAgent: CHROME })).toBe(false);
    expect(shouldEnablePosthog({ webdriver: false, userAgent: CHROME })).toBe(true);
    bindAnalyticsEnvironment("development");
    expect(shouldEnablePosthog({ webdriver: true, userAgent: CHROME })).toBe(false);
  });
});
