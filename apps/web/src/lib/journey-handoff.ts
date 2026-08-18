/** Network V2.1 — bounded inbound journey context for SeniorTrustHub. */

export type JourneySrc = "ask" | "move" | "lender" | "insurance" | "contractor" | "senior";
export type JourneyKind = "relocate" | "purchase" | "coverage" | "senior_care" | "contractor" | "unknown";
export type JourneyIntent = "buy" | "rent" | "refi" | "unknown";

export type NetworkJourneyContext = {
  src?: JourneySrc;
  journey?: JourneyKind;
  intent?: JourneyIntent;
  state?: string;
};

const SRC = new Set<JourneySrc>(["ask", "move", "lender", "insurance", "contractor", "senior"]);
const JOURNEY = new Set<JourneyKind>([
  "relocate",
  "purchase",
  "coverage",
  "senior_care",
  "contractor",
  "unknown",
]);
const INTENT = new Set<JourneyIntent>(["buy", "rent", "refi", "unknown"]);

function first(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export function parseNetworkJourney(
  searchParams:
    | URLSearchParams
    | Record<string, string | string[] | undefined>
    | null
    | undefined,
): NetworkJourneyContext {
  const get = (key: string): string | undefined => {
    if (!searchParams) return undefined;
    if (searchParams instanceof URLSearchParams) return first(searchParams.get(key) ?? undefined);
    return first(searchParams[key]);
  };
  const srcRaw = get("src")?.toLowerCase() as JourneySrc | undefined;
  const journeyRaw = get("journey")?.toLowerCase() as JourneyKind | undefined;
  const intentRaw = get("intent")?.toLowerCase() as JourneyIntent | undefined;
  const stateRaw = get("state");
  const state =
    stateRaw && /^[A-Za-z]{2}$/.test(stateRaw)
      ? stateRaw.toUpperCase()
      : stateRaw && /^[a-z-]{2,32}$/i.test(stateRaw)
        ? stateRaw.toLowerCase()
        : undefined;
  return {
    src: srcRaw && SRC.has(srcRaw) ? srcRaw : undefined,
    journey: journeyRaw && JOURNEY.has(journeyRaw) ? journeyRaw : undefined,
    intent: intentRaw && INTENT.has(intentRaw) ? intentRaw : undefined,
    state,
  };
}

function url(origin: string, path: string, ctx: NetworkJourneyContext, journey: JourneyKind): string {
  const p = new URLSearchParams();
  p.set("src", "senior");
  p.set("journey", journey);
  if (ctx.state) p.set("state", ctx.state);
  return `${origin}${path}?${p.toString()}`;
}

export type JourneyModule = {
  eyebrow: string;
  heading: string;
  body: string;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
};

export function resolveSeniorJourneyModule(
  ctx: NetworkJourneyContext,
  surface: "home" | "facility" | "planner",
): JourneyModule | null {
  const relocate = ctx.journey === "relocate" || ctx.src === "move";
  const homeMod = ctx.journey === "contractor";
  const coverage = ctx.journey === "coverage" || ctx.src === "insurance";

  if (surface === "facility" && !relocate && !homeMod && !coverage) return null;
  if (surface === "home" && !relocate && !homeMod && !coverage) return null;

  if (relocate) {
    return {
      eyebrow: "Part of the Ask Trust Hub research network",
      heading: "Planning a move as part of the care transition?",
      body: "Research licensed movers when downsizing, relocating, or moving closer to family. This is not a placement or referral service.",
      primary: {
        href: url("https://www.movetrusthub.com", "/", ctx, "relocate"),
        label: "Plan the move",
      },
      secondary: homeMod
        ? {
            href: url("https://www.contractortrusthub.com", "/", ctx, "contractor"),
            label: "Research contractors",
          }
        : undefined,
    };
  }

  if (homeMod) {
    return {
      eyebrow: "Part of the Ask Trust Hub research network",
      heading: "Staying at home?",
      body: "Research contractors for accessibility or safety modifications. We do not recommend a specific contractor.",
      primary: {
        href: url("https://www.contractortrusthub.com", "/", ctx, "contractor"),
        label: "Research contractors",
      },
    };
  }

  if (coverage) {
    return {
      eyebrow: "Part of the Ask Trust Hub research network",
      heading: "Research coverage questions separately",
      body: "Insurance Trust Hub is independent coverage research. It does not resolve Medicare or Medicaid eligibility for a facility choice, and this link does not send health details.",
      primary: {
        href: url("https://www.insurancetrusthub.com", "/destinations", ctx, "coverage"),
        label: "Research coverage questions",
      },
    };
  }

  if (surface === "planner" && (ctx.src === "ask" || ctx.journey === "senior_care")) {
    return {
      eyebrow: "Part of the Ask Trust Hub research network",
      heading: "Other decisions only if they apply",
      body: "A move, home modification, or coverage question is optional — not a required next step and not a referral.",
      primary: {
        href: url("https://www.movetrusthub.com", "/", ctx, "relocate"),
        label: "Plan the move",
      },
      secondary: {
        href: url("https://www.contractortrusthub.com", "/", ctx, "contractor"),
        label: "Research contractors",
      },
    };
  }

  return null;
}
