"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { resultCountBucket, type SeniorSearchAnalytics } from "@/lib/specialist-search/analytics";
import { captureSearchResultOpened, captureSearchResults } from "@/lib/analytics/trusthub";

export function SearchAnalytics({
  dimensions,
  resultCount,
  success = true,
}: {
  dimensions: SeniorSearchAnalytics;
  resultCount: number;
  success?: boolean;
}) {
  useEffect(() => {
    track("specialist_search_interpreted", dimensions);
    track(resultCount ? "specialist_search_results" : "specialist_search_zero_results", {
      ...dimensions,
      resultCountBucket: resultCountBucket(resultCount),
    });
    captureSearchResults({
      surface: "specialist_search",
      resultCount,
      success,
      state: dimensions.state,
      capabilityState: dimensions.coverageState,
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
      if (action === "profile_open") captureSearchResultOpened("specialist_search");
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
  }, [dimensions, resultCount, success]);
  return null;
}

export function TxHhscSearchAnalytics({ resultCount }: { resultCount: number }) {
  useEffect(() => {
    captureSearchResults({
      surface: "tx_hhsc",
      resultCount,
      success: true,
      state: "TX",
    });
    const root = document.querySelector("[data-tx-hhsc-results]");
    const onClick = (event: Event) => {
      const target =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>("[data-specialist-event]")
          : null;
      if (target?.dataset.specialistEvent === "profile_open") captureSearchResultOpened("tx_hhsc");
    };
    root?.addEventListener("click", onClick);
    return () => root?.removeEventListener("click", onClick);
  }, [resultCount]);
  return null;
}
