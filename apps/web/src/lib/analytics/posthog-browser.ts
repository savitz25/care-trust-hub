"use client";

import type { PostHog } from "posthog-js";
import {
  analyticsEnvironment,
  posthogHost,
  posthogKey,
  shouldEnablePosthog,
  TRUSTHUB_HUB,
} from "./environment";
import { createPosthogClientGate } from "./posthog-gate";
import { isReplayEvent, sanitizeCapturedNetworkRequest, sanitizeCaptureResult } from "./privacy";

async function loadPosthog(): Promise<PostHog | null> {
  const key = posthogKey();
  if (!key) return null;
  const posthog = (await import("posthog-js")).default;
  posthog.init(key, {
    api_host: posthogHost(),
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    // Privacy: replay DOM snapshots can carry query-bearing hrefs and search text
    // echoed into result pages, and replay network capture can record request
    // bodies, so session replay is off for this hub regardless of the shared
    // project setting. Heatmaps and dead-click capture are off for the same reason.
    disable_session_recording: true,
    enable_heatmaps: false,
    capture_heatmaps: false,
    capture_dead_clicks: false,
    // Autocapture never collects element text (link/button labels can echo a query).
    mask_all_text: true,
    autocapture: {
      element_allowlist: ["a", "button"],
      dom_event_allowlist: ["click"],
      capture_copied_text: false,
      capture_value_css_selector_allowlist: [],
      css_selector_ignorelist: ["input", "textarea", "select", "[contenteditable]"],
    },
    before_send: (event) => {
      // Replay is disabled; drop any replay payload outright as defense in depth.
      if (!event || isReplayEvent(event.event)) return null;
      return sanitizeCaptureResult(event);
    },
    session_recording: {
      maskAllInputs: true,
      maskInputOptions: {
        password: true,
        email: true,
        text: true,
        search: true,
        textarea: true,
        tel: true,
        url: true,
        number: true,
        select: true,
      },
      // Only relevant if replay is ever re-enabled in code: mask every text node
      // and never record network headers or bodies.
      maskTextSelector: "*",
      recordHeaders: false,
      recordBody: false,
      maskCapturedNetworkRequestFn: (request) => sanitizeCapturedNetworkRequest(request),
    },
    loaded: (instance) => {
      instance.register({
        hub: TRUSTHUB_HUB,
        environment: analyticsEnvironment(),
      });
    },
  });
  return posthog;
}

const gate = createPosthogClientGate<PostHog>(loadPosthog);

export async function getPosthogBrowser(): Promise<PostHog | null> {
  if (typeof window === "undefined") return null;
  if (!shouldEnablePosthog()) return null;
  return gate.get();
}
