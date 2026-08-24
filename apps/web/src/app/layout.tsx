import type { CSSProperties, ReactNode } from "react";
import { Inter } from "next/font/google";
import { Footer } from "@care/ui";
import { brand } from "@/config/brand";
import {
  ASK_NETWORK_OWNERSHIP_SHORT,
  ASK_NETWORK_STANDARD_URL,
  ASK_NETWORK_STANDARD_VERSION,
  NETWORK_HUBS,
} from "@/config/network";
import { siteMetadata } from "@/config/metadata";
import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";
import { TH_CHASSIS_VERSION } from "@/lib/design/trusthub-visual-standard";
import { StructuredData } from "@/components/structured-data";
import { PrivacyAnalytics } from "@/components/privacy-analytics";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: true,
  adjustFontFallback: true,
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "sans-serif"],
});

export const metadata = siteMetadata;
export const viewport = { themeColor: brand.colors.primary, colorScheme: "light" };

const brandStyles = {
  "--color-senior-plum": brand.colors.primary,
  "--color-trust-navy": brand.colors.navy,
} as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={inter.variable}
        style={brandStyles}
        data-hub="senior"
        data-network-standard={ASK_NETWORK_STANDARD_VERSION}
        data-th-chassis={TH_CHASSIS_VERSION}
      >
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main-content" tabIndex={-1}>
          {isPublicLaunchEnabled() && (
            <StructuredData
              value={{
                "@context": "https://schema.org",
                "@graph": [
                  {
                    "@type": "Organization",
                    "@id": `${productionOrigin.href}#organization`,
                    name: brand.publicName,
                    url: productionOrigin.href,
                    email: brand.publicContactEmail,
                    logo: new URL("/brand/senior-trust-hub-logo.svg", productionOrigin).href,
                    parentOrganization: {
                      "@type": "Organization",
                      "@id": "https://www.asktrusthub.com/#organization",
                      name: brand.networkName,
                      url: "https://www.asktrusthub.com",
                    },
                  },
                  {
                    "@type": "WebSite",
                    "@id": `${productionOrigin.href}#website`,
                    name: brand.publicName,
                    url: productionOrigin.href,
                    publisher: { "@id": `${productionOrigin.href}#organization` },
                  },
                ],
              }}
            />
          )}
          {children}
        </main>
        <Footer
          philosophy={brand.philosophy}
          networkName={brand.networkName}
          productName={brand.publicName}
          networkLinks={NETWORK_HUBS}
          standardUrl={ASK_NETWORK_STANDARD_URL}
          ownershipLine={ASK_NETWORK_OWNERSHIP_SHORT}
          contactEmail={brand.publicContactEmail}
        />
        <PrivacyAnalytics />
      </body>
    </html>
  );
}
