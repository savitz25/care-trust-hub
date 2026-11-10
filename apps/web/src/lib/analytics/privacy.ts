/**
 * SeniorTrustHub analytics privacy.
 * Raw search text, health free text, and contact fields never leave the browser.
 */

import { analyticsEnvironment, TRUSTHUB_HUB } from "./environment";

const FREE_TEXT_QUERY_KEYS = [
  "q",
  "query",
  "question",
  "text",
  "prompt",
  "name",
  "city",
  "note",
  "notes",
  "body",
  "message",
  "description",
  "diagnosis",
  "symptom",
  "symptoms",
  "condition",
  "conditions",
  "medication",
  "medications",
  "meds",
  "comment",
  "comments",
  "concern",
  "concerns",
  "details",
  "narrative",
  "health",
  "email",
  "token",
  "code",
  "password",
  "phone",
  "ssn",
  "address",
  "otp",
  "handoff",
  "auth_error",
  "error",
  "error_code",
  "error_description",
  "error_uri",
  "access_token",
  "refresh_token",
  "session",
  "file",
  "ccn",
] as const;

const FREE_TEXT_QUERY_KEY_PATTERN =
  /token|email|password|note|error|handoff|secret|otp|diagnos|symptom|medic|health|ssn|phone|comment|narrative|question|query|prompt/i;

const STRUCTURED_VALUE = /^[A-Za-z0-9_.:~-]{1,120}$/;

const FORBIDDEN_EVENT_KEYS = [
  "q",
  "query",
  "question",
  "text",
  "prompt",
  "email",
  "name",
  "first_name",
  "last_name",
  "phone",
  "address",
  "ssn",
  "password",
  "token",
  "authorization",
  "cookie",
  "ccn",
  "nmls",
  "usdot",
  "crd",
  "note",
  "notes",
  "body",
  "message",
  "description",
  "diagnosis",
  "symptom",
  "symptoms",
  "condition",
  "medication",
  "comment",
  "comments",
  "concern",
  "concerns",
  "answer",
  "answers",
  "health",
  "href",
  "url",
  "search",
  "input_value",
  "auth_error",
  "error",
  "error_message",
  "error_description",
] as const;

/** SDK fields. Stripping `token` makes posthog-js drop the event. */
const POSTHOG_RESERVED_KEYS = [
  "token",
  "distinct_id",
  "timestamp",
  "uuid",
  "event",
  "offset",
  "api_key",
] as const;

const PAGE_URL_PROPERTY_KEYS = [
  "$current_url",
  "$session_entry_url",
  "$referrer",
  "$pathname",
  "$initial_current_url",
  "$entry_current_url",
  "$initial_referrer",
  "$session_entry_referrer",
  "$prev_pageview_url",
] as const;

const RESEARCH_TITLE = "Senior care research";

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isPosthogReservedKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (lower.startsWith("$")) return true;
  return (POSTHOG_RESERVED_KEYS as readonly string[]).includes(lower);
}

/** `q` and any free-text query parameter. Short structured filters stay. */
export function isFreeTextQueryParam(key: string, value: string | null): boolean {
  const decodedKey = safeDecode(key).trim().toLowerCase();
  if ((FREE_TEXT_QUERY_KEYS as readonly string[]).includes(decodedKey)) return true;
  if (FREE_TEXT_QUERY_KEY_PATTERN.test(decodedKey)) return true;
  const decodedValue = safeDecode(value ?? "").trim();
  if (!decodedValue) return false;
  if (/\s/.test(decodedValue)) return true;
  if (decodedValue.length > 120) return true;
  return !STRUCTURED_VALUE.test(decodedValue);
}

/**
 * Autocapture serializes link URLs into `$elements_chain`, which is not a URL.
 * Replace the same free-text query params the URL sanitizer deletes.
 */
export function redactSensitiveParamsInText(text: string): string {
  return text.replace(
    /([?&]|&amp;)([^=&;"'\s]+)=([^&;"'\s]*)/g,
    (match, lead: string, key: string, value: string) => {
      let decodedKey = key;
      let decodedValue = value;
      try {
        decodedKey = decodeURIComponent(key);
      } catch {
        /* keep the raw parameter name */
      }
      try {
        decodedValue = decodeURIComponent(value.replace(/\+/g, " "));
      } catch {
        /* keep the raw parameter value */
      }
      return isFreeTextQueryParam(decodedKey, decodedValue) ? `${lead}${key}=[redacted]` : match;
    },
  );
}

export function sanitizeAnalyticsUrl(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
    const url = new URL(trimmed, "https://senior.invalid");
    for (const key of [...url.searchParams.keys()]) {
      if (isFreeTextQueryParam(key, url.searchParams.get(key))) url.searchParams.delete(key);
    }
    url.hash = "";
    url.username = "";
    url.password = "";
    if (!hasScheme) return `${url.pathname}${url.search}`;
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    const withoutHash = trimmed.split("#")[0] ?? trimmed;
    const queryAt = withoutHash.indexOf("?");
    return queryAt === -1 ? withoutHash : withoutHash.slice(0, queryAt);
  }
}

function sanitizeUrlProperties(target: Record<string, unknown>): void {
  for (const key of PAGE_URL_PROPERTY_KEYS) {
    if (typeof target[key] !== "string") continue;
    if (key === "$pathname") {
      const cleaned = sanitizeAnalyticsUrl(target[key] as string);
      target[key] = cleaned ? new URL(cleaned, "https://senior.invalid").pathname : "/";
      continue;
    }
    const cleaned = sanitizeAnalyticsUrl(target[key] as string);
    if (cleaned) target[key] = cleaned;
    else delete target[key];
  }
}

function scrubElements(value: unknown): void {
  if (!Array.isArray(value)) return;
  for (const element of value) {
    if (!element || typeof element !== "object") continue;
    const record = element as Record<string, unknown>;
    delete record.$input_value;
    delete record.input_value;
    for (const key of ["attr__href", "href", "$el_href"]) {
      if (typeof record[key] === "string") {
        record[key] = sanitizeAnalyticsUrl(record[key] as string) ?? "";
      }
    }
  }
}

export function sanitizePageviewProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  sanitizeUrlProperties(properties);
  for (const bag of ["$set", "$set_once"]) {
    const nested = properties[bag];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      sanitizeUrlProperties(nested as Record<string, unknown>);
    }
  }
  delete properties.$input_value;
  delete properties.input_value;
  if (typeof properties.$external_click_url === "string") {
    properties.$external_click_url = sanitizeAnalyticsUrl(properties.$external_click_url) ?? "";
  }
  scrubElements(properties.$elements);
  if (typeof properties.$elements_chain === "string") {
    properties.$elements_chain = redactSensitiveParamsInText(properties.$elements_chain);
  }
  const path = String(properties.$pathname || properties.$current_url || "");
  if (/\/ask(?:\/|$|\?)|\/search(?:\/|$|\?)/.test(path)) {
    properties.$title = RESEARCH_TITLE;
    properties.title = RESEARCH_TITLE;
    properties.$document_title = RESEARCH_TITLE;
  }
  for (const key of Object.keys(properties)) {
    if (isPosthogReservedKey(key)) continue;
    const lower = key.toLowerCase();
    if ((FORBIDDEN_EVENT_KEYS as readonly string[]).includes(lower)) delete properties[key];
    else if (/email|password|token|ssn|phone|diagnos|symptom|medication/.test(lower)) {
      delete properties[key];
    }
  }
  if (properties.hub == null) properties.hub = TRUSTHUB_HUB;
  if (typeof properties.environment !== "string") properties.environment = analyticsEnvironment();
  return properties;
}

export function sanitizeCaptureResult<
  T extends { event?: string; properties?: Record<string, unknown> },
>(event: T): T {
  try {
    if (event.properties) sanitizePageviewProperties(event.properties);
    return event;
  } catch {
    if (event.properties) {
      for (const key of PAGE_URL_PROPERTY_KEYS) delete event.properties[key];
      delete event.properties.$input_value;
      delete event.properties.$elements_chain;
      event.properties.hub = TRUSTHUB_HUB;
    }
    return event;
  }
}

export function sanitizeCapturedNetworkRequest<T extends { name?: string }>(request: T): T {
  if (typeof request.name === "string") {
    request.name = sanitizeAnalyticsUrl(request.name) ?? request.name.split("?")[0] ?? request.name;
  }
  return request;
}

export function stripForbiddenProperties(
  props: Record<string, unknown> | undefined,
): Record<string, string | number | boolean> {
  const cleaned: Record<string, string | number | boolean> = {};
  if (!props) return cleaned;
  for (const [key, value] of Object.entries(props)) {
    const lower = key.toLowerCase();
    if (isPosthogReservedKey(key)) continue;
    if ((FORBIDDEN_EVENT_KEYS as readonly string[]).includes(lower)) continue;
    if (/email|password|token|ssn|phone|diagnos|symptom|medication/.test(lower)) continue;
    if (value === null || value === undefined || value === "") continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export function recordedState(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z]{2}$/.test(value) ? value.toUpperCase() : undefined;
}
