"use client";

import { useEffect } from "react";
import { track } from "@vercel/analytics";
import type { SeniorAskSearchContext } from "@care/domain";
import { buildAskBackLabel } from "@care/domain";

const FORBIDDEN = new Set([
  "name",
  "email",
  "phone",
  "diagnosis",
  "patient",
  "resident",
  "medication",
  "health_data",
  "ccn",
  "q",
  "query",
]);

export function AskHandoffBanner({
  context,
  resultCount,
}: {
  context: SeniorAskSearchContext;
  resultCount: number;
}) {
  useEffect(() => {
    const payload: Record<string, string | number> = {
      source: "ask",
      handoff_type: "view_more",
      hub: "senior",
      entity: context.entityType || "",
      category: context.category || "",
      state: context.state || "",
      city: context.city || "",
      zip: context.zip || "",
      result_count: resultCount,
    };
    if (context.county) payload.county = context.county;
    if (context.sid) payload.sid = context.sid;
    for (const key of Object.keys(payload)) {
      if (FORBIDDEN.has(key.toLowerCase())) return;
    }
    try {
      track("ask_handoff_received", payload);
    } catch {
      /* non-fatal */
    }
  }, [context, resultCount]);

  const label = buildAskBackLabel(context).replace(/^←\s*Back to\s+/i, "");

  return (
    <p className="methodology-note" role="status">
      <strong>Preloaded from Ask Trust Hub.</strong> Showing {label}. You do not need to search
      again. Results are ordered by facility name — not CMS Five-Star, payment, or popularity.
    </p>
  );
}
