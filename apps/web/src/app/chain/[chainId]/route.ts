import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { getChainIntelligence } from "@/server/care/chain-repository";
import { chainHref, isValidCmsChainId } from "@/server/care/consumer";
import { isChainIntelligenceEnabled } from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ chainId: string }> }) {
  if (!isChainIntelligenceEnabled()) notFound();
  const { chainId } = await params;
  if (!isValidCmsChainId(chainId)) notFound();
  const chain = await getChainIntelligence(chainId);
  if (!chain) return new NextResponse(null, { status: 410 });
  const path = chainHref({ cmsChainId: chain.cmsChainId, chainName: chain.current.chainName });
  return NextResponse.redirect(new URL(path, request.url), 301);
}
