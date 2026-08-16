import { notFound } from "next/navigation";
import { ChainIntelligence } from "@/components/chain-intelligence";
import { isChainIntelligenceEnabled } from "@/server/care/feature-flags";
import { getChainIntelligence } from "@/server/care/chain-repository";
export const dynamic = "force-dynamic";
export default async function ChainPage({
  params,
}: {
  params: Promise<{ chainId: string; slug: string }>;
}) {
  if (!isChainIntelligenceEnabled()) notFound();
  const { chainId } = await params;
  const chain = await getChainIntelligence(chainId);
  if (!chain) notFound();
  return (
    <main className="investigation-page">
      <div className="page-shell">
        <div className="real-data-notice">
          <strong>Controlled real CMS data review</strong>
          <span>Not publicly activated. CMS-published chain evidence only.</span>
        </div>
        <ChainIntelligence chain={chain} />
      </div>
    </main>
  );
}
