import type { Metadata } from "next";
import { brand } from "./brand";

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const siteMetadata: Metadata = {
  metadataBase: new URL(configuredOrigin),
  title: { default: brand.publicName, template: `%s | ${brand.publicName}` },
  description: brand.description,
  applicationName: brand.publicName,
  openGraph: {
    type: "website",
    locale: brand.locale,
    siteName: brand.publicName,
    title: brand.publicName,
    description: brand.description,
  },
  robots: { index: false, follow: false },
};
