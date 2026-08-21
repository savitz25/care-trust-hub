import { NextResponse } from "next/server";
import { getFacility } from "@care/domain";
import { seniorEntityShareModel } from "@/config/share-card-model";
import { renderSeniorFallbackImage, renderSeniorShareImage } from "@/og/senior-share-card";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const facility = getFacility(slug);
    if (!facility?.name) return renderSeniorFallbackImage();
    return renderSeniorShareImage(
      seniorEntityShareModel({
        name: facility.name,
        city: facility.city,
        state: facility.state,
        careType: facility.careType,
      }),
    );
  } catch {
    return renderSeniorFallbackImage();
  }
}

export function HEAD() {
  return new NextResponse(null, { status: 200, headers: { "Content-Type": "image/png" } });
}
