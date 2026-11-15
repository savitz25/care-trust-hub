"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import { recordedState } from "@/lib/analytics/privacy";
import { captureSearchSubmitted } from "@/lib/analytics/trusthub";

export function SearchShellAnalytics() {
  useEffect(() => {
    const form = document.getElementById("senior-specialist-search");
    const onSubmit = () => {
      track("specialist_search_submit", { hub: "senior" });
      const chosen =
        form instanceof HTMLFormElement ? String(new FormData(form).get("state") ?? "") : "";
      captureSearchSubmitted("specialist_search", recordedState(chosen));
    };
    form?.addEventListener("submit", onSubmit);
    return () => form?.removeEventListener("submit", onSubmit);
  }, []);
  return null;
}
