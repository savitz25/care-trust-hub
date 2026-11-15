"use client";

import { useEffect } from "react";
import { recordedState } from "@/lib/analytics/privacy";
import {
  captureSearchResultOpened,
  captureSearchResults,
  captureSearchSubmitted,
} from "@/lib/analytics/trusthub";

export function SearchSubmitBeacon({
  formId,
  surface,
  state,
}: {
  formId: string;
  surface: string;
  state?: string;
}) {
  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    const onSubmit = () => {
      const chosen = state ?? String(new FormData(form).get("state") ?? "");
      captureSearchSubmitted(surface, recordedState(chosen));
    };
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [formId, surface, state]);
  return null;
}

export function SearchOutcomeBeacon({
  active,
  surface,
  resultCount,
  success,
  state,
  capabilityState,
}: {
  active: boolean;
  surface: string;
  resultCount: number;
  success: boolean;
  state?: string;
  capabilityState?: string;
}) {
  useEffect(() => {
    if (!active) return;
    captureSearchResults({
      surface,
      resultCount,
      success,
      state: recordedState(state),
      capabilityState,
    });
  }, [active, surface, resultCount, success, state, capabilityState]);
  return null;
}

export function SearchResultClicks({
  rootSelector,
  surface,
}: {
  rootSelector: string;
  surface: string;
}) {
  useEffect(() => {
    const root = document.querySelector(rootSelector);
    if (!root) return;
    const onClick = (event: Event) => {
      const link = event.target instanceof Element ? event.target.closest("a") : null;
      if (!(link instanceof HTMLAnchorElement) || !root.contains(link)) return;
      if (!link.closest("[data-search-result]")) return;
      captureSearchResultOpened(surface);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [rootSelector, surface]);
  return null;
}
