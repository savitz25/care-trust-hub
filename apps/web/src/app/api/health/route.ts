import { getCareDatabasePool } from "@/server/care/db";
import {
  isChainIntelligenceEnabled,
  isInspectionIntelligenceEnabled,
  isOwnershipIntelligenceEnabled,
  isRealProviderUiEnabled,
  isStaffingIntelligenceEnabled,
  isTrustParticipationEnabled,
} from "@/server/care/feature-flags";
import { isPublicLaunchEnabled } from "@/config/deployment";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = {
    publicLaunch: isPublicLaunchEnabled(),
    realProviderUi: isRealProviderUiEnabled(),
    inspections: isInspectionIntelligenceEnabled(),
    staffing: isStaffingIntelligenceEnabled(),
    ownership: isOwnershipIntelligenceEnabled(),
    chains: isChainIntelligenceEnabled(),
    trustParticipation: isTrustParticipationEnabled(),
  };
  try {
    await getCareDatabasePool().query("SELECT 1");
    return Response.json(
      { status: "ready", database: "reachable", configured },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", database: "unreachable", configured },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
