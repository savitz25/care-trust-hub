import type { CSSProperties, ReactNode } from "react";
import { Footer, Header } from "@care/ui";
import { brand } from "@/config/brand";
import {
  ASK_NETWORK_OWNERSHIP_SHORT,
  ASK_NETWORK_STANDARD_URL,
  CURRENT_NETWORK_HUB_ID,
  NETWORK_HUBS,
} from "@/config/network";
import { siteMetadata } from "@/config/metadata";
import { isPublicLaunchEnabled, productionOrigin } from "@/config/deployment";
import { StructuredData } from "@/components/structured-data";
import { PrivacyAnalytics } from "@/components/privacy-analytics";
import "./globals.css";

export const metadata = siteMetadata;
export const viewport = { themeColor: brand.colors.primary, colorScheme: "light" };

const brandStyles = {
  "--color-senior-plum": brand.colors.primary,
  "--color-trust-navy": brand.colors.navy,
} as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body style={brandStyles}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Header
          productName={brand.publicName}
          networkName={brand.networkName}
          networkLinks={NETWORK_HUBS}
          currentHubId={CURRENT_NETWORK_HUB_ID}
        />
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
        />
        <PrivacyAnalytics />
      </body>
    </html>
  );
}
