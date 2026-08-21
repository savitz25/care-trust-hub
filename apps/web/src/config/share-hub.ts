/**
 * SHARE-002 — SeniorTrustHub social-share identity (repo-local).
 * Public brand is SeniorTrustHub. Production canonical + default card
 * must never drift to localhost, a Vercel preview host, or another Hub.
 */

export const SHARE_HUB = {
  id: "senior",
  brand: "SeniorTrustHub",
  host: "www.seniortrusthub.com",
  apexHost: "seniortrusthub.com",
  origin: "https://www.seniortrusthub.com",
  ogImagePath: "/opengraph-image",
  ogWidth: 1200,
  ogHeight: 630,
  ogAlt: "SeniorTrustHub — independent senior care research from the Ask Trust Hub Network",
  twitterCard: "summary_large_image",
  networkLabel: "ASK TRUST HUB NETWORK",
} as const;

export const FOREIGN_TRUSTHUB_HOSTS = [
  "www.asktrusthub.com",
  "asktrusthub.com",
  "www.movetrusthub.com",
  "movetrusthub.com",
  "www.insurancetrusthub.com",
  "insurancetrusthub.com",
  "www.lendertrusthub.com",
  "lendertrusthub.com",
  "www.contractortrusthub.com",
  "contractortrusthub.com",
  "www.investortrusthub.com",
  "investortrusthub.com",
] as const;

export function isForbiddenShareHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  return (FOREIGN_TRUSTHUB_HOSTS as readonly string[]).includes(host);
}

export function resolveShareOrigin(): string {
  return SHARE_HUB.origin;
}
