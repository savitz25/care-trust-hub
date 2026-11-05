import { publishedAssistedLivingPath } from "@care/domain";
import { notFound } from "next/navigation";
import { NextResponse } from "next/server";
import { getPublishedAssistedLivingProvider } from "@/server/care/assisted-living-publication";
import { isAssistedLivingIntelligenceEnabled } from "@/server/care/feature-flags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDER_ID = /^[0-9a-f-]{36}$/i;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ providerId: string }> },
) {
  if (!isAssistedLivingIntelligenceEnabled()) notFound();
  const { providerId } = await params;
  if (!PROVIDER_ID.test(providerId)) notFound();
  const provider = await getPublishedAssistedLivingProvider(providerId);
  if (!provider) return new NextResponse(null, { status: 410 });
  const path = publishedAssistedLivingPath({
    stateCode: provider.stateCode,
    id: provider.id,
    officialName: provider.officialName,
  });
  return NextResponse.redirect(new URL(path, request.url), 301);
}
