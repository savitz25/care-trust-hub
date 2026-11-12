"use client";

import { analyticsEnvironment, shouldEnablePosthog, TRUSTHUB_HUB } from "./environment";
import { getPosthogBrowser } from "./posthog-browser";
import { recordedState, sanitizeAnalyticsUrl, stripForbiddenProperties } from "./privacy";
import { type TrustHubEventName, type TrustHubEventProperties } from "./trusthub-events";

export type TrustHubCaptureOptions = {
  /** Use before a navigation that unloads the page. */
  sendBeforeUnload?: boolean;
};

let lastPageviewPath = "";

export function captureTrustEvent(
  event: TrustHubEventName | string,
  properties?: Partial<TrustHubEventProperties>,
  options?: TrustHubCaptureOptions,
): void {
  try {
    if (!shouldEnablePosthog()) return;
    const { state: rawState, ...rest } = properties ?? {};
    const state = recordedState(rawState);
    const payload = stripForbiddenProperties({
      ...rest,
      hub: TRUSTHUB_HUB,
      environment: analyticsEnvironment(),
      ...(state ? { state } : {}),
    });
    void getPosthogBrowser()
      .then((posthog) => {
        if (!posthog) return;
        if (options?.sendBeforeUnload) {
          posthog.capture(event, payload, { send_instantly: true, transport: "sendBeacon" });
          return;
        }
        posthog.capture(event, payload);
      })
      .catch(() => undefined);
  } catch {
    // Observability must never break the page.
  }
}

export function captureSanitizedPageview(pathname: string, href?: string): void {
  try {
    const path = (pathname.split("?")[0] || "/").split("#")[0] || "/";
    if (lastPageviewPath === path) return;
    lastPageviewPath = path;
    captureTrustEvent("$pageview", {
      surface: "app_router",
      $pathname: path,
      $current_url: sanitizeAnalyticsUrl(href || pathname),
    } as Partial<TrustHubEventProperties>);
  } catch {
    // ignore
  }
}

export function captureSearchSubmitted(surface: string, state?: string): void {
  captureTrustEvent(
    "search_submitted",
    { surface, success: true, state: recordedState(state) },
    { sendBeforeUnload: true },
  );
}

export function captureSearchResults(properties: {
  surface: string;
  resultCount: number;
  success: boolean;
  state?: string;
  capabilityState?: string;
}): void {
  captureTrustEvent("search_results_returned", {
    surface: properties.surface,
    result_count: properties.resultCount,
    success: properties.success,
    state: recordedState(properties.state),
    capability_state: properties.capabilityState,
  });
}

export function captureSearchResultOpened(surface: string): void {
  captureTrustEvent("search_result_opened", { surface, success: true }, { sendBeforeUnload: true });
}
