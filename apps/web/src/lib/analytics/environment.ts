export type AnalyticsEnvironment = "production" | "preview" | "development";

export const TRUSTHUB_HUB = "senior" as const;

const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

let boundEnvironment: AnalyticsEnvironment | null = null;

/** Server layout passes VERCEL_ENV into the client. Unset means development. */
export function bindAnalyticsEnvironment(value: string | undefined): void {
  boundEnvironment =
    value === "production" || value === "preview" || value === "development"
      ? value
      : "development";
}

export function analyticsEnvironment(): AnalyticsEnvironment {
  if (boundEnvironment) return boundEnvironment;
  const vercel = process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercel === "production" || vercel === "preview") return vercel;
  return "development";
}

export function posthogKey(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_KEY || "").trim();
}

export function posthogHost(): string {
  return (process.env.NEXT_PUBLIC_POSTHOG_HOST || "").trim() || DEFAULT_POSTHOG_HOST;
}

/** Local development stays quiet unless this public flag is set. */
export function posthogDebug(): boolean {
  return /^(1|true|yes)$/i.test((process.env.NEXT_PUBLIC_POSTHOG_DEBUG || "").trim());
}

/**
 * Missing key is a no-op. Development does not send unless the debug flag is set.
 * Preview and production send when the key is present.
 */
export function shouldEnablePosthog(): boolean {
  if (!posthogKey()) return false;
  if (analyticsEnvironment() === "development" && !posthogDebug()) return false;
  return true;
}
