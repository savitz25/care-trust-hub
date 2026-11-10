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
import { sanitizeCapturedNetworkRequest, sanitizeCaptureResult } from "./privacy";

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
    autocapture: {
      element_allowlist: ["a", "button"],
      dom_event_allowlist: ["click"],
      capture_copied_text: false,
      capture_value_css_selector_allowlist: [],
      css_selector_ignorelist: ["input", "textarea", "select", "[contenteditable]"],
    },
    before_send: (event) => sanitizeCaptureResult(event),
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
      maskTextSelector: "input, textarea, select, [contenteditable], [data-ph-mask]",
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
