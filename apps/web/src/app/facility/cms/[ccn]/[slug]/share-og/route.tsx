import { NextResponse } from "next/server";
import { isRealProviderUiEnabled } from "@/server/care/feature-flags";
import { getProviderByCcnForPage } from "@/server/care/cached-repository";
import { seniorEntityShareModel } from "@/config/share-card-model";
import { renderSeniorFallbackImage, renderSeniorShareImage } from "@/og/senior-share-card";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ ccn: string; slug: string }> },
) {
  try {
    if (!isRealProviderUiEnabled()) return renderSeniorFallbackImage();
    const { ccn } = await context.params;
    const provider = await getProviderByCcnForPage(ccn).catch(() => null);
    if (!provider?.providerName) return renderSeniorFallbackImage();
    return renderSeniorShareImage(
      seniorEntityShareModel({
        name: provider.providerName,
        city: provider.location.city,
        state: provider.location.state,
        careType: "Senior care research",
      }),
    );
  } catch {
    return renderSeniorFallbackImage();
  }
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Content-Type": "image/png" } });
}
