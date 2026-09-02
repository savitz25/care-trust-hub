import { seniorClaimProfile, claimCtaEnabledFor } from "@/server/customer-integration/eligibility";
import { mintSeniorHandoff } from "@/server/customer-integration/handoff";
import { claimRedirect } from "@/server/customer-integration/security";
import type { SeniorProviderClass } from "@/server/care/senior-ask-contract";
export const runtime = "nodejs",
  dynamic = "force-dynamic";
const HEADERS = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function GET(
  _r: Request,
  { params }: { params: Promise<{ providerClass: string; ccn: string }> },
) {
  const { providerClass, ccn } = await params;
  try {
    if (!["nursing_home", "home_health", "hospice"].includes(providerClass))
      return Response.json(
        { error: "Provider class is not claimable." },
        { status: 404, headers: HEADERS },
      );
    const p = await seniorClaimProfile(providerClass as SeniorProviderClass, ccn);
    if (!p || !claimCtaEnabledFor(p.nativeProfileId))
      return Response.json(
        {
          error: "Profile management is unavailable.",
          nextActions: [
            "Return to the provider profile",
            "Find another current provider",
            "Contact AskTrustHub support",
          ],
        },
        { status: 404, headers: HEADERS },
      );
    return claimRedirect(mintSeniorHandoff(process.env.ATH_HANDOFF_SECRET || "", p).token);
  } catch {
    return Response.json(
      {
        error: "Profile management is temporarily unavailable.",
        nextActions: [
          "Try again later",
          "Continue researching SeniorTrustHub",
          "Contact AskTrustHub support",
        ],
      },
      { status: 503, headers: HEADERS },
    );
  }
}
