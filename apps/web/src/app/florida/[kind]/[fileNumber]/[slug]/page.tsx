import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { TrustStrip } from "@/components/evidence";
import { FloridaProviderProfileView } from "@/components/florida-provider-profile";
import { StructuredData } from "@/components/structured-data";
import {
  canonicalUrl,
  isPublicLaunchEnabled,
  productionOrigin,
  publicRobots,
} from "@/config/deployment";
import {
  isFloridaCohortIndexable,
  loadPublishedFloridaProfile,
} from "@/server/care/florida-publication";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ kind: string; fileNumber: string; slug: string }>;
}

function streetAddress(payload: {
  contacts: Array<{ contact_kind: string; value_text: string }>;
}): string | undefined {
  return payload.contacts.find((c) => c.contact_kind === "street_address")?.value_text;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { kind, fileNumber, slug } = await params;
  const result = await loadPublishedFloridaProfile(kind, fileNumber, slug);
  if (!result || "redirectTo" in result) {
    return { title: "Provider not found", robots: publicRobots(false) };
  }
  const name = result.payload.identity.official_name;
  const indexable = isFloridaCohortIndexable();
  return {
    title: `${name} — Florida ${result.payload.identity.profile_kind.replace(/-/g, " ")} research`,
    description: `Research ${name} using official Florida AHCA licensing and regulatory evidence. No score and no paid placement.`,
    alternates: canonicalUrl(result.path) ? { canonical: canonicalUrl(result.path) } : undefined,
    robots: publicRobots(indexable),
  };
}

export default async function FloridaPublishedProviderPage({ params }: Props) {
  const { kind, fileNumber, slug } = await params;
  const result = await loadPublishedFloridaProfile(kind, fileNumber, slug);
  if (!result) notFound();
  if ("redirectTo" in result) permanentRedirect(result.redirectTo);
  const payload = result.payload;
  const pageUrl = new URL(result.path, productionOrigin).href;
  const street = streetAddress(payload);
  return (
    <>
      <div className="page-shell">
        {isPublicLaunchEnabled() ? (
          <StructuredData
            value={{
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebPage",
                  "@id": `${pageUrl}#webpage`,
                  name: payload.identity.official_name,
                  url: pageUrl,
                  description:
                    "Official Florida AHCA licensing and regulatory research. Not a rating or recommendation.",
                  isPartOf: { "@id": `${productionOrigin.href}#website` },
                },
                {
                  "@type": "BreadcrumbList",
                  itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: productionOrigin.href },
                    {
                      "@type": "ListItem",
                      position: 2,
                      name: "Florida",
                      item: new URL("/florida", productionOrigin).href,
                    },
                    {
                      "@type": "ListItem",
                      position: 3,
                      name: payload.identity.official_name,
                      item: pageUrl,
                    },
                  ],
                },
                {
                  "@type": "Organization",
                  "@id": `${pageUrl}#provider`,
                  name: payload.identity.official_name,
                  ...(street
                    ? {
                        address: {
                          "@type": "PostalAddress",
                          streetAddress: street,
                          addressRegion: "FL",
                          addressCountry: "US",
                        },
                      }
                    : {}),
                },
              ],
            }}
          />
        ) : null}
        <FloridaProviderProfileView path={result.path} payload={payload} />
      </div>
      <TrustStrip />
    </>
  );
}
