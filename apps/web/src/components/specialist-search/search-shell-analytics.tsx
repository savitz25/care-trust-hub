"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";

export function SearchShellAnalytics() {
  useEffect(() => {
    const form = document.getElementById("senior-specialist-search");
    const onSubmit = () => track("specialist_search_submit", { hub: "senior" });
    form?.addEventListener("submit", onSubmit);
    return () => form?.removeEventListener("submit", onSubmit);
  }, []);
  return null;
}
