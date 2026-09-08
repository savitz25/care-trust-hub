"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { resultCountBucket, type SeniorSearchAnalytics } from "@/lib/specialist-search/analytics";

export function SearchAnalytics({
  dimensions,
  resultCount,
}: {
  dimensions: SeniorSearchAnalytics;
  resultCount: number;
}) {
  useEffect(() => {
    track("specialist_search_interpreted", dimensions);
    track(resultCount ? "specialist_search_results" : "specialist_search_zero_results", {
      ...dimensions,
      resultCountBucket: resultCountBucket(resultCount),
    });
    const root = document.querySelector(".senior-ask");
    const onClick = (event: Event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-specialist-event]")
          : null;
      const action = target?.dataset.specialistEvent;
      if (action === "refine" || action === "profile_open")
        track(`specialist_search_${action}`, dimensions);
    };
    const onToggle = (event: Event) => {
      const details = event.target instanceof HTMLDetailsElement ? event.target : null;
      if (details?.open && details.dataset.specialistEvent === "trace_open")
        track("specialist_search_trace_open", dimensions);
    };
    root?.addEventListener("click", onClick);
    root?.addEventListener("toggle", onToggle, true);
    return () => {
      root?.removeEventListener("click", onClick);
      root?.removeEventListener("toggle", onToggle, true);
    };
  }, [dimensions, resultCount]);
  return null;
}
