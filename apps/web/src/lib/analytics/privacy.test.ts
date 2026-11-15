import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isFreeTextQueryParam,
  isReplayEvent,
  stripElementsChainText,
  redactSensitiveParamsInText,
  sanitizeAnalyticsRequestBody,
  sanitizeAnalyticsUrl,
  sanitizeCaptureResult,
  sanitizeCapturedNetworkRequest,
  suppressExceptionCapture,
} from "./privacy";
import { analyticsBrowserOptOut } from "./environment";

describe("analytics URL sanitizer", () => {
  it("strips q and keeps structured filters", () => {
    expect(
      sanitizeAnalyticsUrl(
        "https://www.seniortrusthub.com/ask?q=memory%20care%20for%20my%20mother&state=FL&class=nursing_home&utm_source=newsletter",
      ),
    ).toBe("https://www.seniortrusthub.com/ask?state=FL&class=nursing_home&utm_source=newsletter");
  });

  it("strips free-text and health query params from any key", () => {
    const url = sanitizeAnalyticsUrl(
      "https://www.seniortrusthub.com/search?diagnosis=dementia&notes=fell+last+week&city=Palm+Beach&zip=33401&topic=needs+help+bathing",
    );
    expect(url).toBe("https://www.seniortrusthub.com/search?zip=33401");
    expect(url).not.toMatch(/dementia|fell|Palm|bathing|notes|diagnosis|city/i);
  });

  it("strips hashes, credentials, and relative search text", () => {
    expect(sanitizeAnalyticsUrl("/ask?q=who+helps+with+medication#notes")).toBe("/ask");
    expect(sanitizeAnalyticsUrl("https://user:secret@www.seniortrusthub.com/ask?q=secret")).toBe(
      "https://www.seniortrusthub.com/ask",
    );
  });

  it("treats q as free text even when the value is short", () => {
    expect(isFreeTextQueryParam("q", "FL")).toBe(true);
    expect(isFreeTextQueryParam("state", "FL")).toBe(false);
    expect(isFreeTextQueryParam("ref", "needs help at home")).toBe(true);
  });

  it("sanitizes current, entry, referrer, and pathname before send", () => {
    const event = sanitizeCaptureResult({
      event: "$pageview",
      properties: {
        token: "phc_test_token",
        distinct_id: "anon-1",
        $current_url: "https://www.seniortrusthub.com/ask?q=secret+question&state=TX",
        $session_entry_url: "https://www.google.com/search?q=nursing+home+for+dementia",
        $referrer: "https://www.google.com/?q=hospice+near+me",
        $pathname: "/ask?q=secret+question",
        $input_value: "secret question",
        query: "secret question",
        email: "person@example.com",
        diagnosis: "dementia",
        hub: "senior",
      },
    });
    const properties = event.properties as Record<string, unknown>;
    expect(properties.token).toBe("phc_test_token");
    expect(properties.distinct_id).toBe("anon-1");
    expect(properties.$current_url).toBe("https://www.seniortrusthub.com/ask?state=TX");
    expect(properties.$session_entry_url).toBe("https://www.google.com/search");
    expect(properties.$referrer).toBe("https://www.google.com/");
    expect(properties.$pathname).toBe("/ask");
    expect(properties.$input_value).toBeUndefined();
    expect(properties.query).toBeUndefined();
    expect(properties.email).toBeUndefined();
    expect(properties.diagnosis).toBeUndefined();
    expect(properties.hub).toBe("senior");
    expect(properties.$title).toBe("Senior care research");
    expect(JSON.stringify(event)).not.toMatch(/secret|dementia|person@example/i);
  });

  it("keeps a valid capture when there is nothing sensitive to remove", () => {
    const event = sanitizeCaptureResult({
      event: "search_submitted",
      properties: { token: "phc_test_token", hub: "senior", surface: "specialist_search" },
    });
    expect(event.event).toBe("search_submitted");
    expect(event.properties?.token).toBe("phc_test_token");
    expect(event.properties?.surface).toBe("specialist_search");
  });

  it("strips q and other search text from the autocapture elements chain", () => {
    const chain =
      'a:attr__href="/ask?q=memory+care+for+mom&state=FL&diagnosis=dementia":href="/search?q=who+helps&class=nursing_home"';
    const encoded =
      "a:attr__href=&quot;/ask?q=secret+question&amp;state=TX&amp;notes=fell+last+week&quot;";
    const event = sanitizeCaptureResult({
      event: "$autocapture",
      properties: {
        token: "phc_test_token",
        distinct_id: "anon-1",
        $elements_chain: chain,
        $elements: [{ href: "/ask?q=memory+care+for+mom&state=FL" }],
      },
    });
    const properties = event.properties as Record<string, unknown>;
    const cleaned = properties.$elements_chain as string;
    expect(cleaned).toContain("q=[redacted]");
    expect(cleaned).toContain("diagnosis=[redacted]");
    expect(cleaned).toContain("state=FL");
    expect(cleaned).toContain("class=nursing_home");
    expect(cleaned).not.toMatch(/memory|mom|dementia|who\+helps/i);
    expect(properties.$elements).toEqual([{ href: "/ask?state=FL" }]);
    expect(redactSensitiveParamsInText(encoded)).toContain("q=[redacted]");
    expect(redactSensitiveParamsInText(encoded)).toContain("notes=[redacted]");
    expect(redactSensitiveParamsInText(encoded)).toContain("state=TX");
    expect(redactSensitiveParamsInText(encoded)).not.toMatch(/secret|fell/i);
    expect(JSON.stringify(event)).not.toMatch(/memory|mom|dementia/i);
  });

  it("redacts recording URLs with the same query rules", () => {
    const request = sanitizeCapturedNetworkRequest({
      name: "https://www.seniortrusthub.com/ask?q=licensed+memory+care",
    });
    expect(request.name).toBe("https://www.seniortrusthub.com/ask");
  });
});

describe("autocapture and replay privacy (Vercel Agent findings)", () => {
  const RAW = "memory care near my mom in boca raton";

  it("drops element text and query-bearing attributes from a refinement or pagination click", () => {
    const event = sanitizeCaptureResult({
      event: "$autocapture",
      properties: {
        token: "phc_test_token",
        $current_url: `https://www.seniortrusthub.com/search?q=${encodeURIComponent(RAW)}&state=FL`,
        $el_text: RAW,
        $elements_chain: `a.page-link:attr__href="/search?q=${encodeURIComponent(RAW)}&page=2"text="${RAW}"nth-child="1";nav:attr__aria-label="${RAW}"nth-child="2"`,
        $elements: [
          {
            tag_name: "a",
            $el_text: RAW,
            text: RAW,
            attr__href: `/search?q=${encodeURIComponent(RAW)}&page=2`,
            attr__class: "page-link",
          },
          { tag_name: "nav", "attr__aria-label": RAW, attr__title: RAW },
        ],
      },
    });
    expect(event.properties?.$el_text).toBeUndefined();
    const serialized = JSON.stringify(event);
    expect(serialized).not.toMatch(/memory|boca|raton/i);
    expect(String(event.properties?.$elements_chain)).toContain("page=2");
    const elements = event.properties?.$elements as Array<Record<string, unknown>>;
    expect(elements[0].attr__class).toBe("page-link");
  });

  it("strips chain text with escaped quotes", () => {
    expect(
      stripElementsChainText('a.x:attr__href="/s"text="a \\"b\\""nth-child="2";p:text="s"'),
    ).toBe('a.x:attr__href="/s"nth-child="2";p:');
  });

  it("custom search events carry no raw search text", () => {
    const event = sanitizeCaptureResult({
      event: "search_results_returned",
      properties: {
        token: "phc_test_token",
        surface: "search",
        result_count: 7,
        q: RAW,
        query: RAW,
        search: RAW,
      },
    });
    expect(JSON.stringify(event)).not.toMatch(/boca/i);
    expect(event.properties?.result_count).toBe(7);
  });

  it("recognizes replay payloads and the browser client disables replay and network bodies", () => {
    expect(isReplayEvent("$snapshot")).toBe(true);
    expect(isReplayEvent("$pageview")).toBe(false);
    const source = readFileSync(path.join(__dirname, "posthog-browser.ts"), "utf8");
    expect(source).toMatch(/disable_session_recording:\s*true/);
    expect(source).toMatch(/mask_all_text:\s*true/);
    expect(source).toMatch(/maskAllInputs:\s*true/);
    expect(source).toMatch(/recordBody:\s*false/);
    expect(source).toMatch(/isReplayEvent\(event\.event\)\) return null/);
  });

  it("sends no $exception events", () => {
    const dropped = suppressExceptionCapture({
      event: "$exception",
      properties: {
        $exception_list: [{ type: "Error", value: "memory care for my mother" }],
        $exception_message: "memory care for my mother",
      },
    });
    expect(dropped).toBeNull();

    const pageview = suppressExceptionCapture({
      event: "$pageview",
      properties: { $pathname: "/privacy", $exception_list: [{ type: "Error" }] },
    });
    expect(pageview?.event).toBe("$pageview");
    expect(pageview?.properties && "$exception_list" in pageview.properties).toBe(false);

    const source = readFileSync(path.join(__dirname, "posthog-browser.ts"), "utf8");
    expect(source).toMatch(/capture_exceptions:\s*false/);
    expect(source).toMatch(/suppressExceptionCapture\(event\)/);
    expect(source).toMatch(/respect_dnt:\s*true/);
    expect(source).toMatch(/capture_copied_text:\s*false/);
    expect(source).toMatch(/capture_value_css_selector_allowlist:\s*\[\]/);
    expect(source).toMatch(/disable_session_recording:\s*true/);
  });

  it("opts out for Do Not Track or blocked cookies", () => {
    const previous = globalThis.navigator;
    try {
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { doNotTrack: "1", cookieEnabled: true, userAgent: "Mozilla/5.0 Chrome" },
      });
      expect(analyticsBrowserOptOut()).toBe(true);
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { doNotTrack: "0", cookieEnabled: false, userAgent: "Mozilla/5.0 Chrome" },
      });
      expect(analyticsBrowserOptOut()).toBe(true);
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: { doNotTrack: "0", cookieEnabled: true, userAgent: "Mozilla/5.0 Chrome" },
      });
      expect(analyticsBrowserOptOut()).toBe(false);
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {
          doNotTrack: "0",
          cookieEnabled: true,
          globalPrivacyControl: true,
          userAgent: "Mozilla/5.0 Chrome",
        },
      });
      expect(analyticsBrowserOptOut()).toBe(true);
    } finally {
      Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
    }
  });

  it("drops email, search, and auth fields from identify, pageview, and custom events", () => {
    const secret = "memory care for my mother";
    const email = "person@example.com";
    const identify = sanitizeCaptureResult({
      event: "$identify",
      properties: {
        distinct_id: email,
        email,
        $email: email,
        password: "hunter2-secret",
        access_token: "auth-secret-value",
        otp: "998877",
        q: secret,
        search: secret,
        $ip: "203.0.113.10",
        $current_url: `https://www.seniortrusthub.com/ask?q=${encodeURIComponent(secret)}&access_token=abc&email=${encodeURIComponent(email)}&state=FL`,
        $set: { email, name: "Pat Example", search: secret },
      },
      $set: { email, password: "hunter2-secret", search: secret },
    });
    const identifyJson = JSON.stringify(identify);
    expect(identifyJson.includes(email)).toBe(false);
    expect(identifyJson.includes(secret)).toBe(false);
    expect(identifyJson.includes("hunter2-secret")).toBe(false);
    expect(identifyJson.includes("auth-secret-value")).toBe(false);
    expect(identifyJson.includes("998877")).toBe(false);
    expect(identifyJson.includes("203.0.113.10")).toBe(false);
    expect(identify?.properties?.$geoip_disable).toBe(true);
    expect(identify?.properties?.$ip).toBeUndefined();
    expect(String(identify?.properties?.$current_url)).toMatch(/state=FL/);
    expect(String(identify?.properties?.$current_url).includes("q=")).toBe(false);

    const pageview = sanitizeCaptureResult(
      suppressExceptionCapture({
        event: "$pageview",
        properties: {
          $current_url: `https://www.seniortrusthub.com/search?q=${encodeURIComponent(secret)}&email=${encodeURIComponent(email)}&state=FL`,
          $exception_message: secret,
          $exception_list: [{ type: "Error", value: secret }],
        },
      })!,
    );
    const pageJson = JSON.stringify(pageview);
    expect(pageview?.event).toBe("$pageview");
    expect(pageJson.includes(secret)).toBe(false);
    expect(pageJson.includes(email)).toBe(false);
    expect(pageview?.properties?.$geoip_disable).toBe(true);

    const custom = sanitizeCaptureResult({
      event: "search_submitted",
      properties: {
        surface: "ask_form",
        success: true,
        stateCode: "FL",
        query: secret,
        email,
        password: "hunter2-secret",
      },
    });
    expect(custom?.properties?.surface).toBe("ask_form");
    expect(custom?.properties?.success).toBe(true);
    expect(custom?.properties?.stateCode).toBe("FL");
    const customJson = JSON.stringify(custom);
    expect(customJson.includes(secret)).toBe(false);
    expect(customJson.includes(email)).toBe(false);
    expect(customJson.includes("hunter2-secret")).toBe(false);
  });
});

describe("sdk privacy 002", () => {
  it("strips auth properties, adversarial urls, and private attributes", () => {
    const urls = [
      "https://qa.invalid/?state=qa%40example.invalid",
      "https://qa.invalid/?state=qa%2540example.invalid",
      "https://qa.invalid/?custom=%E0%A4%A",
      "https://qa.invalid/?custom=qa%40example.invalid",
      "https://qa.invalid/?auth_code=123456",
      "https://qa.invalid/?redirect_uri=https%3A%2F%2Ftarget.invalid%2F%3Fcode%3D123456",
      "https://qa.invalid/search/qa%40example.invalid",
    ];
    for (const input of urls) {
      const output = sanitizeAnalyticsUrl(input) || "";
      expect(decodeURIComponent(output)).not.toContain("qa@example");
      expect(decodeURIComponent(output)).not.toContain("123456");
    }
    const event = sanitizeCaptureResult({
      event: "$autocapture",
      properties: {
        code: "123456",
        auth_code: "654321",
        stateCode: "FL",
        $elements_chain: 'button:attr__data-note="PRIVATE_NOTE"attr__id="safe"attr_id="safe"',
        $elements: [
          {
            tag_name: "button",
            "attr__data-note": "PRIVATE_NOTE",
            attr__id: "safe",
            attr_id: "safe",
          },
        ],
      },
    });
    const json = JSON.stringify(event);
    expect(json).not.toContain("123456");
    expect(json).not.toContain("654321");
    expect(json).not.toContain("PRIVATE_");
    expect(event?.properties?.stateCode).toBe("FL");
    expect(event?.properties?.$geoip_disable).toBe(true);
  });
});

describe("sdk privacy 003", () => {
  it("strips encoded urls, fragments, and nested flag fields", () => {
    const urls = [
      "https://qa.invalid/search?%2571=eldercare-sensitive-query",
      "https://qa.invalid/search?redirect_uri=https%3A%2F%2Ftarget.invalid%2F%3FauthCode%3DAuthZ9x7",
      "https://qa.invalid/search?%2570assword=PwdZ9x7",
      "https://qa.invalid/search?searchTerm=eldercare-sensitive-query",
      "https://qa.invalid/search#access_token=AuthZ9x7",
    ];
    for (const input of urls) {
      const output = sanitizeAnalyticsUrl(input) || "";
      expect(output).not.toMatch(/eldercare-sensitive-query|AuthZ9x7|PwdZ9x7/);
    }
    expect(sanitizeAnalyticsUrl("https://qa.invalid/auth/callback?code=ab&state=FL") || "").toMatch(
      /state=FL/,
    );
    const body = sanitizeAnalyticsRequestBody(
      JSON.stringify({
        token: "phc_test",
        distinct_id: "visitor",
        person_properties: {
          query: "eldercare-sensitive-query",
          question: "family-sensitive-question",
          search: "treatment-sensitive-search",
          token: "AuthZ9x7",
          password: "PwdZ9x7",
          email: "alex@example.invalid",
          $lib: "web",
        },
      }),
    );
    expect(body).toBeTruthy();
    expect(body).toContain("phc_test");
    expect(body).toContain('"$lib":"web"');
    expect(body).not.toMatch(
      /eldercare-sensitive-query|family-sensitive-question|treatment-sensitive-search|AuthZ9x7|PwdZ9x7|alex@/,
    );
  });
});
