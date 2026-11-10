import { describe, expect, it } from "vitest";
import {
  isFreeTextQueryParam,
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

  it("redacts recording URLs with the same query rules", () => {
    const request = sanitizeCapturedNetworkRequest({
      name: "https://www.seniortrusthub.com/ask?q=licensed+memory+care",
    });
    expect(request.name).toBe("https://www.seniortrusthub.com/ask");
  });
});
