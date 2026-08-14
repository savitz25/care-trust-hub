import type { CSSProperties, ReactNode } from "react";
import { Footer, Header } from "@care/ui";
import { brand } from "@/config/brand";
import { siteMetadata } from "@/config/metadata";
import "./globals.css";

export const metadata = siteMetadata;
export const viewport = { themeColor: brand.colors.primary, colorScheme: "light" };

const brandStyles = { "--color-evergreen-600": brand.colors.primary } as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body style={brandStyles}>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <Header productName={brand.publicName} networkName={brand.networkName} />
        <main id="main-content" tabIndex={-1}>
          {children}
        </main>
        <Footer philosophy={brand.philosophy} networkName={brand.networkName} />
      </body>
    </html>
  );
}
