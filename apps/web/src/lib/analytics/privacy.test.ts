import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isFreeTextQueryParam,
  isReplayEvent,
  stripElementsChainText,
  redactSensitiveParamsInText,
  sanitizeAnalyticsUrl,
  sanitizeCaptureResult,
  sanitizeCapturedNetworkRequest,
} from "./privacy";

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
});
