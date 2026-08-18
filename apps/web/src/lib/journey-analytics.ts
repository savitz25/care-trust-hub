/** Network V2.1.1 — journey_handoff_click (Senior). No health or facility fields. */

import { track } from "@vercel/analytics";

const HUBS = new Set(["ask", "move", "lender", "insurance", "contractor", "senior", "investor"]);

const FORBIDDEN = new Set([
  "name",
  "email",
  "phone",
  "address",
  "ssn",
  "account",
  "member",
  "diagnosis",
  "holdings",
  "ccn",
  "facility",
  "href",
  "url",
]);

export type SeniorJourneyHandoff = {
  destination_hub: "move" | "contractor" | "insurance";
  surface: "senior_transition" | "senior_navigator_completion";
  journey_id: string;
  context_type: string;
};

export function trackJourneyHandoff(params: SeniorJourneyHandoff): void {
  if (typeof window === "undefined") return;
  if (!HUBS.has(params.destination_hub)) return;
  const payload: Record<string, string> = {
    source_hub: "senior",
    destination_hub: params.destination_hub,
    from_hub: "senior",
    to_hub: params.destination_hub,
    surface: params.surface,
    journey_id: params.journey_id,
    context_type: params.context_type,
  };
  for (const key of Object.keys(payload)) {
    if (FORBIDDEN.has(key)) return;
  }
  try {
    track("journey_handoff_click", payload);
  } catch {
    /* non-fatal */
  }
}

export function isForbiddenAnalyticsKey(key: string): boolean {
  return FORBIDDEN.has(key.toLowerCase());
}
