"use client";

import { useEffect } from "react";
import { type SeniorSearchAnalytics } from "@/lib/specialist-search/analytics";
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
      if (action === "profile_open") captureSearchResultOpened("specialist_search");
    };
    root?.addEventListener("click", onClick);
    return () => {
      root?.removeEventListener("click", onClick);
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
