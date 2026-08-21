import type { Metadata } from "next";
import { brand } from "./brand";
import { isPublicLaunchEnabled } from "./deployment";
import { SHARE_HUB, resolveShareOrigin } from "./share-hub";

const localDevelopmentOrigin = "http://localhost:3000";

function parseHttpOrigin(value: string): URL | null {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

function parseVercelOrigin(value: string | undefined): URL | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  return parseHttpOrigin(candidate.includes("://") ? candidate : `https://${candidate}`);
}

export function resolveSiteOrigin(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): URL {
  const explicitOrigin = environment.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicitOrigin) {
    const parsedExplicitOrigin = parseHttpOrigin(explicitOrigin);
    if (parsedExplicitOrigin) return parsedExplicitOrigin;
  }

  return (
    parseVercelOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL) ??
    parseVercelOrigin(environment.VERCEL_URL) ??
    new URL(localDevelopmentOrigin)
  );
}

export const siteMetadata: Metadata = {
  metadataBase: new URL(resolveShareOrigin()),
  alternates: { canonical: `${resolveShareOrigin()}/` },
  title: {
    default: `${brand.publicName} — Independent nursing home research`,
    template: `%s | ${brand.publicName}`,
  },
  description: brand.description,
  applicationName: brand.publicName,
  openGraph: {
    type: "website",
    locale: brand.locale,
    siteName: brand.publicName,
    title: brand.publicName,
    description: brand.description,
    images: [
      {
        url: `${SHARE_HUB.origin}${SHARE_HUB.ogImagePath}`,
        width: SHARE_HUB.ogWidth,
        height: SHARE_HUB.ogHeight,
        alt: SHARE_HUB.ogAlt,
      },
    ],
  },
  twitter: {
    card: SHARE_HUB.twitterCard,
    title: brand.publicName,
    description: brand.description,
    images: [{ url: `${SHARE_HUB.origin}${SHARE_HUB.ogImagePath}`, alt: SHARE_HUB.ogAlt }],
  },
  robots: { index: isPublicLaunchEnabled(), follow: isPublicLaunchEnabled() },
};
