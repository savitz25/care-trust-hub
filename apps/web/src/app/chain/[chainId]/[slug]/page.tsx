import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ChainIntelligence } from "@/components/chain-intelligence";
import { RealDataNotice } from "@/components/evidence";
import { canonicalUrl, publicRobots } from "@/config/deployment";
import { isChainIntelligenceEnabled } from "@/server/care/feature-flags";
import { getChainIntelligence } from "@/server/care/chain-repository";
import { chainHref, providerSlug } from "@/server/care/consumer";
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ chainId: string }>;
}): Promise<Metadata> {
  if (!isChainIntelligenceEnabled())
    return { title: "Chain not found", robots: publicRobots(false) };
  const chain = await getChainIntelligence((await params).chainId).catch(() => null);
  if (!chain) return { title: "Chain not found", robots: publicRobots(false) };
  const href = chainHref({ cmsChainId: chain.cmsChainId, chainName: chain.current.chainName });
  return {
    title: `${chain.current.chainName} Nursing Home Chain Research`,
    description: `Review CMS-published nursing home chain performance evidence for ${chain.current.chainName}.`,
    alternates: canonicalUrl(href) ? { canonical: canonicalUrl(href) } : undefined,
    robots: publicRobots(true),
  };
}
export default async function ChainPage({
  params,
}: {
  params: Promise<{ chainId: string; slug: string }>;
}) {
  if (!isChainIntelligenceEnabled()) notFound();
  const { chainId, slug } = await params;
  const chain = await getChainIntelligence(chainId);
  if (!chain) notFound();
  if (slug !== providerSlug(chain.current.chainName))
    permanentRedirect(chainHref({ cmsChainId: chainId, chainName: chain.current.chainName }));
  return (
    <main className="investigation-page">
      <div className="page-shell">
        <RealDataNotice />
        <ChainIntelligence chain={chain} />
      </div>
    </main>
  );
}
